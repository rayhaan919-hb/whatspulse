'use client';

import React, { useState } from 'react';
import { WABAConfig } from '@/types/crm';

interface WabaSettingsProps {
  config: WABAConfig;
  onSaveConfig: (updated: Partial<WABAConfig>) => void;
}

export const WabaSettings: React.FC<WabaSettingsProps> = ({
  config,
  onSaveConfig,
}) => {
  const [phoneNumberId, setPhoneNumberId] = useState(config.phoneNumberId);
  const [wabaId, setWabaId] = useState(config.wabaId);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(config.displayPhoneNumber);
  const [accessToken, setAccessToken] = useState(config.accessToken);
  const [webhookVerifyToken, setWebhookVerifyToken] = useState(config.webhookVerifyToken);
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
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 bg-[#fffcec] select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="font-eyebrow text-[10px] text-[#3139fb] font-bold mb-1">
            WHATSAPP SETUP GUIDE
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-black tracking-[-1.2px]">
            Connect Your WhatsApp Business Number
          </h2>
          <p className="text-sm text-[#696969] mt-1 max-w-2xl">
            Follow these 2 simple steps to connect your official Meta WhatsApp Business account. No coding required.
          </p>
        </div>

        {/* Step 1: Copy Webhook URL to Meta */}
        <div className="p-6 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-black text-[#fffcec] text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h3 className="font-bold text-sm text-black">
              Copy Your Webhook Details Into Meta Developer Portal
            </h3>
          </div>
          <p className="text-xs text-[#696969] leading-relaxed">
            In your <strong>Meta App Dashboard &rarr; WhatsApp &rarr; Configuration</strong>, paste these two values so WhatsPulse can receive incoming messages in real time:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-black mb-1.5">
                Callback URL
              </label>
              <div className="flex items-center gap-2 bg-[#fffcec] p-2 rounded-[8px] border border-black/20">
                <input
                  readOnly
                  value={callbackUrl}
                  className="flex-1 text-xs font-mono bg-transparent text-black outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(callbackUrl, 'url')}
                  className="px-3 py-1.5 text-xs font-bold bg-black text-[#fffcec] rounded-[6px] hover:bg-[#000354] shrink-0"
                >
                  {copiedField === 'url' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1.5">
                Verify Token
              </label>
              <div className="flex items-center gap-2 bg-[#fffcec] p-2 rounded-[8px] border border-black/20">
                <input
                  readOnly
                  value={webhookVerifyToken}
                  className="flex-1 text-xs font-mono bg-transparent text-black outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(webhookVerifyToken, 'token')}
                  className="px-3 py-1.5 text-xs font-bold bg-black text-[#fffcec] rounded-[6px] hover:bg-[#000354] shrink-0"
                >
                  {copiedField === 'token' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Enter Your API Keys */}
        <form
          onSubmit={handleSave}
          className="p-6 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-5"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-black text-[#fffcec] text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="font-bold text-sm text-black">
              Enter Your WhatsApp Cloud API Keys
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Your WhatsApp Phone Number
              </label>
              <input
                type="text"
                required
                placeholder="+1 (555) 019-2834"
                value={displayPhoneNumber}
                onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono focus:border-[#3139fb] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Phone Number ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 10592837465"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono focus:border-[#3139fb] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                WhatsApp Business Account (WABA) ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 99887766554"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono focus:border-[#3139fb] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                Webhook Verify Token
              </label>
              <input
                type="text"
                required
                value={webhookVerifyToken}
                onChange={(e) => setWebhookVerifyToken(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono focus:border-[#3139fb] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-black mb-1">
              Permanent Access Token
            </label>
            <input
              type="password"
              required
              placeholder="EAAGm0PX4ZCpsBA..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono focus:border-[#3139fb] outline-none"
            />
            <p className="text-[11px] text-[#696969] mt-1">
              Found under <strong>Meta Business Settings &rarr; System Users</strong>.
            </p>
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
              className="px-6 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs rounded-[8px] shadow-xs transition-all"
            >
              Save WhatsApp Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
