'use client';

import React, { useState } from 'react';
import { Conversation, WorkspaceMember } from '@/types/crm';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  currentMember: WorkspaceMember;
  onOpenSimulator?: () => void;
}

export type ConversationFilter = 'all' | 'mine' | 'unassigned' | 'resolved';

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  currentMember,
  onOpenSimulator,
}) => {
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allCount = conversations.filter((c) => c.status !== 'resolved').length;
  const mineCount = conversations.filter(
    (c) => c.assignedTo === currentMember.id && c.status !== 'resolved'
  ).length;
  const unassignedCount = conversations.filter(
    (c) => !c.assignedTo && c.status !== 'resolved'
  ).length;
  const resolvedCount = conversations.filter((c) => c.status === 'resolved').length;

  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'mine' && (conv.assignedTo !== currentMember.id || conv.status === 'resolved'))
      return false;
    if (filter === 'unassigned' && (conv.assignedTo || conv.status === 'resolved'))
      return false;
    if (filter === 'resolved' && conv.status !== 'resolved') return false;
    if (filter === 'all' && conv.status === 'resolved') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = conv.contact.name.toLowerCase().includes(q);
      const matchPhone = conv.contact.phoneNumber.toLowerCase().includes(q);
      const matchMsg = conv.lastMessagePreview.toLowerCase().includes(q);
      const matchTag = conv.tags.some((t) => t.toLowerCase().includes(q));
      return matchName || matchPhone || matchMsg || matchTag;
    }

    return true;
  });

  return (
    <div className="w-72 lg:w-80 shrink-0 border-r border-black/10 bg-[#fffcec] flex flex-col h-full select-none overflow-hidden">
      {/* Header & Search Input */}
      <div className="p-3.5 border-b border-black/10 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-black tracking-tight">
            Conversations
          </h2>
          <span className="text-[11px] font-medium text-[#696969]">
            {filteredConversations.length} shown
          </span>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search name, phone, or tag..."
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

        {/* Neat 4-Tab Filter Row (No Overflow) */}
        <div className="grid grid-cols-4 gap-1 bg-[#f7f4e3] p-1 rounded-[8px] border border-black/10">
          {[
            { id: 'all', label: 'Open', count: allCount },
            { id: 'mine', label: 'Mine', count: mineCount },
            { id: 'unassigned', label: 'Free', count: unassignedCount },
            { id: 'resolved', label: 'Done', count: resolvedCount },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as ConversationFilter)}
                className={`py-1.5 px-1 rounded-[6px] text-[11px] font-semibold transition-all flex flex-col items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-black text-[#fffcec] shadow-xs'
                    : 'text-[#696969] hover:text-black hover:bg-black/5'
                }`}
              >
                <span className="truncate max-w-full">{tab.label}</span>
                <span
                  className={`text-[10px] leading-none mt-0.5 font-mono ${
                    isActive ? 'text-[#96c4ff]' : 'text-[#696969]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation Feed or Beginner-Friendly Empty State */}
      <div className="flex-1 overflow-y-auto divide-y divide-black/10">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-[#f7f4e3] border border-black/10 flex items-center justify-center text-lg mx-auto">
              💬
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-black">
                {searchQuery ? 'No matching chats' : 'No conversations here yet'}
              </p>
              <p className="text-[11px] text-[#696969] leading-relaxed">
                {searchQuery
                  ? 'Try searching for a different name or phone number.'
                  : 'Send a quick test message or load sample data to see chats appear here.'}
              </p>
            </div>
            {!searchQuery && onOpenSimulator && (
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
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 relative ${
                  isSelected
                    ? 'bg-[#f7f4e3] border-l-4 border-[#3139fb]'
                    : 'hover:bg-[#f7f4e3]/60'
                }`}
              >
                {/* Avatar & Unread Badge */}
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      conv.contact.avatarUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                    }
                    alt={conv.contact.name}
                    className="w-10 h-10 rounded-full object-cover border border-black/15"
                  />
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#3139fb] text-[#fffcec] rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
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
                    <span className="text-[10px] text-[#696969] shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-[#696969] truncate mb-2">
                    {conv.lastMessagePreview}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    {/* Tags */}
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                      {conv.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-black/5 text-black border border-black/10 truncate"
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
                        <span className="text-[10px] font-semibold text-[#3139fb] bg-[#3139fb]/10 px-1.5 py-0.5 rounded">
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
    </div>
  );
};
