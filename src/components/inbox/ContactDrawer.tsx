'use client';

import React, { useState, useEffect } from 'react';
import { Conversation, WorkspaceMember } from '@/types/crm';
import { AISummaryResponse } from '@/lib/ai/copilot';
import { useI18n } from '@/lib/i18n/context';

interface ContactDrawerProps {
  conversation: Conversation;
  allMembers: WorkspaceMember[];
  onAssignAgent: (agentId?: string) => void;
  onUpdatePriority: (priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClose: () => void;
  aiSummary?: AISummaryResponse | null;
  isAiSummaryLoading?: boolean;
}

export const ContactDrawer: React.FC<ContactDrawerProps> = ({
  conversation,
  allMembers,
  onAssignAgent,
  onUpdatePriority,
  onAddTag,
  onRemoveTag,
  onClose,
  aiSummary,
  isAiSummaryLoading,
}) => {
  const { t } = useI18n();
  const [newTagInput, setNewTagInput] = useState('');
  const contact = conversation.contact;

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim()) {
      onAddTag(newTagInput.trim());
      setNewTagInput('');
    }
  };

  const drawerContent = (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={t('drawer.customerProfile')}
      className="w-80 shrink-0 border-s border-black/10 bg-[#fffcec] flex flex-col h-full overflow-y-auto select-none text-start"
    >
      {/* Header with Large Close Button */}
      <div className="h-16 px-5 glass-header flex items-center justify-between shrink-0 sticky top-0 z-10 transition-colors">
        <span className="text-xs font-bold text-black uppercase tracking-wider font-mono">
          {t('drawer.customerProfile')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="btn-press px-2.5 py-1 rounded-xl bg-[#f7f4e3] hover:bg-black hover:text-[#fffcec] border border-black/15 text-black text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#3139fb]"
          title="Close Customer Profile (Esc)"
        >
          <span>{t('common.close')}</span>
          <span>✕</span>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Profile Card */}
        <div className="text-center p-5 rounded-2xl bg-gradient-to-b from-[#f7f4e3] to-[#f2efd6] border border-black/10 shadow-xs float-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              contact.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
            }
            alt={contact.name}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-2.5 ring-2 ring-black/10 shadow-xs"
          />
          <h3 className="font-bold text-sm text-black truncate">
            {contact.name}
          </h3>
          <p className="text-xs text-[#696969] font-mono mt-0.5">
            {contact.phoneNumber}
          </p>
          {contact.email && (
            <p className="text-xs text-[#3139fb] font-medium mt-1 truncate">
              {contact.email}
            </p>
          )}
        </div>

        {/* AI Summary Card */}
        {isAiSummaryLoading ? (
          <div className="p-4 rounded-xl bg-[#f7f4e3] border border-black/15 animate-pulse text-xs text-[#696969] font-medium">
            ✨ Generating AI summary of this conversation...
          </div>
        ) : aiSummary ? (
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 to-[#f7f4e3] border border-indigo-200/60 shadow-xs text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-black flex items-center gap-1">
                <span>✨</span> AI Chat Summary
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  aiSummary.customerSentiment === 'Positive'
                    ? 'bg-[#3139fb]/10 text-[#3139fb]'
                    : 'bg-[#fb3a4d]/15 text-[#fb3a4d]'
                }`}
              >
                {aiSummary.customerSentiment}
              </span>
            </div>
            <p className="text-[#696969] leading-relaxed">
              {aiSummary.summary}
            </p>
            <div className="space-y-1 pt-1">
              {aiSummary.bulletPoints.map((pt, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-black">
                  <span className="text-[#3139fb] font-bold">•</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Agent Assignment */}
        <div>
          <label className="block text-xs font-bold text-black mb-1.5">
            Assigned Team Member
          </label>
          <select
            value={conversation.assignedTo || ''}
            onChange={(e) => onAssignAgent(e.target.value || undefined)}
            className="w-full text-xs bg-[#f7f4e3] text-black border border-black/20 rounded-[8px] p-2.5 focus:border-[#3139fb] outline-none cursor-pointer"
          >
            <option value="">Unassigned (Anyone can reply)</option>
            {allMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.role})
              </option>
            ))}
          </select>
        </div>

        {/* Ticket Priority */}
        <div>
          <label className="block text-xs font-bold text-black mb-1.5">
            Priority Level
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['low', 'medium', 'high', 'urgent'] as const).map((pr) => {
              const isSelected = conversation.priority === pr;
              return (
                <button
                  key={pr}
                  type="button"
                  onClick={() => onUpdatePriority(pr)}
                  className={`py-1.5 text-[11px] font-semibold rounded-[8px] capitalize border transition-all cursor-pointer ${
                    isSelected
                      ? pr === 'urgent'
                        ? 'bg-[#fb3a4d] text-[#fffcec] border-[#fb3a4d]'
                        : 'bg-black text-[#fffcec] border-black'
                      : 'bg-[#f7f4e3] text-[#696969] border-black/15 hover:text-black'
                  }`}
                >
                  {pr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-bold text-black mb-1.5">
            Customer Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {conversation.tags.length === 0 ? (
              <span className="text-xs text-[#696969]">No tags added yet</span>
            ) : (
              conversation.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f7f4e3] border border-black/15 text-black flex items-center gap-1.5"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="text-[#696969] hover:text-[#fb3a4d] text-xs font-bold cursor-pointer"
                    title={`Remove ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>

          <form onSubmit={handleAddTagSubmit} className="flex gap-1.5">
            <input
              type="text"
              placeholder="Add a tag (e.g. VIP)..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-[#f7f4e3] text-black border border-black/20 rounded-[8px] outline-none focus:border-[#3139fb]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs bg-black hover:bg-[#000354] text-[#fffcec] font-bold rounded-[8px] shrink-0 cursor-pointer"
            >
              Add
            </button>
          </form>
        </div>

        {/* Custom Details */}
        {Object.keys(contact.customAttributes || {}).length > 0 && (
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">
              Additional Info
            </label>
            <div className="p-3 rounded-[10px] bg-[#f7f4e3] border border-black/10 space-y-2">
              {Object.entries(contact.customAttributes || {}).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-xs gap-2"
                >
                  <span className="text-[#696969] truncate">{key}:</span>
                  <span className="font-semibold text-black text-right truncate">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Inline on XL desktop screens */}
      <div className="hidden xl:block h-full shrink-0">{drawerContent}</div>

      {/* Slide-over overlay with backdrop on smaller screens (< XL) so it never squeezes the chat window */}
      <div className="fixed inset-0 z-40 xl:hidden flex justify-end">
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-xs"
          onClick={onClose}
        />
        <div className="relative z-10 h-full shadow-2xl">{drawerContent}</div>
      </div>
    </>
  );
};
