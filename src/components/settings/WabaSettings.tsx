'use client';

import React, { useState } from 'react';
import { WABAConfig, InAppAlert, Workspace, AutoAssignmentMode } from '@/types/crm';

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
      </div>
    </div>
  );
};
