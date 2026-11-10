// Webhook Event Durability & Asynchronous Processing Engine
// Phase 1A: Ensures zero lost events, idempotent ingestion, and dead-letter handling
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import crypto from 'crypto';
import type {
  MetaWebhookPayload,
  WebhookEventRecord,
  Message,
  PendingStatusRecord,
} from '../../types/crm';
import { WebhookProcessor } from './webhook';
import { DEFAULT_TEMPLATES } from '../storage';
import type { MessageTemplate } from '../../types/crm';

// In-memory durable event buffer (mirrors public.webhook_events table)
export const IN_MEMORY_WEBHOOK_EVENTS: WebhookEventRecord[] = [];
export const IN_MEMORY_PENDING_STATUSES: PendingStatusRecord[] = [];
export const IN_MEMORY_MESSAGES: Message[] = [];

export interface EventProcessResult {
  eventId: string;
  status: 'completed' | 'failed' | 'dead_letter';
  processedMessages: number;
  processedStatuses: number;
  processedTemplates?: number;
  error?: string;
}

export class WebhookEventQueue {
  private static MAX_ATTEMPTS = 5;

  /**
   * Persists raw webhook event immediately upon receipt
   */
  static persistEvent(
    workspaceId: string | undefined,
    phoneNumberId: string | undefined,
    payload: MetaWebhookPayload
  ): WebhookEventRecord {
    const record: WebhookEventRecord = {
      id: `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      workspaceId,
      phoneNumberId,
      payload,
      receivedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };

    IN_MEMORY_WEBHOOK_EVENTS.push(record);
    return record;
  }

  /**
   * Processes a webhook event asynchronously with automatic retry and dead-letter safety
   */
  static async processEventAsync(
    event: WebhookEventRecord,
    messageStore: Message[] = IN_MEMORY_MESSAGES,
    pendingStatusStore: PendingStatusRecord[] = IN_MEMORY_PENDING_STATUSES
  ): Promise<EventProcessResult> {
    event.attempts += 1;
    event.status = 'processing';

    try {
      const workspaceId = event.workspaceId || 'ws_prod_01';
      const { incomingMessages, statusUpdates, templateUpdates } = WebhookProcessor.parsePayload(event.payload);

      let processedMessages = 0;
      let processedStatuses = 0;
      let processedTemplates = 0;

      // 1. Process Messages (Idempotent + early status resolution)
      for (const msg of incomingMessages) {
        WebhookProcessor.processIncomingMessage(workspaceId, msg, messageStore, pendingStatusStore);
        processedMessages += 1;
      }

      // 2. Process Status Updates (Monotonic + pending store if early)
      for (const st of statusUpdates) {
        WebhookProcessor.processStatusUpdate(workspaceId, st, messageStore, pendingStatusStore);
        processedStatuses += 1;
      }

      // 3. Process Template Lifecycle Updates (Status / Category / Quality)
      // Reference: META_VERIFY.md MV-03
      for (const tmpl of templateUpdates || []) {
        const found = DEFAULT_TEMPLATES.find(
          (t) =>
            t.metaTemplateId === tmpl.messageTemplateId ||
            t.name === tmpl.messageTemplateName
        );
        if (found) {
          if (tmpl.event && ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'].includes(tmpl.event)) {
            found.status = tmpl.event as MessageTemplate['status'];
          }
          if (tmpl.newCategory && ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(tmpl.newCategory)) {
            found.category = tmpl.newCategory as MessageTemplate['category'];
          }
          if (tmpl.qualityRating) {
            found.qualityRating = tmpl.qualityRating as MessageTemplate['qualityRating'];
          }
        }
        processedTemplates += 1;
      }

      event.status = 'completed';
      event.processedAt = new Date().toISOString();

      return {
        eventId: event.id,
        status: 'completed',
        processedMessages,
        processedStatuses,
        processedTemplates,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      event.lastError = errorMsg;

      if (event.attempts >= this.MAX_ATTEMPTS) {
        event.status = 'dead_letter';
      } else {
        event.status = 'failed';
      }

      return {
        eventId: event.id,
        status: event.status,
        processedMessages: 0,
        processedStatuses: 0,
        error: errorMsg,
      };
    }
  }
}
