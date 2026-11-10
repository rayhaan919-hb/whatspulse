'use client';

import React, { useState } from 'react';
import {
  WABAConfig,
  InAppAlert,
  Workspace,
  AutoAssignmentMode,
  WorkspaceApiKey,
  OutboundWebhookSubscription,
  OutboundWebhookDelivery,
} from '@/types/crm';
import { ApiKeyService } from '@/lib/api/api-keys';

interface WabaSettingsProps {
  config: WABAConfig;
  workspace?: Workspace;
  alerts?: InAppAlert[];
  onSaveConfig: (updated: Partial<WABAConfig>) => void;
  onSaveWorkspace?: (updated: Partial<Workspace>) => void;
  onAcknowledgeAlert?: (alertId: string) => void;
}

export const WabaSettings: React.FC<WabaSettingsProps> = ({
  config,
  workspace,
  alerts = [],
  onSaveConfig,
  onSaveWorkspace,
  onAcknowledgeAlert,
}) => {
  const [phoneNumberId, setPhoneNumberId] = useState(config.phoneNumberId);
  const [wabaId, setWabaId] = useState(config.wabaId);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(config.displayPhoneNumber);
  const [accessToken, setAccessToken] = useState(config.accessToken);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [webhookVerifyToken, setWebhookVerifyToken] = useState(config.webhookVerifyToken);
  const [qualityRating] = useState(config.qualityRating || 'GREEN');
  const [messagingLimit] = useState(config.messagingLimit || 'TIER_10K');
  const [allowanceScope, setAllowanceScope] = useState(config.allowanceScope || 'waba');
  const [freeServiceMessages, setFreeServiceMessages] = useState(config.freeServiceMessagesMonthly || 1000);

  // Workspace API Keys State
  const [apiKeys, setApiKeys] = useState<WorkspaceApiKey[]>([
    {
      id: 'key_live_01',
      workspaceId: workspace?.id || 'ws_prod_01',
      name: 'Primary Backend Integration',
      keyPrefix: 'wp_live_8e3f...',
      keyHash: 'hash_not_shown_at_rest',
      createdAt: '2026-10-20T10:00:00Z',
      lastUsedAt: '2026-11-10T22:15:00Z',
    },
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedPlaintextKey, setGeneratedPlaintextKey] = useState<string | null>(null);
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);

  // Outbound Webhooks State
  const [subscriptions, setSubscriptions] = useState<OutboundWebhookSubscription[]>([
    {
      id: 'sub_01',
      workspaceId: workspace?.id || 'ws_prod_01',
      endpointUrl: 'https://api.my-agency.com/webhooks/whatspulse',
      secretKey: 'whsec_9f82d8c1192e4ba9b7a42168fa',
      events: ['message.received', 'message.delivered', 'contact.opt_out'],
      isActive: true,
      createdAt: '2026-11-01T12:00:00Z',
    },
  ]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [showAddWebhookModal, setShowAddWebhookModal] = useState(false);

  // Outbound Webhook Delivery Log State
  const [deliveries, setDeliveries] = useState<OutboundWebhookDelivery[]>([
    {
      id: 'del_01',
      subscriptionId: 'sub_01',
      workspaceId: workspace?.id || 'ws_prod_01',
      event: 'message.received',
      payload: { messageId: 'wamid.HBgLMTAx', from: '+14155552671' },
      responseStatus: 200,
      status: 'delivered',
      attempts: 1,
      createdAt: '2026-11-10T19:42:10Z',
    },
    {
      id: 'del_02',
      subscriptionId: 'sub_01',
      workspaceId: workspace?.id || 'ws_prod_01',
      event: 'message.delivered',
      payload: { messageId: 'wamid.HBgLMTAx', status: 'delivered' },
      responseStatus: 200,
      status: 'delivered',
      attempts: 1,
      createdAt: '2026-11-10T19:42:15Z',
    },
  ]);

  // Inbox Automation & Business Hours State
  const [autoAssignmentMode, setAutoAssignmentMode] = useState<AutoAssignmentMode>(
    workspace?.autoAssignmentMode || 'round_robin'
  );
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(
    workspace?.businessHours?.enabled ?? true
  );
  const [businessHoursTimezone, setBusinessHoursTimezone] = useState(
    workspace?.businessHours?.timezone || 'UTC'
  );
  const [businessHoursReply, setBusinessHoursReply] = useState(
    workspace?.businessHours?.autoReplyMessage ||
      'Thank you for reaching out! We are currently outside of business hours. Our team will respond as soon as we open.'
  );

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const appUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const callbackUrl = `${appUrl}/api/webhooks/whatsapp`;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const { keyRecord, secretKey } = ApiKeyService.generateApiKey(
      workspace?.id || 'ws_prod_01',
      newKeyName.trim()
    );
    setApiKeys((prev) => [keyRecord, ...prev]);
    setGeneratedPlaintextKey(secretKey);
    setNewKeyName('');
  };

  const handleRevokeKey = (keyId: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;
    const newSub: OutboundWebhookSubscription = {
      id: `sub_${Date.now()}`,
      workspaceId: workspace?.id || 'ws_prod_01',
      endpointUrl: newWebhookUrl.trim(),
      secretKey: newWebhookSecret.trim() || `whsec_${Math.random().toString(36).substring(2, 16)}`,
      events: ['message.received', 'message.delivered', 'contact.opt_out'],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setSubscriptions((prev) => [...prev, newSub]);
    setNewWebhookUrl('');
    setNewWebhookSecret('');
    setShowAddWebhookModal(false);
  };

  const handleRetryDelivery = (deliveryId: string) => {
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === deliveryId
          ? {
              ...d,
              attempts: d.attempts + 1,
              responseStatus: 200,
              status: 'delivered',
              createdAt: new Date().toISOString(),
              lastError: undefined,
            }
          : d
      )
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      phoneNumberId,
      wabaId,
      displayPhoneNumber,
      accessToken,
      webhookVerifyToken,
      qualityRating,
      messagingLimit,
      allowanceScope,
      freeServiceMessagesMonthly: freeServiceMessages,
    });

    if (onSaveWorkspace) {
      onSaveWorkspace({
        autoAssignmentMode,
        businessHours: {
          enabled: businessHoursEnabled,
          timezone: businessHoursTimezone,
          schedule: workspace?.businessHours?.schedule || {
            1: { open: '09:00', close: '18:00' },
            2: { open: '09:00', close: '18:00' },
            3: { open: '09:00', close: '18:00' },
            4: { open: '09:00', close: '18:00' },
            5: { open: '09:00', close: '18:00' },
          },
          autoReplyMessage: businessHoursReply,
        },
      });
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fffcec] p-4 md:p-8 select-text">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight">
            WhatsApp Business API &amp; Automation Settings
          </h2>
          <p className="text-xs text-[#696969] mt-1">
            Configure Meta Cloud API credentials, auto-assignment rules, business operating schedules, and compliance allowances.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Credentials */}
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <h3 className="text-sm font-bold text-black border-b border-black/10 pb-2">
              Meta Cloud API Credentials
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 109283746501928"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none focus:border-[#3139fb]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  WhatsApp Business Account (WABA) ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 981273645019283"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none focus:border-[#3139fb]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Display Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. +1 555 019 2834"
                value={displayPhoneNumber}
                onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none focus:border-[#3139fb]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-black">
                  System User Permanent Access Token
                </label>
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  className="text-xs text-[#3139fb] hover:underline cursor-pointer"
                >
                  {showAccessToken ? 'Mask Token' : 'Reveal Token'}
                </button>
              </div>
              <input
                type={showAccessToken ? 'text' : 'password'}
                placeholder="EAAG..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none focus:border-[#3139fb]"
              />
              <p className="text-[10px] text-[#696969] mt-1">
                🔒 Access tokens are encrypted at rest with AES-256-GCM. Never logged or exposed to client-side queries.
              </p>
            </div>
          </div>

          {/* Section 2: Inbox Productivity & Business Hours */}
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <h3 className="text-sm font-bold text-black border-b border-black/10 pb-2">
              Inbox Productivity &amp; Auto-Assignment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Conversational Auto-Assignment
                </label>
                <select
                  value={autoAssignmentMode}
                  onChange={(e) => setAutoAssignmentMode(e.target.value as AutoAssignmentMode)}
                  className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-medium outline-none focus:border-[#3139fb]"
                >
                  <option value="round_robin">Round-Robin (Cycles online agents evenly)</option>
                  <option value="least_loaded">Least-Loaded (Routes to agent with fewest open chats)</option>
                  <option value="disabled">Disabled (Manual assignment only)</option>
                </select>
                <p className="text-[10px] text-[#696969] mt-1">
                  Automatically assigns new incoming WhatsApp chats to available team members.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Business Timezone
                </label>
                <select
                  value={businessHoursTimezone}
                  onChange={(e) => setBusinessHoursTimezone(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none focus:border-[#3139fb]"
                >
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
                <p className="text-[10px] text-[#696969] mt-1">
                  Operating schedule runs Monday through Friday 09:00 - 18:00 in selected timezone.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="businessHoursEnabled"
                  checked={businessHoursEnabled}
                  onChange={(e) => setBusinessHoursEnabled(e.target.checked)}
                  className="rounded border-black/20 text-[#3139fb] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="businessHoursEnabled" className="text-xs font-bold text-black cursor-pointer">
                  Enable automated after-hours response outside business hours
                </label>
              </div>
              {businessHoursEnabled && (
                <div className="space-y-1">
                  <textarea
                    rows={2}
                    value={businessHoursReply}
                    onChange={(e) => setBusinessHoursReply(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs outline-none focus:border-[#3139fb]"
                    placeholder="Enter automated greeting for after-hours inquiries..."
                  />
                  <p className="text-[10px] text-[#3139fb] font-medium">
                    🛡️ Rate &amp; Cost Safeguard: Dispatched at most ONCE per conversation per closed period to prevent billable loops.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Webhook Endpoint Handshake */}
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <h3 className="text-sm font-bold text-black border-b border-black/10 pb-2">
              Meta Webhook Configuration
            </h3>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Callback URL (Copy into Meta App Dashboard)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={callbackUrl}
                  className="flex-1 p-2.5 rounded-[8px] border border-black/20 bg-black/5 text-xs font-mono text-[#696969] outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(callbackUrl, 'callback')}
                  className="px-4 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] rounded-[8px] text-xs font-bold cursor-pointer transition-all"
                >
                  {copiedField === 'callback' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Verify Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookVerifyToken}
                  onChange={(e) => setWebhookVerifyToken(e.target.value)}
                  className="flex-1 p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none focus:border-[#3139fb]"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(webhookVerifyToken, 'token')}
                  className="px-4 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] rounded-[8px] text-xs font-bold cursor-pointer transition-all"
                >
                  {copiedField === 'token' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Quality, Limits & Allowance */}
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <h3 className="text-sm font-bold text-black border-b border-black/10 pb-2">
              Health, Messaging Limits &amp; Billing Allowance
            </h3>

            {/* Quality Alerts Banner */}
            {alerts.filter((a) => !a.acknowledged).length > 0 && (
              <div className="space-y-2">
                {alerts
                  .filter((a) => !a.acknowledged)
                  .map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3.5 rounded-[8px] border text-xs flex items-start justify-between gap-3 ${
                        alert.level === 'danger'
                          ? 'bg-[#ff0033]/10 border-[#ff0033]/30 text-black'
                          : 'bg-[#ff9900]/10 border-[#ff9900]/30 text-black'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{alert.title}</span>
                          <span className="text-[10px] font-mono opacity-60">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#696969] leading-relaxed">
                          {alert.message}
                        </p>
                      </div>
                      {onAcknowledgeAlert && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded bg-black text-[#fffcec] shrink-0 hover:bg-[#3139fb]"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quality Rating */}
              <div className="p-3.5 rounded-[8px] bg-[#fffcec] border border-black/15 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-black">
                  <span>Quality Rating</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      qualityRating === 'GREEN'
                        ? 'bg-[#00c853]/15 text-[#00a843]'
                        : qualityRating === 'YELLOW'
                        ? 'bg-[#ff9900]/15 text-[#e68a00]'
                        : 'bg-[#ff0033]/15 text-[#cc0029]'
                    }`}
                  >
                    ● {qualityRating}
                  </span>
                </div>
                <p className="text-[11px] text-[#696969]">
                  {qualityRating === 'GREEN'
                    ? 'High Quality — Messages delivered normally with low report rates.'
                    : qualityRating === 'YELLOW'
                    ? 'Medium Warning — Elevated spam reports. Action required.'
                    : 'Critical Danger — Immediate risk of account block by Meta.'}
                </p>
              </div>

              {/* Messaging Limit Tier */}
              <div className="p-3.5 rounded-[8px] bg-[#fffcec] border border-black/15 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-black">
                  <span>Messaging Limit Tier</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/10 text-black">
                    {messagingLimit}
                  </span>
                </div>
                <p className="text-[11px] text-[#696969]">
                  {messagingLimit === 'TIER_1K' && '1,000 unique customers per rolling 24-hour period.'}
                  {messagingLimit === 'TIER_10K' && '10,000 unique customers per rolling 24-hour period.'}
                  {messagingLimit === 'TIER_100K' && '100,000 unique customers per rolling 24-hour period.'}
                  {messagingLimit === 'TIER_UNLIMITED' && 'Unlimited unique customer conversations per 24 hours.'}
                </p>
              </div>

              {/* Free Allowance Scope (// VERIFY) */}
              <div className="p-3.5 rounded-[8px] bg-[#fffcec] border border-black/15 space-y-2">
                <label className="block text-xs font-bold text-black">
                  <span>Free Allowance Scope</span>
                  <span className="text-[9px] font-mono ml-1.5 text-[#3139fb]">{'// VERIFY'}</span>
                </label>
                <select
                  value={allowanceScope}
                  onChange={(e) => setAllowanceScope(e.target.value as 'waba' | 'phone_number')}
                  className="w-full p-2 rounded-[6px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none"
                >
                  <option value="waba">Per WABA Portfolio (Shared across numbers)</option>
                  <option value="phone_number">Per Phone Number (Independent pool)</option>
                </select>
                <p className="text-[10px] text-[#696969]">
                  Determines whether the 1,000 monthly free tier pool is shared or per registered number.
                </p>
              </div>

              {/* Monthly Free Messages */}
              <div className="p-3.5 rounded-[8px] bg-[#fffcec] border border-black/15 space-y-2">
                <label className="block text-xs font-bold text-black">
                  <span>Monthly Free Service Messages</span>
                  <span className="text-[9px] font-mono ml-1.5 text-[#3139fb]">{'// VERIFY'}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={freeServiceMessages}
                  onChange={(e) => setFreeServiceMessages(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 rounded-[6px] border border-black/20 bg-[#fffcec] text-xs font-mono outline-none"
                />
                <p className="text-[10px] text-[#696969]">
                  First 1,000 service customer replies each month are free of Meta fees.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Workspace API Keys (REST API) */}
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-2">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <span>Workspace API Keys</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#3139fb]/10 text-[#3139fb]">
                    REST API
                  </span>
                </h3>
                <p className="text-[11px] text-[#696969] mt-0.5">
                  Generate API keys to manage messages, contacts, and conversations via the REST API. Keys are SHA-256 hashed at rest.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGeneratedPlaintextKey(null);
                  setShowGenerateKeyModal(true);
                }}
                className="px-3 py-1.5 bg-black hover:bg-[#000354] text-[#fffcec] text-xs font-semibold rounded-[6px] transition-all cursor-pointer"
              >
                + Generate Key
              </button>
            </div>

            {/* Active Keys Table */}
            <div className="bg-[#fffcec] rounded-[8px] border border-black/10 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/5 text-[#696969] font-bold border-b border-black/10 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Key Prefix</th>
                    <th className="p-2.5">Created</th>
                    <th className="p-2.5">Last Used</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 font-mono text-[11px]">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-[#696969] font-sans text-xs">
                        No API keys generated yet. Click &quot;+ Generate Key&quot; to create your first key.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-[#f7f4e3]/40">
                        <td className="p-2.5 font-sans font-semibold text-black">{key.name}</td>
                        <td className="p-2.5 text-[#3139fb] font-bold">{key.keyPrefix}</td>
                        <td className="p-2.5 text-[#696969]">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-2.5 text-[#696969]">
                          {key.lastUsedAt
                            ? new Date(key.lastUsedAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-semibold cursor-pointer"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* REST API & OpenAPI Spec documentation snippet */}
            <div className="p-3 bg-[#fffcec] rounded-[8px] border border-black/10 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-black">REST API Quick Reference</span>
                <span className="text-[#3139fb] font-mono text-[10px]">OpenAPI 3.1: docs/openapi.yaml</span>
              </div>
              <div className="bg-black/5 p-2 rounded font-mono text-[11px] text-black overflow-x-auto">
                curl -X POST &apos;{appUrl}/api/v1/messages&apos; \<br />
                &nbsp;&nbsp;-H &apos;Authorization: Bearer wp_live_...&apos; \<br />
                &nbsp;&nbsp;-H &apos;Content-Type: application/json&apos; \<br />
                &nbsp;&nbsp;-d &apos;&#123;&quot;to&quot;: &quot;+14155552671&quot;, &quot;content&quot;: &quot;Hello from API&quot;&#125;&apos;
              </div>
            </div>
          </div>

          {/* Section 5: Outbound Webhooks & Delivery Log */}
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-2">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <span>Outbound Webhooks &amp; Delivery Engine</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    HMAC-SHA256 Signed
                  </span>
                </h3>
                <p className="text-[11px] text-[#696969] mt-0.5">
                  Stream CRM events to external endpoints with HMAC signing and replay attack tolerance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWebhookModal(true)}
                className="px-3 py-1.5 bg-black hover:bg-[#000354] text-[#fffcec] text-xs font-semibold rounded-[6px] transition-all cursor-pointer"
              >
                + Add Endpoint
              </button>
            </div>

            {/* Subscriptions List */}
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 bg-[#fffcec] rounded-[8px] border border-black/10 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-black truncate">{sub.endpointUrl}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {sub.events.map((evt) => (
                        <span
                          key={evt}
                          className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-black/5 text-[#696969]"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id))}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Outbound Delivery Log */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-black uppercase tracking-wider text-[10px] text-[#696969]">
                Recent Delivery Logs
              </h4>
              <div className="bg-[#fffcec] rounded-[8px] border border-black/10 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/5 text-[#696969] font-bold border-b border-black/10 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Event</th>
                      <th className="p-2.5">Endpoint</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Attempts</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10 font-mono text-[11px]">
                    {deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-[#f7f4e3]/40">
                        <td className="p-2.5 text-black font-semibold font-sans">{del.event}</td>
                        <td className="p-2.5 text-[#696969] truncate max-w-[140px]">{del.subscriptionId || 'External'}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              del.responseStatus === 200
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {del.responseStatus || del.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-[#696969]">{del.attempts}</td>
                        <td className="p-2.5 text-[#696969]">
                          {new Date(del.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleRetryDelivery(del.id)}
                            className="text-[#3139fb] hover:underline text-xs font-semibold cursor-pointer"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-4">
            {saveSuccess ? (
              <span className="text-xs font-bold text-[#fffcec] bg-[#3139fb] px-3 py-1.5 rounded-[8px]">
                ✓ Settings Saved Successfully!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs rounded-[8px] shadow-xs transition-all cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </form>

        {/* Modal: Generate API Key */}
        {showGenerateKeyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[#fffcec] border border-black/20 rounded-[14px] p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-black">
                {generatedPlaintextKey ? 'API Key Generated' : 'Create New API Key'}
              </h3>

              {!generatedPlaintextKey ? (
                <form onSubmit={handleGenerateKey} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Key Name / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Zapier Webhook, Production App"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-[8px] border border-black/20 bg-[#f7f4e3] outline-none focus:border-[#3139fb]"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="text-[11px] text-[#696969]">
                    Keys are generated with prefix <code className="font-mono bg-black/5 px-1 py-0.5 rounded">wp_live_</code> and hashed at rest using SHA-256.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowGenerateKeyModal(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-[#696969] hover:text-black cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#3139fb] text-[#fffcec] text-xs font-bold rounded-[8px] hover:bg-[#000354] cursor-pointer"
                    >
                      Generate Key
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-[11px] text-amber-900 leading-relaxed">
                    ⚠️ <strong>Store this key securely now!</strong> WhatsPulse hashes keys with SHA-256 and will never display this plaintext secret again.
                  </div>

                  <div className="p-3 bg-black text-[#fffcec] font-mono text-xs rounded-[8px] break-all select-all flex items-center justify-between gap-2">
                    <span>{generatedPlaintextKey}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedPlaintextKey, 'api_key')}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] shrink-0 font-sans font-bold cursor-pointer"
                    >
                      {copiedField === 'api_key' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGenerateKeyModal(false);
                        setGeneratedPlaintextKey(null);
                      }}
                      className="px-4 py-2 bg-black hover:bg-[#000354] text-[#fffcec] text-xs font-bold rounded-[8px] cursor-pointer"
                    >
                      I Have Stored My Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Add Outbound Webhook */}
        {showAddWebhookModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[#fffcec] border border-black/20 rounded-[14px] p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-black">Register Outbound Webhook</h3>
              <form onSubmit={handleAddWebhook} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Destination URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.your-system.com/webhooks/whatspulse"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-[8px] border border-black/20 bg-[#f7f4e3] font-mono outline-none focus:border-[#3139fb]"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    HMAC Secret Token (Optional - auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    placeholder="whsec_..."
                    value={newWebhookSecret}
                    onChange={(e) => setNewWebhookSecret(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-[8px] border border-black/20 bg-[#f7f4e3] font-mono outline-none focus:border-[#3139fb]"
                  />
                  <p className="text-[10px] text-[#696969] mt-1">
                    Included in signature header <code className="font-mono bg-black/5 px-1 py-0.5 rounded">X-WhatsPulse-Signature-256</code>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddWebhookModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#696969] hover:text-black cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#3139fb] text-[#fffcec] text-xs font-bold rounded-[8px] hover:bg-[#000354] cursor-pointer"
                  >
                    Register Webhook
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
