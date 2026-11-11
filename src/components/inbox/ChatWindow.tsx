'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message, WorkspaceMember, MessageTemplate, CannedReply } from '@/types/crm';
import { CareWindowService } from '@/lib/whatsapp/care-window';
import { MetaErrorMapper } from '@/lib/whatsapp/errors';
import { CannedReplyService } from '@/lib/inbox/canned-replies';
import { SnoozeService } from '@/lib/inbox/snooze';
import { PresenceService, ViewerPresence } from '@/lib/realtime/presence';
import { DEFAULT_CANNED_REPLIES } from '@/lib/storage';
import { useI18n } from '@/lib/i18n/context';

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  currentMember: WorkspaceMember;
  allMembers: WorkspaceMember[];
  templates: MessageTemplate[];
  cannedReplies?: CannedReply[];
  activeViewers?: ViewerPresence[];
  onSendMessage: (data: {
    content: string;
    isInternalNote: boolean;
    templateName?: string;
    mediaUrl?: string;
    messageType?: 'text' | 'image' | 'audio' | 'video' | 'document';
  }) => Promise<void>;
  onUpdateStatus: (status: 'open' | 'pending' | 'resolved') => void;
  onAssignAgent: (agentId?: string) => void;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
  onRequestAISummary: () => void;
  onSnooze?: (until: string | null) => void;
  onAddLabel?: (label: string) => void;
  onRemoveLabel?: (label: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentMember,
  allMembers,
  templates,
  cannedReplies = DEFAULT_CANNED_REPLIES,
  activeViewers = [],
  onSendMessage,
  onUpdateStatus,
  onAssignAgent,
  onToggleDrawer,
  isDrawerOpen,
  onRequestAISummary,
  onSnooze,
  onAddLabel,
  onRemoveLabel,
}) => {
  const [inputText, setInputText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showCannedReplies, setShowCannedReplies] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { t } = useI18n();

  const remainingWindowMs = CareWindowService.getTimeRemainingMs(conversation.lastInboundAt);
  const isWindowOpen = CareWindowService.validateOutboundSend({
    isTemplate: false,
    lastInboundAt: conversation.lastInboundAt,
    fepExpiresAt: conversation.fepExpiresAt,
  }).allowed;

  const isSnoozed = SnoozeService.isSnoozed(conversation);

  // Agent collision detection: check if other teammates are viewing or typing
  const collision = PresenceService.detectCollision(activeViewers, currentMember.id);

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
        setShowCannedReplies(false);
        setShowSnoozeMenu(false);
        setShowMentionMenu(false);
        setShowLabelInput(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    // Claim-on-reply: automatically assign conversation to responding agent
    if (!isInternalNote && (!conversation.assignedTo || conversation.assignedTo !== currentMember.id)) {
      onAssignAgent(currentMember.id);
    }

    setIsSending(true);
    try {
      await onSendMessage({
        content: inputText.trim(),
        isInternalNote,
      });
      setInputText('');
      setShowAISuggestions(false);
      setShowTemplates(false);
      setShowCannedReplies(false);
      setShowMentionMenu(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendVoiceNote = async () => {
    if (isSending || (!isWindowOpen && !isInternalNote)) return;

    if (!isInternalNote && (!conversation.assignedTo || conversation.assignedTo !== currentMember.id)) {
      onAssignAgent(currentMember.id);
    }

    setIsSending(true);
    try {
      await onSendMessage({
        content: '🎙️ Voice note (0:14)',
        isInternalNote: false,
        messageType: 'audio',
        mediaUrl: 'https://example.com/audio/voice_message.ogg',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachMedia = async () => {
    if (isSending || (!isWindowOpen && !isInternalNote)) return;

    if (!isInternalNote && (!conversation.assignedTo || conversation.assignedTo !== currentMember.id)) {
      onAssignAgent(currentMember.id);
    }

    setIsSending(true);
    try {
      await onSendMessage({
        content: '📷 Document Receipt Attachment',
        isInternalNote: false,
        messageType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectTemplate = async (tmpl: MessageTemplate) => {
    setShowTemplates(false);
    if (!conversation.assignedTo || conversation.assignedTo !== currentMember.id) {
      onAssignAgent(currentMember.id);
    }
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

  const handleSelectCannedReply = (reply: CannedReply) => {
    const interpolated = CannedReplyService.interpolate(reply.content, {
      contact_name: conversation.contact.name,
      agent_name: currentMember.fullName,
    });
    setInputText(interpolated);
    setShowCannedReplies(false);
  };

  const handleInsertMention = (member: WorkspaceMember) => {
    const mentionTag = `@${member.fullName} `;
    if (inputText.endsWith('@')) {
      setInputText(inputText.slice(0, -1) + mentionTag);
    } else {
      setInputText(inputText + (inputText.endsWith(' ') || !inputText ? '' : ' ') + mentionTag);
    }
    setShowMentionMenu(false);
  };

  const handleTriggerAI = async () => {
    setShowTemplates(false);
    setShowCannedReplies(false);
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
    setShowCannedReplies(false);
    setShowTemplates((prev) => !prev);
  };

  const toggleCannedReplies = () => {
    setShowAISuggestions(false);
    setShowTemplates(false);
    setShowCannedReplies((prev) => !prev);
  };

  const matchedCannedReplies = CannedReplyService.search(cannedReplies, inputText);

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#fffcec] relative overflow-hidden select-text">
      {/* Clean Chat Header */}
      <div className="h-16 px-4 md:px-6 glass-header flex items-center justify-between gap-3 shrink-0 z-10 sticky top-0 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              conversation.contact.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
            }
            alt={conversation.contact.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-black/10 shadow-xs shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-black truncate">
                {conversation.contact.name}
              </span>
              <span className="text-xs text-[#696969] font-mono hidden sm:inline shrink-0">
                {conversation.contact.phoneNumber}
              </span>
              {/* Labels Badges in Header */}
              {conversation.labels?.map((lbl) => (
                <span
                  key={lbl}
                  className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3139fb]/10 text-[#3139fb] border border-[#3139fb]/20 shadow-2xs"
                >
                  #{lbl}
                  {onRemoveLabel && (
                    <button
                      type="button"
                      onClick={() => onRemoveLabel(lbl)}
                      className="hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                      title={`Remove #${lbl}`}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] truncate mt-0.5">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                isWindowOpen
                  ? 'bg-[#3139fb]/10 text-[#3139fb] border-[#3139fb]/25'
                  : 'bg-[#fb3a4d]/10 text-[#fb3a4d] border-[#fb3a4d]/25'
              }`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isWindowOpen ? 'bg-[#3139fb]' : 'bg-[#fb3a4d]'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    isWindowOpen ? 'bg-[#3139fb]' : 'bg-[#fb3a4d]'
                  }`}></span>
                </span>
                <span className="truncate">
                  {isWindowOpen
                    ? `WhatsApp Care Window • ${CareWindowService.formatCountdown(remainingWindowMs)}`
                    : 'Care Window Closed • Template Messages Only'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Snooze Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSnoozeMenu((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-[8px] border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isSnoozed
                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                  : 'bg-[#f7f4e3] text-black border-black/20 hover:bg-[#efeccf]'
              }`}
              title="Snooze conversation"
            >
              <span>⏰</span>
              <span className="hidden sm:inline">
                {isSnoozed ? 'Snoozed' : 'Snooze'}
              </span>
            </button>

            {showSnoozeMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#fffcec] border border-black/15 rounded-[10px] shadow-lg py-1.5 z-40 text-xs">
                <div className="px-3 py-1 font-bold text-[#696969] text-[10px] uppercase tracking-wider border-b border-black/10 mb-1">
                  Snooze Until
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSnooze?.(SnoozeService.calculateSnoozePreset('1h'));
                    setShowSnoozeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f7f4e3] flex items-center justify-between cursor-pointer"
                >
                  <span>1 Hour</span>
                  <span className="text-[10px] text-[#696969] font-mono">+1h</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSnooze?.(SnoozeService.calculateSnoozePreset('4h'));
                    setShowSnoozeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f7f4e3] flex items-center justify-between cursor-pointer"
                >
                  <span>4 Hours</span>
                  <span className="text-[10px] text-[#696969] font-mono">+4h</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSnooze?.(SnoozeService.calculateSnoozePreset('tomorrow_9am'));
                    setShowSnoozeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f7f4e3] flex items-center justify-between cursor-pointer"
                >
                  <span>Tomorrow 9 AM</span>
                  <span className="text-[10px] text-[#696969] font-mono">09:00</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSnooze?.(SnoozeService.calculateSnoozePreset('next_week'));
                    setShowSnoozeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f7f4e3] flex items-center justify-between cursor-pointer"
                >
                  <span>Next Week</span>
                  <span className="text-[10px] text-[#696969] font-mono">+7d</span>
                </button>
                {isSnoozed && (
                  <button
                    type="button"
                    onClick={() => {
                      onSnooze?.(null);
                      setShowSnoozeMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#fb3a4d] font-bold hover:bg-[#fb3a4d]/10 border-t border-black/10 mt-1 cursor-pointer"
                  >
                    Unsnooze Conversation ➔
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Label Trigger */}
          {onAddLabel && (
            <div className="relative hidden md:block">
              {showLabelInput ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newLabelText.trim()) {
                      onAddLabel(newLabelText.trim().replace(/^#/, ''));
                      setNewLabelText('');
                      setShowLabelInput(false);
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    autoFocus
                    placeholder="New label..."
                    value={newLabelText}
                    onChange={(e) => setNewLabelText(e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-[#f7f4e3] border border-black/20 rounded-[6px] outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-black text-[#fffcec] rounded-[6px] text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLabelInput(false)}
                    className="text-[#696969] text-xs font-bold px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLabelInput(true)}
                  className="px-2.5 py-1.5 rounded-[8px] border border-black/20 bg-[#f7f4e3] hover:bg-[#efeccf] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Add a label to this conversation"
                >
                  <span>🏷️</span>
                  <span>+ Label</span>
                </button>
              )}
            </div>
          )}

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

      {/* Collision Warning Banner */}
      {collision.isCollision && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">⚠️</span>
            <span>
              <strong>Collision Warning:</strong> {collision.collidingMembers.join(', ')} is currently viewing this conversation
              {collision.isAnyoneTyping ? ' and drafting a reply...' : '.'}
            </span>
          </div>
          <span className="text-[10px] font-mono bg-amber-200/60 px-2 py-0.5 rounded text-amber-900">
            Claim-on-reply active
          </span>
        </div>
      )}

      {/* Snoozed Banner Indicator */}
      {isSnoozed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <span>⏰</span>
            <span>
              This chat is snoozed until{' '}
              <strong>
                {new Date(conversation.snoozedUntil!).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
              . Any incoming customer message will wake it automatically.
            </span>
          </div>
          {onSnooze && (
            <button
              type="button"
              onClick={() => onSnooze(null)}
              className="text-xs font-bold text-amber-900 hover:underline cursor-pointer ml-3 shrink-0"
            >
              Unsnooze Now ➔
            </button>
          )}
        </div>
      )}

      {/* Messages Timeline */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5"
        onClick={() => {
          if (showTemplates) setShowTemplates(false);
          if (showAISuggestions) setShowAISuggestions(false);
          if (showCannedReplies) setShowCannedReplies(false);
          if (showSnoozeMenu) setShowSnoozeMenu(false);
          if (showMentionMenu) setShowMentionMenu(false);
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
                    <p className="text-xs text-black leading-relaxed break-words font-sans">
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
                  className={`max-w-[82%] md:max-w-[68%] px-4 py-3 rounded-2xl relative break-words transition-all duration-200 ${
                    isOutbound
                      ? 'bg-gradient-to-br from-black via-black to-[#000354] text-[#fffcec] rounded-br-xs shadow-md shadow-black/10 border border-white/10 hover:shadow-lg'
                      : 'bg-[#f7f4e3] text-black border border-black/10 rounded-bl-xs shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {!isOutbound && (
                    <div className="text-[11px] font-bold text-[#3139fb] mb-1">
                      {msg.senderName || conversation.contact.name}
                    </div>
                  )}

                  {/* Media / Voice Note Renderers */}
                  {msg.messageType === 'audio' ? (
                    <div className="flex items-center gap-3 p-2 bg-white/10 rounded-[10px] my-1 font-mono text-xs">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full bg-white text-black font-bold flex items-center justify-center cursor-pointer shrink-0"
                      >
                        ▶
                      </button>
                      <div className="flex-1 flex items-center gap-1 opacity-75">
                        <span className="h-2 w-0.5 bg-current"></span>
                        <span className="h-4 w-0.5 bg-current"></span>
                        <span className="h-6 w-0.5 bg-current"></span>
                        <span className="h-3 w-0.5 bg-current"></span>
                        <span className="h-5 w-0.5 bg-current"></span>
                        <span className="h-2 w-0.5 bg-current"></span>
                        <span className="h-4 w-0.5 bg-current"></span>
                      </div>
                      <span className="text-[10px] opacity-75">0:14</span>
                    </div>
                  ) : msg.messageType === 'image' && msg.mediaUrl ? (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.mediaUrl}
                        alt="Media attachment"
                        className="rounded-[8px] max-h-48 object-cover mb-1.5 border border-white/15"
                      />
                      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}

                  {msg.interactiveData?.selectedButtonId && (
                    <div className="mt-2 pt-2 border-t border-current/15 text-[11px] font-semibold opacity-90">
                      🔘 Clicked button: {msg.interactiveData.selectedButtonId}
                    </div>
                  )}

                  {/* Timestamp & Progressive Read Receipts */}
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
                        {msg.status === 'pending' ? (
                          <span
                            className="text-[#fffcec]/60 font-mono text-[10px]"
                            title="Sending message..."
                          >
                            🕒
                          </span>
                        ) : msg.status === 'read' ? (
                          <span
                            className="text-[#96c4ff] font-bold text-xs"
                            title="Read by customer"
                          >
                            ✓✓
                          </span>
                        ) : msg.status === 'delivered' ? (
                          <span
                            className="text-[#fffcec]/80 font-bold text-xs"
                            title="Delivered to device"
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
                            title="Sent to WhatsApp Cloud"
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
                            : (msg.errorDetails as { message?: string })?.message
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
      <div className="relative shrink-0 glass-dock border-t border-black/10 p-3.5 md:p-4 rounded-t-2xl shadow-lg">
        {/* Floating Canned Quick Replies Panel */}
        {showCannedReplies && (
          <div className="absolute bottom-full left-0 right-0 z-30 bg-[#f7f4e3] border-t border-b border-black/20 p-4 max-h-72 overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <span>⚡</span>
                <span>
                  Quick Canned Replies (Type / in composer or click to insert)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCannedReplies(false)}
                className="w-7 h-7 rounded-lg hover:bg-black/10 flex items-center justify-center text-black font-bold text-xs cursor-pointer"
                title="Close canned replies (Esc)"
              >
                ✕
              </button>
            </div>
            {matchedCannedReplies.length === 0 ? (
              <div className="py-4 text-xs text-[#696969] text-center">
                No canned replies matching &ldquo;{inputText}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {matchedCannedReplies.map((reply) => (
                  <button
                    key={reply.id}
                    type="button"
                    onClick={() => handleSelectCannedReply(reply)}
                    className="p-3 bg-[#fffcec] border border-black/15 hover:border-[#3139fb] rounded-[10px] text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-black mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#3139fb] bg-[#3139fb]/10 px-1.5 py-0.5 rounded">
                          /{reply.shortcut}
                        </span>
                        <span>{reply.title}</span>
                      </div>
                      {reply.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 text-[#696969] uppercase font-mono">
                          {reply.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#696969] line-clamp-2">
                      {reply.content}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating @Mention Team Selector Panel */}
        {showMentionMenu && isInternalNote && (
          <div className="absolute bottom-full left-0 right-0 z-30 bg-[#f7f4e3] border-t border-b border-black/20 p-3 max-h-48 overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-black">
                @ Mention a Team Member (they will receive an in-app alert)
              </span>
              <button
                type="button"
                onClick={() => setShowMentionMenu(false)}
                className="w-6 h-6 rounded hover:bg-black/10 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleInsertMention(member)}
                  className="flex items-center gap-2 p-2 rounded-[8px] bg-[#fffcec] border border-black/15 hover:border-[#3139fb] text-left cursor-pointer transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-black text-[#fffcec] text-[10px] font-bold flex items-center justify-center shrink-0">
                    {member.fullName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-black truncate">
                      {member.fullName}
                    </p>
                    <p className="text-[10px] text-[#696969] truncate capitalize">
                      {member.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pre-approved WhatsApp Templates"
            className="absolute bottom-full start-0 end-0 z-30 bg-[#f7f4e3] border-t border-b border-black/20 p-4 max-h-64 overflow-y-auto shadow-lg text-start"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-black">
                📋 Choose a Pre-Approved WhatsApp Template
              </span>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                aria-label="Close templates"
                className="w-7 h-7 rounded-lg hover:bg-black/10 flex items-center justify-center text-black font-bold text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
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
                  aria-label={`Select template ${tmpl.name}: ${tmpl.body}`}
                  className="p-3 rounded-[10px] bg-[#fffcec] border border-black/15 hover:border-[#3139fb] text-start cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-[#3139fb]"
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
                onClick={() => {
                  setIsInternalNote(false);
                  setShowMentionMenu(false);
                }}
                aria-label={t('chat.replyTab')}
                className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb] ${
                  !isInternalNote
                    ? 'bg-black text-[#fffcec]'
                    : 'text-[#696969] hover:text-black'
                }`}
              >
                💬 {t('chat.replyTab')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsInternalNote(true);
                  setShowCannedReplies(false);
                  setShowTemplates(false);
                }}
                aria-label={t('chat.noteTab')}
                className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb] ${
                  isInternalNote
                    ? 'bg-black text-[#fffcec]'
                    : 'text-[#696969] hover:text-black'
                }`}
              >
                🔒 {t('chat.noteTab')}
              </button>
            </div>

            {/* Canned Quick Reply Trigger */}
            {!isInternalNote && (
              <button
                type="button"
                onClick={toggleCannedReplies}
                className={`px-3 py-1 rounded-[8px] border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showCannedReplies
                    ? 'bg-black text-[#fffcec] border-black'
                    : 'bg-[#fffcec] text-black border-black/20 hover:bg-[#f7f4e3]'
                }`}
                title="Quick Canned Replies (or type / in message)"
              >
                <span>⚡</span>
                <span>Canned (/)</span>
              </button>
            )}

            {/* Voice Note Simulation Trigger */}
            {!isInternalNote && (
              <button
                type="button"
                onClick={handleSendVoiceNote}
                disabled={(!isWindowOpen && !isInternalNote) || isSending}
                aria-label={t('chat.recordVoice')}
                className="px-2.5 py-1 rounded-[8px] border border-black/20 hover:bg-[#f7f4e3] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
                title="Send a voice note"
              >
                <span>🎙️</span>
                <span className="hidden sm:inline">Voice Note</span>
              </button>
            )}

            {/* Media Attachment Trigger */}
            {!isInternalNote && (
              <button
                type="button"
                onClick={handleAttachMedia}
                disabled={(!isWindowOpen && !isInternalNote) || isSending}
                aria-label={t('chat.attachMedia')}
                className="px-2.5 py-1 rounded-[8px] border border-black/20 hover:bg-[#f7f4e3] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
                title="Attach photo or document"
              >
                <span>📎</span>
                <span className="hidden sm:inline">Media</span>
              </button>
            )}

            {/* Template Selector Trigger */}
            {!isInternalNote && (
              <button
                type="button"
                onClick={toggleTemplates}
                aria-label="Pre-approved WhatsApp Templates"
                className={`px-3 py-1 rounded-[8px] border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#3139fb] ${
                  showTemplates
                    ? 'bg-black text-[#fffcec] border-black'
                    : 'bg-[#fffcec] text-black border-black/20 hover:bg-[#f7f4e3]'
                }`}
                title="Send pre-approved Meta template"
              >
                <span>📋</span>
                <span>Templates</span>
              </button>
            )}

            {/* Mention Teammate Trigger (Internal Note Mode) */}
            {isInternalNote && (
              <button
                type="button"
                onClick={() => setShowMentionMenu((prev) => !prev)}
                className={`px-3 py-1 rounded-[8px] border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showMentionMenu
                    ? 'bg-black text-[#fffcec] border-black'
                    : 'bg-[#fffcec] text-black border-black/20 hover:bg-[#f7f4e3]'
                }`}
              >
                <span>@</span>
                <span>Mention Teammate</span>
              </button>
            )}

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
            aria-label={isInternalNote ? t('chat.notePlaceholder') : t('chat.composerPlaceholder')}
            onChange={(e) => {
              const val = e.target.value;
              setInputText(val);
              if (val.startsWith('/') && !isInternalNote) {
                setShowCannedReplies(true);
              } else if (!val.startsWith('/') && showCannedReplies) {
                setShowCannedReplies(false);
              }
              if (isInternalNote && val.endsWith('@')) {
                setShowMentionMenu(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (showCannedReplies && matchedCannedReplies.length > 0) {
                  e.preventDefault();
                  handleSelectCannedReply(matchedCannedReplies[0]);
                  return;
                }
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isInternalNote
                ? t('chat.notePlaceholder')
                : !isWindowOpen
                ? '⏱️ Customer care window is closed (>24h). Choose a template above.'
                : t('chat.composerPlaceholder')
            }
            className="flex-1 min-w-0 p-3.5 bg-[#f7f4e3] text-black border border-black/20 focus:border-[#3139fb] focus:ring-2 focus:ring-[#96c4ff]/50 rounded-xl text-xs md:text-sm outline-none resize-none placeholder-[#696969] disabled:opacity-60 disabled:cursor-not-allowed text-start shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={(!isWindowOpen && !isInternalNote) || !inputText.trim() || isSending}
            aria-label={isInternalNote ? "Save internal note" : t('chat.send')}
            className="h-[58px] px-6 rounded-2xl bg-gradient-to-r from-black via-black to-[#000354] hover:from-[#000354] hover:to-[#3139fb] text-[#fffcec] font-bold text-xs md:text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-2 cursor-pointer shadow-md shadow-black/15 focus-visible:ring-2 focus-visible:ring-[#3139fb]"
          >
            <span>
              {isSending
                ? 'Sending...'
                : isInternalNote
                ? 'Save Note'
                : t('chat.send')}
            </span>
            <span className="text-base">➔</span>
          </button>
        </div>
      </div>
    </div>
  );
};
