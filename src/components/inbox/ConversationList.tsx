'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Conversation, WorkspaceMember } from '@/types/crm';
import { SnoozeService } from '@/lib/inbox/snooze';
import { playInboundChime, requestBrowserNotifications } from '@/lib/audio/sound';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  currentMember: WorkspaceMember;
  onOpenSimulator?: () => void;
  availableAgents?: WorkspaceMember[];
  onBulkUpdateStatus?: (conversationIds: string[], status: Conversation['status']) => void;
  onBulkAssign?: (conversationIds: string[], agentId?: string) => void;
  onBulkAddLabel?: (conversationIds: string[], label: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: (enabled: boolean) => void;
}

export type ConversationFilter = 'all' | 'mine' | 'unassigned' | 'snoozed' | 'resolved';

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  currentMember,
  onOpenSimulator,
  availableAgents = [currentMember],
  onBulkUpdateStatus,
  onBulkAssign,
  onBulkAddLabel,
  soundEnabled = true,
  onToggleSound,
}) => {
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // Multi-selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [bulkLabelInput, setBulkLabelInput] = useState('');
  const [showBulkLabelModal, setShowBulkLabelModal] = useState(false);

  // Extract all unique labels present across conversations
  const availableLabels = useMemo(() => {
    return Array.from(
      new Set(conversations.flatMap((c) => c.labels || []))
    ).filter(Boolean);
  }, [conversations]);

  const isConvSnoozed = (c: Conversation) => SnoozeService.isSnoozed(c);

  const allCount = conversations.filter((c) => c.status !== 'resolved' && !isConvSnoozed(c)).length;
  const mineCount = conversations.filter(
    (c) => c.assignedTo === currentMember.id && c.status !== 'resolved' && !isConvSnoozed(c)
  ).length;
  const unassignedCount = conversations.filter(
    (c) => !c.assignedTo && c.status !== 'resolved' && !isConvSnoozed(c)
  ).length;
  const snoozedCount = conversations.filter((c) => isConvSnoozed(c)).length;
  const resolvedCount = conversations.filter((c) => c.status === 'resolved').length;

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const isSnoozed = isConvSnoozed(conv);

      if (filter === 'snoozed') {
        if (!isSnoozed) return false;
      } else if (filter === 'resolved') {
        if (conv.status !== 'resolved') return false;
      } else {
        // In active tabs (all, mine, unassigned), hide snoozed conversations
        if (isSnoozed) return false;
        if (conv.status === 'resolved') return false;

        if (filter === 'mine' && conv.assignedTo !== currentMember.id) return false;
        if (filter === 'unassigned' && conv.assignedTo) return false;
      }

      // Filter by label if a label pill is selected
      if (selectedLabel) {
        if (!conv.labels || !conv.labels.includes(selectedLabel)) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = conv.contact.name.toLowerCase().includes(q);
        const matchPhone = conv.contact.phoneNumber.toLowerCase().includes(q);
        const matchMsg = conv.lastMessagePreview.toLowerCase().includes(q);
        const matchTag = conv.tags.some((t) => t.toLowerCase().includes(q));
        const matchLabel = conv.labels?.some((l) => l.toLowerCase().includes(q));
        return matchName || matchPhone || matchMsg || matchTag || matchLabel;
      }

      return true;
    });
  }, [conversations, filter, selectedLabel, searchQuery, currentMember.id]);

  // Keyboard navigation: j / k navigation & Cmd+K command palette
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        return;
      }

      // Skip j/k if user is typing in any form input or modal
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.getAttribute('contenteditable') === 'true');

      if (isInputActive || isCommandPaletteOpen) return;

      if (e.key === 'j' || e.key === 'J') {
        // Move selection down
        e.preventDefault();
        if (filteredConversations.length === 0) return;
        const currentIndex = filteredConversations.findIndex(
          (c) => c.id === selectedConversationId
        );
        if (currentIndex === -1 || currentIndex === filteredConversations.length - 1) {
          onSelectConversation(filteredConversations[0].id);
        } else {
          onSelectConversation(filteredConversations[currentIndex + 1].id);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        // Move selection up
        e.preventDefault();
        if (filteredConversations.length === 0) return;
        const currentIndex = filteredConversations.findIndex(
          (c) => c.id === selectedConversationId
        );
        if (currentIndex <= 0) {
          onSelectConversation(filteredConversations[filteredConversations.length - 1].id);
        } else {
          onSelectConversation(filteredConversations[currentIndex - 1].id);
        }
      }
    },
    [filteredConversations, selectedConversationId, onSelectConversation, isCommandPaletteOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Bulk selection toggles
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredConversations.length && filteredConversations.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredConversations.map((c) => c.id));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = (status: Conversation['status']) => {
    if (onBulkUpdateStatus && selectedIds.length > 0) {
      onBulkUpdateStatus(selectedIds, status);
      setSelectedIds([]);
    }
  };

  const handleBulkAssignChange = (agentId?: string) => {
    if (onBulkAssign && selectedIds.length > 0) {
      onBulkAssign(selectedIds, agentId);
      setSelectedIds([]);
    }
  };

  const handleConfirmBulkLabel = () => {
    if (onBulkAddLabel && selectedIds.length > 0 && bulkLabelInput.trim()) {
      onBulkAddLabel(selectedIds, bulkLabelInput.trim());
      setBulkLabelInput('');
      setShowBulkLabelModal(false);
      setSelectedIds([]);
    }
  };

  // Sound test & permission
  const handleTestSound = () => {
    playInboundChime();
    if (onToggleSound) {
      onToggleSound(!soundEnabled);
    }
  };

  const handleEnableDesktopNotifications = async () => {
    const granted = await requestBrowserNotifications();
    if (granted) {
      alert('Desktop notifications enabled successfully!');
    }
  };

  // Filtered list for Command Palette
  const paletteMatches = useMemo(() => {
    if (!paletteQuery.trim()) return [];
    const q = paletteQuery.toLowerCase();
    return conversations
      .filter((c) => c.contact.name.toLowerCase().includes(q) || c.contact.phoneNumber.includes(q))
      .slice(0, 6);
  }, [conversations, paletteQuery]);

  return (
    <div className="w-72 lg:w-80 shrink-0 border-r border-black/10 bg-[#fffcec] flex flex-col h-full select-none overflow-hidden relative">
      {/* Header & Search Input */}
      <div className="p-3.5 border-b border-black/10 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-black tracking-tight">Conversations</h2>
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 text-[#696969] hover:text-black border border-black/10 transition-colors cursor-pointer"
              title="Quick Search &amp; Command Palette (Cmd+K)"
            >
              ⌘K
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Sound notification toggle */}
            <button
              type="button"
              onClick={handleTestSound}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                soundEnabled
                  ? 'text-[#3139fb] hover:bg-[#3139fb]/10'
                  : 'text-[#696969] hover:bg-black/5'
              }`}
              title={soundEnabled ? 'Inbound chime enabled (Click to toggle)' : 'Inbound chime muted'}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <span className="text-[11px] font-medium text-[#696969]">
              {filteredConversations.length} shown
            </span>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search (or j/k to navigate)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f7f4e3] text-black border border-black/15 focus:border-[#3139fb] focus:ring-2 focus:ring-[#96c4ff] rounded-[8px] pl-3 pr-7 py-2 text-xs outline-none placeholder-[#696969]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#696969] hover:text-black text-xs font-bold p-1 cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* 5-Tab Filter Row (All, Mine, Free, Snoozed, Done) */}
        <div className="grid grid-cols-5 gap-1 bg-[#f7f4e3] p-1 rounded-[8px] border border-black/10">
          {[
            { id: 'all', label: 'Open', count: allCount },
            { id: 'mine', label: 'Mine', count: mineCount },
            { id: 'unassigned', label: 'Free', count: unassignedCount },
            { id: 'snoozed', label: 'Snooze', count: snoozedCount },
            { id: 'resolved', label: 'Done', count: resolvedCount },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as ConversationFilter)}
                className={`py-1.5 px-0.5 rounded-[6px] text-[10.5px] font-semibold transition-all flex flex-col items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-black text-[#fffcec] shadow-xs'
                    : 'text-[#696969] hover:text-black hover:bg-black/5'
                }`}
              >
                <span className="truncate max-w-full">{tab.label}</span>
                <span
                  className={`text-[9.5px] leading-none mt-0.5 font-mono ${
                    isActive ? 'text-[#96c4ff]' : 'text-[#696969]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Select-All Bar for Bulk Operations */}
        {filteredConversations.length > 0 && (
          <div className="flex items-center justify-between pt-0.5 text-[10.5px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#696969] hover:text-black">
              <input
                type="checkbox"
                checked={
                  selectedIds.length > 0 &&
                  selectedIds.length === filteredConversations.length
                }
                onChange={handleToggleSelectAll}
                className="w-3.5 h-3.5 accent-[#3139fb] rounded"
              />
              <span>
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : 'Select mode'}
              </span>
            </label>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[#3139fb] hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Labels Filter Bar */}
        {availableLabels.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <span className="text-[10px] uppercase font-bold text-[#696969] shrink-0 tracking-wider">
              Labels:
            </span>
            <button
              type="button"
              onClick={() => setSelectedLabel(null)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer transition-colors ${
                selectedLabel === null
                  ? 'bg-black text-[#fffcec]'
                  : 'bg-black/5 text-[#696969] hover:text-black'
              }`}
            >
              All
            </button>
            {availableLabels.map((lbl) => {
              const isSelected = selectedLabel === lbl;
              return (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setSelectedLabel(isSelected ? null : lbl)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#3139fb] text-[#fffcec]'
                      : 'bg-[#3139fb]/10 text-[#3139fb] hover:bg-[#3139fb]/20'
                  }`}
                >
                  #{lbl}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversation Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-black/10 pb-16">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-[#f7f4e3] border border-black/10 flex items-center justify-center text-lg mx-auto">
              💬
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-black">
                {searchQuery || selectedLabel ? 'No matching chats' : 'No conversations here yet'}
              </p>
              <p className="text-[11px] text-[#696969] leading-relaxed">
                {searchQuery || selectedLabel
                  ? 'Try clearing the search or label filters.'
                  : 'Send a quick test message or load sample data to see chats appear here.'}
              </p>
            </div>
            {!searchQuery && !selectedLabel && onOpenSimulator && (
              <button
                type="button"
                onClick={onOpenSimulator}
                className="px-3.5 py-2 bg-black hover:bg-[#000354] text-[#fffcec] font-semibold rounded-[8px] text-xs transition-all cursor-pointer"
              >
                Send a Test Message ➔
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = selectedConversationId === conv.id;
            const isChecked = selectedIds.includes(conv.id);
            const isSnoozed = isConvSnoozed(conv);

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3 cursor-pointer transition-colors flex items-start gap-2.5 relative ${
                  isSelected
                    ? 'bg-[#f7f4e3] border-l-4 border-[#3139fb]'
                    : 'hover:bg-[#f7f4e3]/60'
                }`}
              >
                {/* Multi-Select Checkbox */}
                <div
                  className="pt-1.5 shrink-0"
                  onClick={(e) => handleToggleSelectOne(conv.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 accent-[#3139fb] rounded cursor-pointer"
                  />
                </div>

                {/* Avatar & Unread Badge */}
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      conv.contact.avatarUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                    }
                    alt={conv.contact.name}
                    className="w-9 h-9 rounded-full object-cover border border-black/15"
                  />
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-[#3139fb] text-[#fffcec] rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-xs text-black truncate">
                      {conv.contact.name}
                    </span>
                    <span className="text-[10px] text-[#696969] shrink-0 font-mono">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-[#696969] truncate mb-1">
                    {conv.lastMessagePreview}
                  </p>

                  {/* Labels and Snooze Badges */}
                  <div className="flex items-center gap-1 flex-wrap mb-1">
                    {isSnoozed && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        ⏰ Snoozed
                      </span>
                    )}
                    {conv.labels?.map((lbl, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-[#3139fb]/10 text-[#3139fb] border border-[#3139fb]/15 truncate max-w-[80px]"
                      >
                        #{lbl}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Tags */}
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                      {conv.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 text-[9.5px] font-medium rounded-full bg-black/5 text-black border border-black/10 truncate"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Agent Assignment */}
                    <div className="shrink-0">
                      {conv.assignedAgent ? (
                        <span className="text-[10px] font-medium text-[#696969]">
                          {conv.assignedAgent.fullName.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-semibold text-[#3139fb] bg-[#3139fb]/10 px-1.5 py-0.5 rounded">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bulk Actions Bar when conversations are selected */}
      {selectedIds.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 bg-black text-[#fffcec] p-2.5 rounded-[10px] shadow-lg flex items-center justify-between gap-2 z-20 animate-fade-in border border-black/20">
          <div className="text-[11px] font-bold truncate">
            {selectedIds.length} chat{selectedIds.length > 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleBulkStatusChange('resolved')}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-semibold transition-colors cursor-pointer"
              title="Resolve selected chats"
            >
              ✓ Done
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusChange('open')}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-semibold transition-colors cursor-pointer"
              title="Open selected chats"
            >
              Open
            </button>

            {/* Quick Assign Dropdown */}
            <select
              onChange={(e) => handleBulkAssignChange(e.target.value || undefined)}
              defaultValue=""
              className="bg-white/15 text-[#fffcec] text-[10px] font-medium py-1 px-1.5 rounded outline-none cursor-pointer max-w-[75px]"
            >
              <option value="" disabled className="text-black">
                Assign...
              </option>
              {availableAgents.map((agent) => (
                <option key={agent.id} value={agent.id} className="text-black">
                  {agent.fullName.split(' ')[0]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowBulkLabelModal(true)}
              className="px-2 py-1 bg-[#3139fb] hover:bg-[#000354] rounded text-[10px] font-semibold transition-colors cursor-pointer"
            >
              + Label
            </button>
          </div>
        </div>
      )}

      {/* Bulk Add Label Modal */}
      {showBulkLabelModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#fffcec] border border-black/20 rounded-[12px] p-5 max-w-xs w-full shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-black">
              Add Label to {selectedIds.length} Conversations
            </h3>
            <input
              type="text"
              placeholder="e.g. VIP, Urgent, Refund..."
              value={bulkLabelInput}
              onChange={(e) => setBulkLabelInput(e.target.value)}
              className="w-full p-2 text-xs rounded-[6px] border border-black/20 bg-[#f7f4e3] outline-none focus:border-[#3139fb]"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkLabelModal(false)}
                className="px-3 py-1.5 text-xs text-[#696969] hover:text-black font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkLabel}
                className="px-3 py-1.5 text-xs bg-[#3139fb] text-[#fffcec] font-bold rounded-[6px] hover:bg-[#000354] cursor-pointer"
              >
                Apply Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Cmd+K / Ctrl+K) */}
      {isCommandPaletteOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-24 p-4 z-50 animate-fade-in"
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div
            className="bg-[#fffcec] border border-black/20 rounded-[14px] max-w-lg w-full shadow-2xl overflow-hidden space-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-black/10 flex items-center gap-2.5 bg-[#f7f4e3]">
              <span className="text-sm text-[#696969]">🔍</span>
              <input
                type="text"
                placeholder="Search conversations, navigate tabs, or run actions..."
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-black outline-none placeholder-[#696969]"
                autoFocus
              />
              <span className="text-[10px] font-mono text-[#696969] bg-black/5 px-1.5 py-0.5 rounded border border-black/10">
                ESC
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-black/10 p-2">
              {/* Matched conversations */}
              {paletteMatches.length > 0 && (
                <div className="pb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#696969] px-2 py-1">
                    Conversations
                  </div>
                  {paletteMatches.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setIsCommandPaletteOpen(false);
                      }}
                      className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-black">{conv.contact.name}</div>
                        <div className="text-[11px] text-[#696969] truncate max-w-sm">
                          {conv.lastMessagePreview}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#696969]">
                        {conv.contact.phoneNumber}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Actions */}
              <div className="pt-2 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#696969] px-2 py-1">
                  Actions &amp; Filters
                </div>
                <div
                  onClick={() => {
                    setFilter('all');
                    setIsCommandPaletteOpen(false);
                  }}
                  className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between text-xs font-semibold text-black"
                >
                  <span>Switch to Open Conversations</span>
                  <span className="text-[10px] font-mono text-[#696969]">Tab: Open</span>
                </div>
                <div
                  onClick={() => {
                    setFilter('mine');
                    setIsCommandPaletteOpen(false);
                  }}
                  className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between text-xs font-semibold text-black"
                >
                  <span>Switch to My Conversations</span>
                  <span className="text-[10px] font-mono text-[#696969]">Tab: Mine</span>
                </div>
                <div
                  onClick={() => {
                    setFilter('snoozed');
                    setIsCommandPaletteOpen(false);
                  }}
                  className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between text-xs font-semibold text-black"
                >
                  <span>View Snoozed Conversations</span>
                  <span className="text-[10px] font-mono text-[#696969]">Tab: Snooze</span>
                </div>
                <div
                  onClick={() => {
                    setFilter('resolved');
                    setIsCommandPaletteOpen(false);
                  }}
                  className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between text-xs font-semibold text-black"
                >
                  <span>View Resolved Conversations</span>
                  <span className="text-[10px] font-mono text-[#696969]">Tab: Done</span>
                </div>
                <div
                  onClick={() => {
                    handleTestSound();
                    setIsCommandPaletteOpen(false);
                  }}
                  className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between text-xs font-semibold text-black"
                >
                  <span>Toggle / Test Inbound Chime Sound</span>
                  <span className="text-[10px] font-mono text-[#696969]">
                    {soundEnabled ? 'Currently ON' : 'Currently OFF'}
                  </span>
                </div>
                <div
                  onClick={() => {
                    handleEnableDesktopNotifications();
                    setIsCommandPaletteOpen(false);
                  }}
                  className="p-2 rounded-[8px] hover:bg-[#f7f4e3] cursor-pointer flex items-center justify-between text-xs font-semibold text-black"
                >
                  <span>Enable Browser Desktop Notifications</span>
                  <span className="text-[10px] font-mono text-[#696969]">Permission</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-[#f7f4e3] border-t border-black/10 flex items-center justify-between text-[11px] text-[#696969]">
              <span>Tip: Press <kbd className="font-mono bg-black/5 px-1 py-0.5 rounded">j</kbd> and <kbd className="font-mono bg-black/5 px-1 py-0.5 rounded">k</kbd> to cycle chats without opening search</span>
              <span className="font-mono text-[10px]">WhatsPulse 3B</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
