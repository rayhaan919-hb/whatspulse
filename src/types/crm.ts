// WhatsPulse CRM Core Domain Types
// Fully aligned with Meta WhatsApp Cloud API v20+ Specifications

export type SenderType = 'contact' | 'agent' | 'bot' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'interactive' | 'template';
export type ConversationStatus = 'open' | 'pending' | 'resolved';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type UserRole = 'owner' | 'admin' | 'agent';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'agency';
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  isOnline?: boolean;
}

export interface WABAConfig {
  id: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber: string;
  accessToken: string;
  webhookVerifyToken: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED';
  isActive: boolean;
}

export type OptStatus = 'opted_in' | 'opted_out' | 'unknown';

export interface Contact {
  id: string;
  workspaceId: string;
  phoneNumber: string; // E.164 formatted (e.g. +14155552671)
  name: string;
  email?: string;
  avatarUrl?: string;
  tags: string[];
  customAttributes: Record<string, string>;
  optStatus?: OptStatus;
  isBlocked?: boolean;
  lastInteractionAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  workspaceId: string;
  waMessageId?: string; // wamid.HBgL...
  senderType: SenderType;
  senderId?: string;
  senderName?: string;
  messageType: MessageType;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  interactiveData?: {
    type?: 'button' | 'list';
    buttons?: Array<{ id: string; title: string }>;
    selectedButtonId?: string;
  };
  status: MessageStatus;
  errorCode?: number;
  errorDetails?: { code: number; title: string; message: string } | string;
  isInternalNote?: boolean;
  createdAt: string;
}

export interface WebhookEventRecord {
  id: string;
  workspaceId?: string;
  phoneNumberId?: string;
  payload: MetaWebhookPayload;
  receivedAt: string;
  processedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  lastError?: string;
}

export interface PendingStatusRecord {
  id: string;
  workspaceId: string;
  waMessageId: string;
  status: MessageStatus;
  errorCode?: number;
  errorDetails?: { code: number; title: string; message: string };
  timestamp: string;
  isApplied: boolean;
}

export interface TenantRoutingConfig {
  workspaceId: string;
  phoneNumberId: string;
  pathToken?: string;
  appSecret: string;
  webhookVerifyToken: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  contactId: string;
  contact: Contact;
  assignedTo?: string; // WorkspaceMember id
  assignedAgent?: WorkspaceMember;
  status: ConversationStatus;
  priority: ConversationPriority;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastInboundAt?: string;
  fepExpiresAt?: string;
  tags: string[];
}

export interface OutboundJob {
  id: string;
  workspaceId: string;
  campaignId?: string;
  jobType: 'single' | 'broadcast';
  status: 'queued' | 'running' | 'completed' | 'paused' | 'failed';
  totalCount: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  batchSize: number;
  rateLimitPerSecond: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecipient {
  id: string;
  jobId: string;
  contactId?: string;
  phoneNumber: string;
  optStatus?: OptStatus;
  status: 'pending' | 'processing' | 'sent' | 'skipped' | 'failed';
  waMessageId?: string;
  errorCode?: number;
  errorMessage?: string;
  retryCount: number;
  nextRetryAt?: string;
  sentAt?: string;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  workspaceId: string;
  metaTemplateId?: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
  header?: string;
  headerType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'NONE';
  body: string; // Contains placeholders like {{1}}, {{2}}
  footer?: string;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; value?: string }>;
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  variableCount?: number;
}

export interface WorkspaceSecret {
  id: string;
  workspaceId: string;
  keyVersion: string;
  accessTokenEncrypted: string;
  appSecretEncrypted?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastCampaign {
  id: string;
  workspaceId: string;
  templateId: string;
  templateName: string;
  name: string;
  targetTags: string[];
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'canceled';
  scheduledAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Meta WhatsApp Cloud API Webhook Types
export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string };
          button?: { payload: string; text: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string; message: string }>;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}
