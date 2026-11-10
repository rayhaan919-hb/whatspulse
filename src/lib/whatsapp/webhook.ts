// Meta WhatsApp Cloud API Webhook Parser & Security Verifier
// Phase 1A: Hardened Verification, Idempotency, Monotonic Status, and Multi-Tenant Routing
// Official Meta Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import crypto from 'crypto';
import type {
  MetaWebhookPayload,
  Message,
  MessageStatus,
  PendingStatusRecord,
  TenantRoutingConfig,
} from '../../types/crm';

export interface ParsedIncomingMessage {
  from: string; // Customer WhatsApp Number (E.164 e.g. +14155552671)
  name: string; // Contact Profile Name
  messageId: string; // wamid.HBgL...
  timestamp: string;
  type: string;
  body: string;
  mediaId?: string;
  mimeType?: string;
  mediaUrl?: string;
  interactiveSelection?: {
    id: string;
    title: string;
  };
}

export interface ParsedStatusUpdate {
  messageId: string;
  recipientId: string;
  status: MessageStatus;
  timestamp: string;
  pricing?: {
    billable: boolean;
    pricingModel?: string;
    category: string;
    type?: string;
  };
  error?: {
    code: number;
    title: string;
    message: string;
  };
}

// Meta Phone Quality & Messaging Limit Webhook Update (MV-04)
export interface ParsedQualityUpdate {
  displayPhoneNumber?: string;
  phoneNumberId?: string;
  event?: string;
  currentLimit?: string;
  qualityRating?: string;
}

// Meta Template Lifecycle Webhook Update (MV-03)
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
export interface ParsedTemplateUpdate {
  event: 'APPROVED' | 'REJECTED' | 'PAUSED' | 'PENDING' | 'FLAGGED' | string;
  messageTemplateId?: string;
  messageTemplateName?: string;
  messageTemplateLanguage?: string;
  reason?: string;
  previousCategory?: string; // VERIFY: Meta sends previous_category on re-categorization
  newCategory?: string; // VERIFY: Meta sends new_category on re-categorization
  qualityRating?: string;
}

