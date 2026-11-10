// Central Data Store & State Engine for WhatsPulse CRM
// Provides persistent workspace state, clean production baselines, and demo datasets

import {
  Workspace,
  WorkspaceMember,
  WABAConfig,
  Contact,
  Conversation,
  Message,
  MessageTemplate,
  BroadcastCampaign,
  CannedReply,
} from '@/types/crm';

export const CLEAN_WORKSPACE: Workspace = {
  id: 'ws_prod_01',
  name: 'My WhatsApp Business',
  slug: 'my-business',
  plan: 'pro',
  createdAt: new Date().toISOString(),
  autoAssignmentMode: 'round_robin',
  businessHours: {
    enabled: true,
    timezone: 'UTC',
    schedule: {
      1: { open: '09:00', close: '18:00' },
      2: { open: '09:00', close: '18:00' },
      3: { open: '09:00', close: '18:00' },
      4: { open: '09:00', close: '18:00' },
      5: { open: '09:00', close: '18:00' },
    },
    autoReplyMessage: 'Thank you for reaching out! We are currently outside of business hours. Our team will respond as soon as we open.',
  },
};

export const DEFAULT_CANNED_REPLIES: CannedReply[] = [
  {
    id: 'cr_1',
    workspaceId: 'ws_prod_01',
    shortcut: 'refund',
    title: 'Refund Policy & SLA',
    content: 'Hi {{contact_name}}, our refund processing takes 3-5 business days. Your request is being handled by {{agent_name}}.',
    category: 'support',
  },
  {
    id: 'cr_2',
    workspaceId: 'ws_prod_01',
    shortcut: 'hours',
    title: 'Business Hours',
    content: 'Hi {{contact_name}}, our support desk is active Monday through Friday, 9:00 AM to 6:00 PM UTC.',
    category: 'general',
  },
  {
    id: 'cr_3',
    workspaceId: 'ws_prod_01',
    shortcut: 'escalate',
    title: 'Senior Escalation',
    content: 'Hello {{contact_name}}, I have escalated your inquiry to our senior technical lead. We will update you here shortly.',
    category: 'support',
  },
  {
    id: 'cr_4',
    workspaceId: 'ws_prod_01',
    shortcut: 'pricing',
    title: 'Product Pricing & Plans',
    content: 'Hi {{contact_name}}, our pricing plans start from $29/mo with full WhatsApp Business Cloud API access and CRM features.',
    category: 'sales',
  },
];

export const CLEAN_MEMBERS: WorkspaceMember[] = [
  {
    id: 'mem_admin_01',
    workspaceId: 'ws_prod_01',
    email: 'admin@mybusiness.com',
    fullName: 'Support Admin',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    role: 'owner',
    isOnline: true,
  },
];

export const CLEAN_WABA_CONFIG: WABAConfig = {
  id: 'waba_cfg_prod',
  workspaceId: 'ws_prod_01',
  phoneNumberId: '',
  wabaId: '',
  displayPhoneNumber: '',
  accessToken: '',
  webhookVerifyToken: '',
  qualityRating: 'GREEN',
  isActive: false,
};

// Default pre-approved standard Meta utility templates
export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tmpl_01',
    workspaceId: 'ws_prod_01',
    metaTemplateId: 'meta_tmpl_01',
    name: 'order_status_update',
    category: 'UTILITY',
    language: 'en_US',
    status: 'APPROVED',
    header: 'Order Update',
    body: 'Hi {{1}}, your order {{2}} has been confirmed. Track here: {{3}}',
    footer: 'Customer Support',
    buttons: [{ type: 'URL', text: 'Track Order', value: 'https://example.com' }],
  },
  {
    id: 'tmpl_02',
    workspaceId: 'ws_prod_01',
    metaTemplateId: 'meta_tmpl_02',
    name: 'customer_welcome_greeting',
    category: 'MARKETING',
    language: 'en_US',
    status: 'APPROVED',
    header: 'Welcome to Our Store',
    body: 'Hello {{1}}! Thank you for reaching out. How can our team assist you today?',
    footer: 'Reply STOP to unsubscribe',
    buttons: [{ type: 'QUICK_REPLY', text: 'Talk to Agent' }],
  },
];

// --- DEMO DATASET (Available for preview / sandbox testing - tagged with isDemo: true) ---

export const DEMO_WORKSPACE: Workspace = {
  id: 'ws_demo_01',
  name: 'PulseCommerce Worldwide (Demo)',
  slug: 'pulsecommerce-demo',
  plan: 'agency',
  isDemo: true,
  createdAt: '2026-01-15T08:00:00Z',
  autoAssignmentMode: 'round_robin',
  businessHours: {
    enabled: true,
    timezone: 'UTC',
    schedule: {
      1: { open: '09:00', close: '18:00' },
      2: { open: '09:00', close: '18:00' },
      3: { open: '09:00', close: '18:00' },
      4: { open: '09:00', close: '18:00' },
      5: { open: '09:00', close: '18:00' },
    },
    autoReplyMessage: 'Thank you for reaching out to PulseCommerce! We are currently outside business hours (Mon-Fri 9am-6pm UTC). Our team will respond promptly upon opening.',
  },
};

