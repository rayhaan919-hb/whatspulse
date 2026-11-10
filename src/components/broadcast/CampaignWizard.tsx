'use client';

import React, { useState, useEffect } from 'react';
import { BroadcastCampaign, MessageTemplate, Contact, OptInLedgerEntry } from '@/types/crm';
import { ComplianceService } from '@/lib/whatsapp/compliance';

interface CampaignWizardProps {
  campaigns: BroadcastCampaign[];
  templates: MessageTemplate[];
  availableTags: string[];
  contacts?: Contact[];
  optLedger?: OptInLedgerEntry[];
  onCreateCampaign: (data: {
    name: string;
    templateId: string;
    targetTags: string[];
    excludeNonOptedIn?: boolean;
  }) => void;
}

export const CampaignWizard: React.FC<CampaignWizardProps> = ({
  campaigns,
  templates,
  availableTags,
  contacts = [],
  optLedger = [],
  onCreateCampaign,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.id || ''
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(['VIP Client']);
  const [excludeNonOptedIn, setExcludeNonOptedIn] = useState(true);

  // Compute targeted audience compliance audit
  const targetedContacts = contacts.filter((c) =>
    c.tags.some((t) => selectedTags.includes(t))
  );
  const audit = ComplianceService.validateCampaignRecipients(targetedContacts, optLedger);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedTemplateId) return;

    onCreateCampaign({
      name: name.trim(),
      templateId: selectedTemplateId,
      targetTags: selectedTags,
      excludeNonOptedIn,
    });

    setName('');
    setShowCreateModal(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#fffcec] select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-eyebrow text-[10px] text-[#696969] mb-1">
              BULK MESSAGING
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-black tracking-tight">
              WhatsApp Broadcast Campaigns
            </h2>
            <p className="text-xs md:text-sm text-[#696969] mt-1">
              Send announcements or offers to groups of customers using pre-approved WhatsApp templates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs rounded-[10px] transition-all shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>+</span>
            <span>Create New Campaign</span>
          </button>
        </div>

        {/* Campaigns Grid or Beginner Empty State */}
        {campaigns.length === 0 ? (
          <div className="p-10 rounded-[14px] bg-[#f7f4e3] border border-black/15 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#fffcec] border border-black/15 flex items-center justify-center text-2xl mx-auto">
              📢
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-black">
                No Broadcast Campaigns Yet
              </h3>
              <p className="text-xs text-[#696969] leading-relaxed">
                Broadcasts let you message hundreds of customers at once (like order updates or holiday sales) safely through Meta&apos;s official API.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs rounded-[10px] transition-all cursor-pointer"
            >
              + Create Your First Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {campaigns.map((camp) => {
              const deliveryRate = camp.totalRecipients
                ? Math.round((camp.deliveredCount / camp.totalRecipients) * 100)
                : 0;
              const readRate = camp.totalRecipients
                ? Math.round((camp.readCount / camp.totalRecipients) * 100)
                : 0;

              return (
                <div
                  key={camp.id}
                  className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-black truncate">
                        {camp.name}
                      </h3>
                      <p className="text-xs text-[#696969] mt-0.5 truncate">
                        Template: <span className="font-mono">{camp.templateName}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#3139fb]/10 text-[#3139fb] shrink-0">
                      {camp.status}
                    </span>
                  </div>

                  {/* Target Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-[#696969]">Sent to tags:</span>
                    {camp.targetTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 rounded-full text-xs bg-[#fffcec] border border-black/15 text-black font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-black/10 text-center">
                    <div>
                      <div className="text-base font-bold text-black">
                        {camp.totalRecipients.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#696969] font-medium">
                        Recipients
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-black">
                        {camp.sentCount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#696969] font-medium">
                        Sent
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-[#3139fb]">
                        {deliveryRate}%
                      </div>
                      <div className="text-[10px] text-[#696969] font-medium">
                        Delivered
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-[#3139fb]">
                        {readRate}%
                      </div>
                      <div className="text-[10px] text-[#696969] font-medium">
                        Read Rate
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Campaign Modal (Closes on Backdrop Click or Esc) */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-[#fffcec] rounded-[16px] max-w-lg w-full p-6 shadow-2xl border border-black/20 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <div>
                  <h3 className="font-bold text-base text-black">
                    Create WhatsApp Broadcast
                  </h3>
                  <p className="text-xs text-[#696969]">
                    Send a pre-approved template message to a group of contacts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-2.5 py-1 rounded-[8px] bg-[#f7f4e3] hover:bg-black hover:text-[#fffcec] text-black text-xs font-semibold transition-colors cursor-pointer"
                  title="Close window (Esc)"
                >
                  Close ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    1. Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekend Flash Sale Alert"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-xs text-black focus:border-[#3139fb] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    2. Choose WhatsApp Message Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full p-2.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-xs text-black focus:border-[#3139fb] outline-none cursor-pointer"
                  >
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} ({tmpl.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1.5">
                    3. Who should receive this? (Select tags)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-black text-[#fffcec] border-black'
                              : 'bg-[#f7f4e3] text-[#696969] border-black/15 hover:text-black'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Compliance & Opt-in Verification */}
                <div className="p-3.5 rounded-[10px] bg-[#f7f4e3] border border-black/15 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-black flex items-center gap-1.5">
                      <span>4. Opt-In Compliance Pre-Check</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 text-black">
                        {targetedContacts.length} recipient(s) targeted
                      </span>
                    </label>
                  </div>

                  {audit.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {audit.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] p-2.5 rounded-[6px] bg-[#ff9900]/10 border border-[#ff9900]/30 text-black leading-relaxed"
                        >
                          {w}
                        </div>
                      ))}

                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeNonOptedIn}
                          onChange={(e) => setExcludeNonOptedIn(e.target.checked)}
                          className="rounded border-black/30 text-[#3139fb] focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-black">
                          Exclude unverified contacts (Send strictly to {audit.optedInCount} opted-in recipients)
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="text-[11px] p-2 rounded-[6px] bg-[#00c853]/10 border border-[#00c853]/30 text-[#008f39] font-medium flex items-center gap-1.5">
                      <span>✓</span>
                      <span>100% of targeted contacts have verified opt-in records in compliance ledger.</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2.5 border-t border-black/10">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-[8px] border border-black/20 text-xs font-semibold text-black hover:bg-[#f7f4e3] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-[8px] bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs transition-all cursor-pointer"
                  >
                    Send Campaign Now ➔
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
