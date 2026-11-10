'use client';

import React, { useState } from 'react';
import { Contact, MetaWebhookPayload } from '@/types/crm';

interface WebhookSimulatorProps {
  contacts: Contact[];
  onTriggerWebhook: (payload: MetaWebhookPayload) => Promise<void>;
  onNavigateToInbox?: () => void;
}

export const WebhookSimulator: React.FC<WebhookSimulatorProps> = ({
  contacts,
  onTriggerWebhook,
  onNavigateToInbox,
}) => {
  const [selectedContactPhone, setSelectedContactPhone] = useState(
    contacts[0]?.phoneNumber || '+14155552671'
  );
  const [senderName, setSenderName] = useState(contacts[0]?.name || 'Alex Morgan');
  const [messageBody, setMessageBody] = useState(
    'Hi! I have a question about my order.'
  );
  const [simulatedEventType, setSimulatedEventType] = useState<
    'text' | 'button_click' | 'status_read'
  >('text');
  const [buttonId, setButtonId] = useState('btn_confirm');
  const [buttonTitle, setButtonTitle] = useState('Confirm Order');
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastPayloadJson, setLastPayloadJson] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showDeveloperJson, setShowDeveloperJson] = useState(false);

  const handleContactSelect = (phone: string) => {
    setSelectedContactPhone(phone);
    const found = contacts.find((c) => c.phoneNumber === phone);
    if (found) setSenderName(found.name);
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setStatusMessage('');

    const cleanNumber = selectedContactPhone.replace(/[^0-9]/g, '') || '14155552671';
    const timestampStr = Math.floor(Date.now() / 1000).toString();
    const simulatedMsgId = `wamid.HBgL_SIM_${Date.now()}`;

    let payload: MetaWebhookPayload;

    if (simulatedEventType === 'text') {
      payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '298374918237491',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1 (555) 019-2834',
                    phone_number_id: '109847291823749',
                  },
                  contacts: [
                    {
                      profile: { name: senderName || 'Customer' },
                      wa_id: cleanNumber,
                    },
                  ],
                  messages: [
                    {
                      from: cleanNumber,
                      id: simulatedMsgId,
                      timestamp: timestampStr,
                      type: 'text',
                      text: { body: messageBody },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };
    } else if (simulatedEventType === 'button_click') {
      payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '298374918237491',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1 (555) 019-2834',
                    phone_number_id: '109847291823749',
                  },
                  contacts: [
                    {
                      profile: { name: senderName || 'Customer' },
                      wa_id: cleanNumber,
                    },
                  ],
                  messages: [
                    {
                      from: cleanNumber,
                      id: simulatedMsgId,
                      timestamp: timestampStr,
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: buttonId,
                          title: buttonTitle,
                        },
                      },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };
    } else {
      payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '298374918237491',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1 (555) 019-2834',
                    phone_number_id: '109847291823749',
                  },
                  statuses: [
                    {
                      id: 'msg_104',
                      status: 'read',
                      timestamp: timestampStr,
                      recipient_id: cleanNumber,
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };
    }

    setLastPayloadJson(JSON.stringify(payload, null, 2));

    try {
      await onTriggerWebhook(payload);

      await fetch('/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=simulated_dev_signature',
        },
        body: JSON.stringify(payload),
      });

      setStatusMessage('✓ Test message sent! Your Inbox has been updated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      setStatusMessage(`❌ Error: ${msg}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#fffcec] select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Single High-Voltage Arc Blue Banner */}
        <div className="p-6 md:p-8 rounded-[14px] bg-[#3139fb] text-[#fffcec] shadow-sm">
          <div className="font-eyebrow text-[11px] text-[#96c4ff] mb-1.5">
             interactive test mode
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Send Yourself a Test WhatsApp Message
          </h2>
          <p className="text-xs md:text-sm text-[#fffcec]/90 leading-relaxed max-w-2xl">
            Want to see how incoming customer messages work before connecting your live phone number?
            Use this simulator to send a fake customer message straight to your Inbox.
          </p>
        </div>

        {/* Simple Beginner-Friendly Form Card */}
        <div className="p-6 rounded-[14px] bg-[#f7f4e3] border border-black/15 space-y-5">
          {/* Step 1: Event Type */}
          <div>
            <label className="block text-xs font-bold text-black mb-2">
              1. What would you like to simulate?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {[
                {
                  id: 'text',
                  label: '💬 Customer Text',
                  desc: 'Simulate a text message',
                },
                {
                  id: 'button_click',
                  label: '🔘 Button Click',
                  desc: 'Customer taps a button',
                },
                {
                  id: 'status_read',
                  label: '✓✓ Read Receipt',
                  desc: 'Mark message as read',
                },
              ].map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() =>
                    setSimulatedEventType(
                      ev.id as 'text' | 'button_click' | 'status_read'
                    )
                  }
                  className={`p-3 rounded-[10px] border text-left transition-all cursor-pointer ${
                    simulatedEventType === ev.id
                      ? 'bg-black text-[#fffcec] border-black shadow-xs'
                      : 'bg-[#fffcec] text-black border-black/15 hover:border-black'
                  }`}
                >
                  <div className="font-bold">{ev.label}</div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      simulatedEventType === ev.id
                        ? 'text-[#fffcec]/75'
                        : 'text-[#696969]'
                    }`}
                  >
                    {ev.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Customer Sender Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-black mb-1.5">
                2. Customer Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs text-black focus:border-[#3139fb] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1.5">
                Customer Phone Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedContactPhone}
                  onChange={(e) => handleContactSelect(e.target.value)}
                  placeholder="+14155552671"
                  className="flex-1 min-w-0 p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono text-black focus:border-[#3139fb] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Message Content */}
          {simulatedEventType === 'text' && (
            <div>
              <label className="block text-xs font-bold text-black mb-1.5">
                3. Message from Customer
              </label>
              <textarea
                rows={3}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full p-3 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs md:text-sm text-black focus:border-[#3139fb] outline-none"
                placeholder="Type what the customer says..."
              />
            </div>
          )}

          {simulatedEventType === 'button_click' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  3. Button Label Clicked
                </label>
                <input
                  type="text"
                  value={buttonTitle}
                  onChange={(e) => setButtonTitle(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs text-black outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Button ID
                </label>
                <input
                  type="text"
                  value={buttonId}
                  onChange={(e) => setButtonId(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#fffcec] text-xs font-mono text-black outline-none"
                />
              </div>
            </div>
          )}

          {simulatedEventType === 'status_read' && (
            <div className="p-3.5 bg-[#fffcec] border border-black/15 rounded-[10px] text-xs text-[#696969] leading-relaxed">
              This simulates the customer opening your message on their phone, turning your sent checkmarks into blue double-ticks (<strong>✓✓</strong>).
            </div>
          )}

          {/* Arc Signature CTA Card */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="arc-cta-card w-full justify-between disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[14px] bg-[#3139fb] text-[#fffcec] flex items-center justify-center font-bold text-lg shrink-0">
                  ⚡
                </div>
                <div className="text-left">
                  <div className="font-eyebrow text-[10px] text-[#96c4ff]">
                    INSTANT TEST
                  </div>
                  <div className="font-bold text-base md:text-lg text-[#fffcec] tracking-tight">
                    {isSimulating
                      ? 'Sending Test Message...'
                      : 'Send Test Message to Inbox'}
                  </div>
                </div>
              </div>
              <span className="text-xl text-[#fffcec] pr-2">➔</span>
            </button>
          </div>

          {/* Success Banner with Direct Link to Inbox */}
          {statusMessage && (
            <div
              className={`p-4 rounded-[10px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                statusMessage.startsWith('✓')
                  ? 'bg-[#fffcec] border-[#3139fb] text-black'
                  : 'bg-[#fb3a4d]/10 border-[#fb3a4d] text-[#fb3a4d]'
              }`}
            >
              <span className="text-xs font-bold">{statusMessage}</span>
              {statusMessage.startsWith('✓') && onNavigateToInbox && (
                <button
                  type="button"
                  onClick={onNavigateToInbox}
                  className="px-4 py-2 rounded-[8px] bg-[#3139fb] hover:bg-[#2404aa] text-[#fffcec] text-xs font-bold transition-colors shrink-0 cursor-pointer"
                >
                  Open Inbox to View &amp; Reply ➔
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Developer Webhook JSON Section */}
        <div className="rounded-[12px] border border-black/15 bg-[#f7f4e3] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDeveloperJson(!showDeveloperJson)}
            className="w-full p-4 flex items-center justify-between text-xs font-bold text-black hover:bg-[#efeccf] transition-colors cursor-pointer"
          >
            <span>🛠️ Developer Info: View Raw Meta Webhook JSON Payload</span>
            <span>{showDeveloperJson ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showDeveloperJson && (
            <div className="p-4 bg-[#000354] text-[#fffcec] border-t border-black/15">
              <div className="flex items-center justify-between mb-2">
                <span className="font-eyebrow text-[10px] text-[#96c4ff]">
                  WEBHOOK PAYLOAD SENT TO /api/webhooks/whatsapp
                </span>
              </div>
              <pre className="p-3 bg-black/40 rounded-[8px] text-[#96c4ff] text-xs font-mono overflow-x-auto max-h-72 leading-relaxed border border-white/10">
                {lastPayloadJson ||
                  JSON.stringify(
                    {
                      info: 'Click "Send Test Message to Inbox" above to generate and inspect the live Meta webhook JSON.',
                    },
                    null,
                    2
                  )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
