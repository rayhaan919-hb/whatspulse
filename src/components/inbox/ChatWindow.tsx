'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, WorkspaceMember, MessageTemplate } from '@/types/crm';
import { CareWindowService } from '@/lib/whatsapp/care-window';
import { MetaErrorMapper } from '@/lib/whatsapp/errors';

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  currentMember: WorkspaceMember;
  allMembers: WorkspaceMember[];
  templates: MessageTemplate[];
  onSendMessage: (data: {
    content: string;
    isInternalNote: boolean;
    templateName?: string;
  }) => Promise<void>;
  onUpdateStatus: (status: 'open' | 'pending' | 'resolved') => void;
  onAssignAgent: (agentId?: string) => void;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
  onRequestAISummary: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  templates,
  onSendMessage,
  onUpdateStatus,
  onToggleDrawer,
  isDrawerOpen,
  onRequestAISummary,
}) => {
  const [inputText, setInputText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const remainingWindowMs = CareWindowService.getTimeRemainingMs(conversation.lastInboundAt);
  const isWindowOpen = CareWindowService.validateOutboundSend({
    isTemplate: false,
    lastInboundAt: conversation.lastInboundAt,
    fepExpiresAt: conversation.fepExpiresAt,
  }).allowed;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close popovers on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTemplates(false);
        setShowAISuggestions(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSendMessage({
        content: inputText.trim(),
        isInternalNote,
      });
      setInputText('');
      setShowAISuggestions(false);
      setShowTemplates(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectTemplate = async (tmpl: MessageTemplate) => {
    setShowTemplates(false);
    setIsSending(true);
    try {
      await onSendMessage({
        content: `[Template: ${tmpl.name}] ${tmpl.body}`,
        isInternalNote: false,
        templateName: tmpl.name,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerAI = async () => {
    setShowTemplates(false);
    setShowAISuggestions(true);
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest_replies',
          messages,
          contactName: conversation.contact.name,
        }),
      });
      const data = await res.json();
      if (data.data?.suggestedReplies) {
        setAiSuggestions(data.data.suggestedReplies);
      }
    } catch (err) {
      console.error('Failed to get AI suggestions:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleTemplates = () => {
    setShowAISuggestions(false);
    setShowTemplates((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#fffcec] relative overflow-hidden select-text">
      {/* Clean Chat Header */}
      <div className="h-16 px-4 md:px-6 border-b border-black/10 bg-[#fffcec] flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              conversation.contact.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
            }
            alt={conversation.contact.name}
            className="w-10 h-10 rounded-full object-cover border border-black/15 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-black truncate">
                {conversation.contact.name}
              </span>
              <span className="text-xs text-[#696969] font-mono hidden sm:inline shrink-0">
                {conversation.contact.phoneNumber}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] truncate">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isWindowOpen ? 'bg-[#3139fb]' : 'bg-[#fb3a4d]'
                }`}
              />
              <span
                className={`font-semibold truncate ${
                  isWindowOpen ? 'text-[#3139fb]' : 'text-[#fb3a4d]'
                }`}
              >
                {isWindowOpen
                  ? `WhatsApp Active • ${CareWindowService.formatCountdown(remainingWindowMs)}`
                  : 'Care Window Closed • Template Messages Only'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status Dropdown */}
          <select
            value={conversation.status}
            onChange={(e) =>
              onUpdateStatus(e.target.value as 'open' | 'pending' | 'resolved')
            }
            className="text-xs font-semibold px-2.5 py-1.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] text-black cursor-pointer focus:outline-none focus:border-[#3139fb]"
            title="Change conversation status"
          >
            <option value="open">● Open</option>
            <option value="pending">◐ Pending</option>
            <option value="resolved">✓ Resolved</option>
          </select>

          {/* AI Summary Button */}
          <button
            type="button"
            onClick={onRequestAISummary}
            title="Summarize this conversation with AI"
            className="px-3 py-1.5 bg-[#f7f4e3] hover:bg-[#efeccf] text-black border border-black/20 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>✨</span>
            <span className="hidden lg:inline">Summarize</span>
          </button>

          {/* Contact Info Drawer Toggle */}
          <button
            type="button"
            onClick={onToggleDrawer}
            className={`px-3 py-1.5 rounded-[8px] border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              isDrawerOpen
                ? 'bg-black text-[#fffcec] border-black'
                : 'bg-[#f7f4e3] text-black border-black/20 hover:bg-[#efeccf]'
            }`}
            title={isDrawerOpen ? 'Hide Contact Info' : 'Show Contact Info'}
          >
            <span>👤</span>
            <span className="hidden sm:inline">
              {isDrawerOpen ? 'Hide Info' : 'Contact Info'}
            </span>
          </button>
        </div>
      </div>

      {/* Messages Timeline */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5"
        onClick={() => {
          if (showTemplates) setShowTemplates(false);
          if (showAISuggestions) setShowAISuggestions(false);
        }}
      >
        {/* Date Pill */}
        <div className="flex justify-center my-2">
          <span className="text-[11px] font-semibold text-[#696969] bg-[#f7f4e3] border border-black/10 px-3 py-1 rounded-full">
            Today
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#696969]">
            No messages in this conversation yet. Send a message below to start chatting.
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isInternalNote) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="max-w-lg w-full bg-[#f7f4e3] border-2 border-dashed border-black/25 rounded-[12px] p-3.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-black mb-1">
                      <span className="flex items-center gap-1.5">
                        <span>🔒</span>
                        <span>Private Team Note (Customer cannot see this)</span>
                      </span>
                      <span className="text-[#696969] font-medium">{msg.senderName}</span>
                    </div>
                    <p className="text-xs text-black leading-relaxed break-words">
                      {msg.content}
                    </p>
                    <div className="text-[10px] text-[#696969] text-right mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            const isOutbound = msg.senderType === 'agent' || msg.senderType === 'bot';

            return (
              <div
                key={msg.id}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] md:max-w-[68%] px-4 py-3 rounded-[14px] relative break-words ${
                    isOutbound
                      ? 'bg-black text-[#fffcec] rounded-br-[4px] shadow-xs'
                      : 'bg-[#f7f4e3] text-black border border-black/15 rounded-bl-[4px]'
                  }`}
                >
                  {!isOutbound && (
                    <div className="text-[11px] font-bold text-[#3139fb] mb-1">
                      {msg.senderName || conversation.contact.name}
                    </div>
                  )}

                  <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>

                  {msg.interactiveData?.selectedButtonId && (
                    <div className="mt-2 pt-2 border-t border-current/15 text-[11px] font-semibold opacity-90">
                      🔘 Clicked button: {msg.interactiveData.selectedButtonId}
                    </div>
                  )}

                  {/* Timestamp & Read Receipts */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1.5 text-[10px] ${
                      isOutbound ? 'text-[#fffcec]/70' : 'text-[#696969]'
                    }`}
                  >
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isOutbound && (
                      <span>
                        {msg.status === 'read' ? (
                          <span
                            className="text-[#96c4ff] font-bold text-xs"
                            title="Read by customer"
                          >
                            ✓✓
                          </span>
                        ) : msg.status === 'delivered' ? (
                          <span
                            className="text-[#fffcec]/80 font-bold text-xs"
                            title="Delivered"
                          >
                            ✓✓
                          </span>
                        ) : msg.status === 'failed' ? (
                          <span
                            className="text-[#fb3a4d] font-bold text-xs"
                            title="Delivery failed"
                          >
                            ⚠️ Failed
                          </span>
                        ) : (
                          <span
                            className="text-[#fffcec]/60 font-bold text-xs"
                            title="Sent"
                          >
                            ✓
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Failure Reason & Retry Action */}
                  {isOutbound && msg.status === 'failed' && (
                    <div className="mt-2 pt-2 border-t border-white/20 text-left">
                      <p className="text-[11px] text-[#fb3a4d] font-semibold leading-tight">
                        {MetaErrorMapper.mapError(
                          msg.errorCode,
                          typeof msg.errorDetails === 'string'
                            ? msg.errorDetails
                            : msg.errorDetails?.message
                        ).userMessage}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          onSendMessage({
                            content: msg.content,
                            isInternalNote: false,
                          })
                        }
                        className="mt-1.5 px-2.5 py-0.5 text-[10px] font-bold bg-[#fb3a4d] hover:bg-[#d82a3c] text-[#fffcec] rounded-[6px] transition-colors cursor-pointer"
                      >
                        Retry ↺
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer & Floating Popovers Wrapper */}
      <div className="relative shrink-0 bg-[#fffcec] border-t border-black/10 p-3.5 md:p-4">
        {/* Floating AI Suggestions Panel */}
        {showAISuggestions && (
          <div className="absolute bottom-full left-0 right-0 z-30 bg-[#f7f4e3] border-t border-b border-black/20 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <span>✨</span>
                <span>AI Reply Suggestions (Click one to use)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAISuggestions(false)}
                className="w-7 h-7 rounded-lg hover:bg-black/10 flex items-center justify-center text-black font-bold text-xs cursor-pointer"
                title="Close AI suggestions (Esc)"
              >
                ✕
              </button>
            </div>

            {isAiLoading ? (
              <div className="py-3 text-xs text-[#696969] animate-pulse font-medium">
                Writing smart reply ideas based on this conversation...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto">
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(suggestion);
                      setIsInternalNote(false);
                      setShowAISuggestions(false);
                    }}
                    className="p-3 bg-[#fffcec] border border-black/15 rounded-[10px] text-left text-xs text-black hover:border-[#3139fb] hover:shadow-xs transition-all leading-relaxed cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating Templates Picker Panel */}
        {showTemplates && (
          <div className="absolute bottom-full left-0 right-0 z-30 bg-[#f7f4e3] border-t border-b border-black/20 p-4 max-h-64 overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-black">
                📋 Choose a Pre-Approved WhatsApp Template
              </span>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="w-7 h-7 rounded-lg hover:bg-black/10 flex items-center justify-center text-black font-bold text-xs cursor-pointer"
                title="Close templates (Esc)"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="p-3 rounded-[10px] bg-[#fffcec] border border-black/15 hover:border-[#3139fb] text-left cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-black mb-1">
                    <span className="truncate">{tmpl.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-black text-[#fffcec] shrink-0">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#696969] line-clamp-2">{tmpl.body}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer Top Bar */}
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Reply vs Private Note Switcher */}
            <div className="inline-flex items-center rounded-[8px] bg-[#f7f4e3] p-0.5 border border-black/15">
              <button
                type="button"
                onClick={() => setIsInternalNote(false)}
                className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                  !isInternalNote
                    ? 'bg-black text-[#fffcec]'
                    : 'text-[#696969] hover:text-black'
                }`}
              >
                💬 WhatsApp Reply
              </button>
              <button
                type="button"
                onClick={() => setIsInternalNote(true)}
                className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                  isInternalNote
                    ? 'bg-black text-[#fffcec]'
                    : 'text-[#696969] hover:text-black'
                }`}
              >
                🔒 Private Team Note
              </button>
            </div>

            {/* Template Picker Trigger */}
            {!isInternalNote && (
              <button
                type="button"
                onClick={toggleTemplates}
                className={`px-3 py-1 rounded-[8px] border text-xs font-semibold transition-all cursor-pointer ${
                  !isWindowOpen
                    ? 'bg-[#3139fb] hover:bg-[#000354] text-[#fffcec] border-[#3139fb] font-bold shadow-xs'
                    : showTemplates
                    ? 'bg-black text-[#fffcec] border-black'
                    : 'bg-[#fffcec] text-black border-black/20 hover:bg-[#f7f4e3]'
                }`}
              >
                {!isWindowOpen ? '📋 Send Approved Template ➔' : '📋 Templates'}
              </button>
            )}
          </div>

          {/* AI Reply Helper Trigger */}
          <button
            type="button"
            onClick={handleTriggerAI}
            disabled={!isWindowOpen && !isInternalNote}
            className="px-3 py-1 rounded-[8px] bg-[#3139fb]/10 hover:bg-[#3139fb]/20 disabled:opacity-40 disabled:cursor-not-allowed text-[#3139fb] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>✨</span>
            <span>Suggest Reply with AI</span>
          </button>
        </div>

        {/* Input & Send Button Row */}
        <div className="flex items-end gap-2.5">
          <textarea
            rows={2}
            value={inputText}
            disabled={(!isWindowOpen && !isInternalNote) || isSending}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isInternalNote
                ? 'Write a private note for your team (the customer will NOT see this)...'
                : !isWindowOpen
                ? '⏱️ Customer care window is closed (>24h). Click "Send Approved Template" above to message this customer.'
                : `Type a message to ${conversation.contact.name} (Press Enter to send)...`
            }
            className="flex-1 min-w-0 p-3 bg-[#f7f4e3] text-black border border-black/20 focus:border-[#3139fb] focus:ring-2 focus:ring-[#96c4ff] rounded-[10px] text-xs md:text-sm outline-none resize-none placeholder-[#696969] disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={(!isWindowOpen && !isInternalNote) || !inputText.trim() || isSending}
            className="h-[58px] px-5 rounded-[14px] bg-black hover:bg-[#000354] text-[#fffcec] font-bold text-xs md:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span>
              {isSending
                ? 'Sending...'
                : isInternalNote
                ? 'Save Note'
                : 'Send Reply'}
            </span>
            <span className="text-base">➔</span>
          </button>
        </div>
      </div>
    </div>
  );
};
