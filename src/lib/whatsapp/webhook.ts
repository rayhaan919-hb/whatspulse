// Meta WhatsApp Cloud API Webhook Parser & Security Verifier
// Handles HMAC SHA-256 signature verification, event parsing, and status updates

import crypto from 'crypto';
import { MetaWebhookPayload } from '@/types/crm';

export interface ParsedIncomingMessage {
  from: string; // Customer WhatsApp Number (e.g. +14155552671)
  name: string; // Contact Profile Name
  messageId: string; // wamid.HBgL...
  timestamp: string;
  type: string;
  body: string;
  interactiveSelection?: {
    id: string;
    title: string;
  };
}

export interface ParsedStatusUpdate {
  messageId: string;
  recipientId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  error?: {
    code: number;
    title: string;
    message: string;
  };
}

export class WebhookProcessor {
  /**
   * Validates Meta Webhook Subscription Challenge (GET /api/webhooks/whatsapp)
   */
  static verifySubscription(
    mode: string | null,
    verifyToken: string | null,
    challenge: string | null,
    expectedSecretToken: string
  ): { isValid: boolean; challenge?: string } {
    if (mode === 'subscribe' && verifyToken === expectedSecretToken && challenge) {
      return { isValid: true, challenge };
    }
    return { isValid: false };
  }

  /**
   * Verifies X-Hub-Signature-256 header against the raw request body using App Secret
   */
  static verifySignature(rawBody: string, signatureHeader: string | null, appSecret?: string): boolean {
    if (!appSecret) {
      // In development or demo mode, allow passing if no appSecret is explicitly set
      return true;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = signatureHeader.substring(7);
    const hmac = crypto.createHmac('sha256', appSecret);
    const calculatedSignature = hmac.update(rawBody).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(calculatedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Parses Incoming Webhook Payload into normalized events
   */
  static parsePayload(payload: MetaWebhookPayload): {
    incomingMessages: ParsedIncomingMessage[];
    statusUpdates: ParsedStatusUpdate[];
  } {
    const incomingMessages: ParsedIncomingMessage[] = [];
    const statusUpdates: ParsedStatusUpdate[] = [];

    if (!payload?.entry) {
      return { incomingMessages, statusUpdates };
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const val = change.value;
        if (!val) continue;

        // Parse Contacts Name Map
        const contactMap = new Map<string, string>();
        if (val.contacts) {
          for (const c of val.contacts) {
            contactMap.set(c.wa_id, c.profile?.name || c.wa_id);
          }
        }

        // 1. Process Messages
        if (val.messages) {
          for (const msg of val.messages) {
            const fromNumber = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
            const contactName = contactMap.get(msg.from) || fromNumber;
            let bodyText = '';
            let interactiveSelection;

            if (msg.type === 'text' && msg.text) {
              bodyText = msg.text.body;
            } else if (msg.type === 'interactive' && msg.interactive) {
              if (msg.interactive.button_reply) {
                interactiveSelection = msg.interactive.button_reply;
                bodyText = msg.interactive.button_reply.title;
              } else if (msg.interactive.list_reply) {
                interactiveSelection = msg.interactive.list_reply;
                bodyText = msg.interactive.list_reply.title;
              }
            } else if (msg.type === 'button' && msg.button) {
              bodyText = msg.button.text;
            } else if (msg.type === 'image') {
              bodyText = '📷 [Photo Attached]';
            } else {
              bodyText = `📎 [${msg.type.toUpperCase()}]`;
            }

            incomingMessages.push({
              from: fromNumber,
              name: contactName,
              messageId: msg.id,
              timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
              type: msg.type,
              body: bodyText,
              interactiveSelection,
            });
          }
        }

        // 2. Process Status Receipts
        if (val.statuses) {
          for (const st of val.statuses) {
            statusUpdates.push({
              messageId: st.id,
              recipientId: st.recipient_id,
              status: st.status,
              timestamp: new Date(Number(st.timestamp) * 1000).toISOString(),
              error: st.errors?.[0],
            });
          }
        }
      }
    }

    return { incomingMessages, statusUpdates };
  }
}