export const DEMO_MEMBERS: WorkspaceMember[] = [
  {
    id: 'mem_01',
    workspaceId: 'ws_demo_01',
    email: 'sarah.admin@pulsecommerce.com',
    fullName: 'Sarah Jenkins',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    role: 'owner',
    isOnline: true,
  },
  {
    id: 'mem_02',
    workspaceId: 'ws_demo_01',
    email: 'alex.support@pulsecommerce.com',
    fullName: 'Alex Rivera',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    role: 'agent',
    isOnline: true,
  },
  {
    id: 'mem_03',
    workspaceId: 'ws_demo_01',
    email: 'elena.sales@pulsecommerce.com',
    fullName: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    role: 'agent',
    isOnline: false,
  },
];

export const DEMO_WABA_CONFIG: WABAConfig = {
  id: 'waba_cfg_demo',
  workspaceId: 'ws_demo_01',
  phoneNumberId: '109847291823749',
  wabaId: '298374918237491',
  displayPhoneNumber: '+1 (555) 019-2834',
  accessToken: 'EAAG...whatspulse_demo_meta_token',
  webhookVerifyToken: 'whatspulse_secret_token_123',
  qualityRating: 'GREEN',
  isActive: true,
};

export const DEMO_CONTACTS: Contact[] = [
  {
    id: 'cnt_01',
    workspaceId: 'ws_demo_01',
    phoneNumber: '+14155552671',
    name: 'Marcus Vance',
    email: 'marcus@vancetech.io',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    tags: ['VIP Client', 'Enterprise'],
    customAttributes: {
      Company: 'Vance Technologies',
      'Account Tier': 'Gold ($5,000/mo)',
      Country: 'United States',
    },
    isDemo: true,
    lastInteractionAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: 'cnt_02',
    workspaceId: 'ws_demo_01',
    phoneNumber: '+447911123456',
    name: 'Clara Oswald',
    email: 'clara@oswaldtravel.co.uk',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    tags: ['Lead - High Intent', 'Wholesale'],
    customAttributes: {
      Company: 'Oswald Agency UK',
      Country: 'United Kingdom',
    },
    isDemo: true,
    lastInteractionAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
];

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_01',
    workspaceId: 'ws_demo_01',
    contactId: 'cnt_01',
    contact: { ...DEMO_CONTACTS[0], isDemo: true },
    assignedTo: 'mem_01',
    assignedAgent: DEMO_MEMBERS[0],
    status: 'open',
    priority: 'urgent',
    unreadCount: 1,
    lastMessagePreview: 'Can you confirm if our dedicated account manager has verified the contract extension?',
    lastMessageAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    lastInboundAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    tags: ['VIP Client', 'Enterprise'],
    labels: ['VIP', 'Enterprise', 'Contract'],
    snoozedUntil: null,
    isDemo: true,
  },
  {
    id: 'conv_02',
    workspaceId: 'ws_demo_01',
    contactId: 'cnt_02',
    contact: { ...DEMO_CONTACTS[1], isDemo: true },
    assignedTo: 'mem_02',
    assignedAgent: DEMO_MEMBERS[1],
    status: 'open',
    priority: 'high',
    unreadCount: 0,
    lastMessagePreview: 'Here is the quotation document for 500 units. Please let us know if you need modifications.',
    lastMessageAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    lastInboundAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(), // >24h: Care Window Closed (Template Only)
    tags: ['Lead - High Intent'],
    labels: ['Sales', 'Quote'],
    snoozedUntil: null,
    isDemo: true,
  },
];

export const DEMO_MESSAGES: Message[] = [
  {
    id: 'msg_101',
    conversationId: 'conv_01',
    workspaceId: 'ws_demo_01',
    waMessageId: 'wamid.HBgLMTAx',
    senderType: 'contact',
    senderName: 'Marcus Vance',
    messageType: 'text',
    content: 'Hi Sarah, checking in regarding our Q4 enterprise expansion agreement.',
    status: 'read',
    isDemo: true,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_102',
    conversationId: 'conv_01',
    workspaceId: 'ws_demo_01',
    senderType: 'agent',
    senderId: 'mem_01',
    senderName: 'Sarah Jenkins',
    messageType: 'text',
    content: 'Hello Marcus! Good to hear from you. The legal team reviewed the SLA addendum this morning.',
    status: 'read',
    isDemo: true,
    createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_103',
    conversationId: 'conv_01',
    workspaceId: 'ws_demo_01',
    senderType: 'agent',
    senderId: 'mem_01',
    senderName: 'Sarah Jenkins',
    messageType: 'text',
    content: 'Client requested guaranteed 99.99% uptime with 15-minute response SLA.',
    status: 'read',
    isInternalNote: true,
    isDemo: true,
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_104',
    conversationId: 'conv_01',
    workspaceId: 'ws_demo_01',
    waMessageId: 'wamid.HBgLMTA0',
    senderType: 'contact',
    senderName: 'Marcus Vance',
    messageType: 'text',
    content: 'Can you confirm if our dedicated account manager has verified the contract extension?',
    status: 'delivered',
    isDemo: true,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
];

export const DEMO_CAMPAIGNS: BroadcastCampaign[] = [
  {
    id: 'camp_01',
    workspaceId: 'ws_demo_01',
    templateId: 'tmpl_01',
    templateName: 'order_status_update',
    name: 'Q4 VIP Customer Promotion',
    targetTags: ['VIP Client', 'Enterprise'],
    totalRecipients: 1250,
    sentCount: 1250,
    deliveredCount: 1218,
    readCount: 1042,
    failedCount: 32,
    status: 'completed',
    isDemo: true,
    completedAt: '2026-10-28T14:30:00Z',
    createdAt: '2026-10-28T10:00:00Z',
  },
];