export const STATUS_RANK: Record<MessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

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
   * Handles missing/malformed headers and length mismatches before timingSafeEqual
   */
  static verifySignature(
    rawBody: string,
    signatureHeader: string | null | undefined,
    appSecret?: string
  ): boolean {
    if (!appSecret || typeof appSecret !== 'string' || !appSecret.trim()) {
      return false;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedHex = signatureHeader.substring(7);

    // SHA-256 digest is exactly 64 hexadecimal characters (32 bytes)
    // Check length and format BEFORE timingSafeEqual to avoid RangeError
    if (expectedHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(expectedHex)) {
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', appSecret);
      const calculatedHex = hmac.update(rawBody).digest('hex');

      const expectedBuf = Buffer.from(expectedHex, 'hex');
      const calculatedBuf = Buffer.from(calculatedHex, 'hex');

      if (expectedBuf.length !== calculatedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Resolves tenant configuration by phone_number_id or pathToken
   * Returns null if unknown tenant to prevent information disclosure
   */
  static resolveTenant(
    input: { phoneNumberId?: string; pathToken?: string },
    tenants: TenantRoutingConfig[]
  ): TenantRoutingConfig | null {
    if (!input.phoneNumberId && !input.pathToken) {
      return null;
    }

    const matched = tenants.find((t) => {
      if (input.phoneNumberId && t.phoneNumberId === input.phoneNumberId) {
        return true;
      }
      if (input.pathToken && t.pathToken === input.pathToken) {
        return true;
      }
      return false;
    });

    return matched || null;
  }

  /**
   * Enforces monotonic status transitions
   * Guarantees that "read" cannot be downgraded by delayed "delivered" or "sent"
   */
  static canTransitionStatus(currentStatus: MessageStatus, newStatus: MessageStatus): boolean {
    if (currentStatus === newStatus) {
      return true;
    }

    // Once a message is 'read', it can never be downgraded
    if (currentStatus === 'read') {
      return false;
    }

    // Once 'delivered', it cannot downgrade to 'sent' or 'pending'
    if (currentStatus === 'delivered' && (newStatus === 'sent' || newStatus === 'pending')) {
      return false;
    }

    // A message cannot fail if it has already been delivered
    if (newStatus === 'failed' && currentStatus === 'delivered') {
      return false;
    }

    // Normal monotonic progression (pending -> sent -> delivered -> read)
    return STATUS_RANK[newStatus] >= STATUS_RANK[currentStatus];
  }

  /**
   * Processes incoming message with strict idempotency (scoped per workspace)
   * Resolves any early-arriving pending statuses for this wamid
   */
  static processIncomingMessage(
    workspaceId: string,
    msg: ParsedIncomingMessage,
    messageStore: Message[],
    pendingStatuses: PendingStatusRecord[]
  ): { deduplicated: boolean; message: Message } {
    // 1. Idempotency Check: unique wamid per workspace
    const existing = messageStore.find(
      (m) => m.workspaceId === workspaceId && m.waMessageId === msg.messageId
    );
    if (existing) {
      return { deduplicated: true, message: existing };
    }

    // 2. Early-arriving status resolution
    const earlyStatus = pendingStatuses.find(
      (p) => p.workspaceId === workspaceId && p.waMessageId === msg.messageId && !p.isApplied
    );

    let initialStatus: MessageStatus = 'delivered';
    let errorCode: number | undefined;
    let errorDetails: { code: number; title: string; message: string } | undefined;

    if (earlyStatus) {
      initialStatus = earlyStatus.status;
      errorCode = earlyStatus.errorCode;
      errorDetails = earlyStatus.errorDetails;
      earlyStatus.isApplied = true;
    }

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: `conv_${msg.from.replace(/[^0-9]/g, '')}`,
      workspaceId,
      waMessageId: msg.messageId,
      senderType: 'contact',
      senderName: msg.name,
      messageType: (msg.type as Message['messageType']) || 'text',
      content: msg.body,
      mediaUrl: msg.mediaUrl || (msg.mediaId ? `/api/media/download?mediaId=${msg.mediaId}` : undefined),
      mediaType: msg.mimeType,
      status: initialStatus,
      errorCode,
      errorDetails,
      createdAt: msg.timestamp || new Date().toISOString(),
    };

    messageStore.push(newMessage);
    return { deduplicated: false, message: newMessage };
  }

  /**
   * Processes status updates with monotonic safety and early arrival latching
   */
  static processStatusUpdate(
    workspaceId: string,
    statusUpdate: ParsedStatusUpdate,
    messageStore: Message[],
    pendingStatuses: PendingStatusRecord[]
  ): {
    applied: boolean;
    pending?: boolean;
    reason?: string;
    message?: Message;
    record?: PendingStatusRecord;
  } {
    const message = messageStore.find(
      (m) => m.workspaceId === workspaceId && m.waMessageId === statusUpdate.messageId
    );

    // Case A: Message row exists -> apply status if monotonic
    if (message) {
      if (!this.canTransitionStatus(message.status, statusUpdate.status)) {
        return { applied: false, reason: 'monotonic_rejection', message };
      }

      message.status = statusUpdate.status;
      if (statusUpdate.pricing) {
        message.pricing = statusUpdate.pricing;
      }
      if (statusUpdate.error) {
        message.errorCode = statusUpdate.error.code;
        message.errorDetails = statusUpdate.error;
      }
      return { applied: true, message };
    }

    // Case B: Status arrived before message row exists -> save to pending_statuses
    const pendingRecord: PendingStatusRecord = {
      id: `pend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId,
      waMessageId: statusUpdate.messageId,
      status: statusUpdate.status,
      errorCode: statusUpdate.error?.code,
      errorDetails: statusUpdate.error,
      timestamp: statusUpdate.timestamp || new Date().toISOString(),
      isApplied: false,
    };

    pendingStatuses.push(pendingRecord);
    return { applied: false, pending: true, record: pendingRecord };
  }

  /**
   * Parses Incoming Webhook Payload into normalized events
   */
  static parsePayload(payload: MetaWebhookPayload): {
    phoneNumberId?: string;
    incomingMessages: ParsedIncomingMessage[];
    statusUpdates: ParsedStatusUpdate[];
    templateUpdates: ParsedTemplateUpdate[];
    qualityUpdates: ParsedQualityUpdate[];
  } {
    const incomingMessages: ParsedIncomingMessage[] = [];
    const statusUpdates: ParsedStatusUpdate[] = [];
    const templateUpdates: ParsedTemplateUpdate[] = [];
    const qualityUpdates: ParsedQualityUpdate[] = [];
    let phoneNumberId: string | undefined;

    if (!payload?.entry) {
      return { phoneNumberId, incomingMessages, statusUpdates, templateUpdates, qualityUpdates };
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const val = change.value;
        if (!val) continue;

        if (val.metadata?.phone_number_id) {
          phoneNumberId = val.metadata.phone_number_id;
        }

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
            let mediaId: string | undefined;
            let mimeType: string | undefined;

            interface MetaMediaItem {
              id?: string;
              mime_type?: string;
              filename?: string;
            }

            const rawMsg = msg as unknown as {
              image?: MetaMediaItem;
              video?: MetaMediaItem;
              audio?: MetaMediaItem;
              document?: MetaMediaItem;
            };

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
            } else if (msg.type === 'image' && rawMsg.image) {
              bodyText = '📷 [Photo Attached]';
              mediaId = rawMsg.image.id;
              mimeType = rawMsg.image.mime_type || 'image/jpeg';
            } else if (msg.type === 'video' && rawMsg.video) {
              bodyText = '🎥 [Video Attached]';
              mediaId = rawMsg.video.id;
              mimeType = rawMsg.video.mime_type || 'video/mp4';
            } else if (msg.type === 'audio' && rawMsg.audio) {
              bodyText = '🎵 [Audio Attached]';
              mediaId = rawMsg.audio.id;
              mimeType = rawMsg.audio.mime_type || 'audio/ogg';
            } else if (msg.type === 'document' && rawMsg.document) {
              bodyText = rawMsg.document.filename ? `📄 ${rawMsg.document.filename}` : '📄 [Document Attached]';
              mediaId = rawMsg.document.id;
              mimeType = rawMsg.document.mime_type || 'application/pdf';
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
              mediaId,
              mimeType,
              interactiveSelection,
            });
          }
        }

        // 2. Process Status Receipts
        if (val.statuses) {
          for (const st of val.statuses) {
            const stObj = st as Record<string, unknown>;
            let pricing: ParsedStatusUpdate['pricing'];

            if (stObj.pricing && typeof stObj.pricing === 'object') {
              const pr = stObj.pricing as Record<string, unknown>;
              pricing = {
                billable: Boolean(pr.billable),
                pricingModel: (pr.pricing_model || pr.pricingModel) as string | undefined,
                category: (pr.category as string) || 'service',
                type: pr.type as string | undefined,
              };
            }

            statusUpdates.push({
              messageId: st.id,
              recipientId: st.recipient_id,
              status: st.status as MessageStatus,
              timestamp: new Date(Number(st.timestamp) * 1000).toISOString(),
              pricing,
              error: st.errors?.[0],
            });
          }
        }

        // 3. Process Template Lifecycle Updates (MV-03)
        // VERIFY: Meta field names for template status & category/quality updates
        const valObj = val as Record<string, unknown>;
        const changeField = (change as Record<string, unknown>).field;
        if (
          changeField === 'message_template_status_update' ||
          changeField === 'message_template_quality_update' ||
          (valObj.event && !valObj.current_limit)
        ) {
          templateUpdates.push({
            event: (valObj.event as string) || 'STATUS_UPDATE',
            messageTemplateId: valObj.message_template_id as string | undefined,
            messageTemplateName: valObj.message_template_name as string | undefined,
            messageTemplateLanguage: valObj.message_template_language as string | undefined,
            reason: valObj.reason as string | undefined,
            previousCategory: valObj.previous_category as string | undefined, // VERIFY
            newCategory: valObj.new_category as string | undefined, // VERIFY
            qualityRating: ((valObj.quality_score as Record<string, unknown> | undefined)?.score || valObj.quality_rating) as string | undefined,
          });
        }

        // 4. Process Phone Number Quality & Tier Limit Updates (MV-04)
        if (
          changeField === 'phone_number_quality_update' ||
          valObj.current_limit ||
          (typeof valObj.event === 'string' && valObj.event.startsWith('ON_'))
        ) {
          qualityUpdates.push({
            displayPhoneNumber: valObj.display_phone_number as string | undefined,
            phoneNumberId: valObj.phone_number_id as string | undefined,
            event: valObj.event as string | undefined,
            currentLimit: valObj.current_limit as string | undefined,
            qualityRating: ((valObj.quality_score as Record<string, unknown> | undefined)?.score || valObj.quality_rating) as string | undefined,
          });
        }
      }
    }

    return { phoneNumberId, incomingMessages, statusUpdates, templateUpdates, qualityUpdates };
  }
}
