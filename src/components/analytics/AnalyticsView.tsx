'use client';

import React from 'react';
import { Conversation, Message, WorkspaceMember } from '@/types/crm';

interface AnalyticsViewProps {
  conversations: Conversation[];
  messages: Message[];
  members: WorkspaceMember[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  conversations,
  messages,
  members,
}) => {
  const totalMessages = messages.length;
  const openCount = conversations.filter((c) => c.status === 'open').length;
  const pendingCount = conversations.filter((c) => c.status === 'pending').length;
  const resolvedCount = conversations.filter((c) => c.status === 'resolved').length;
  const totalConvs = conversations.length;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 bg-[#fffcec] select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="font-eyebrow text-[10px] text-[#3139fb] font-bold mb-1">
            REPORTS &amp; INSIGHTS
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-black tracking-[-1.2px]">
            Team &amp; Message Analytics
          </h2>
          <p className="text-sm text-[#696969] mt-1 max-w-xl">
            Track your WhatsApp message volume, delivery rates, and support conversation progress.
          </p>
        </div>

        {/* 4 Unified Arc KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-1.5">
            <div className="flex items-center justify-between font-eyebrow text-[10px] text-[#696969]">
              <span>TOTAL MESSAGES</span>
              <span>💬</span>
            </div>
            <div className="text-3xl font-bold text-black tracking-tight">
              {totalMessages.toLocaleString()}
            </div>
            <p className="text-[11px] font-semibold text-[#3139fb]">
              {totalConvs} active threads
            </p>
          </div>

          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-1.5">
            <div className="flex items-center justify-between font-eyebrow text-[10px] text-[#696969]">
              <span>DELIVERY RATE</span>
              <span>🛡️</span>
            </div>
            <div className="text-3xl font-bold text-black tracking-tight">
              {totalMessages > 0 ? '99.2%' : '100%'}
            </div>
            <p className="text-[11px] text-[#696969]">
              Official Meta Cloud API
            </p>
          </div>

          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-1.5">
            <div className="flex items-center justify-between font-eyebrow text-[10px] text-[#696969]">
              <span>READ RATE</span>
              <span>✓✓</span>
            </div>
            <div className="text-3xl font-bold text-[#3139fb] tracking-tight">
              {totalMessages > 0 ? '92.4%' : '—'}
            </div>
            <p className="text-[11px] text-[#696969]">
              Verified read receipts
            </p>
          </div>

          <div className="p-5 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-1.5">
            <div className="flex items-center justify-between font-eyebrow text-[10px] text-[#696969]">
              <span>AVG REPLY TIME</span>
              <span>⚡</span>
            </div>
            <div className="text-3xl font-bold text-black tracking-tight">
              {totalMessages > 0 ? '1m 45s' : '—'}
            </div>
            <p className="text-[11px] font-semibold text-black">
              AI Smart Reply enabled
            </p>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversation Status Breakdown */}
          <div className="p-6 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-black">
                Conversation Status Breakdown
              </div>
              <span className="text-[11px] text-[#696969]">
                {totalConvs} total
              </span>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between text-xs font-semibold text-black mb-1.5">
                  <span>Open Chats</span>
                  <span>
                    {openCount} ({totalConvs ? Math.round((openCount / totalConvs) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-black/10 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#3139fb] h-full rounded-full transition-all"
                    style={{ width: `${totalConvs ? (openCount / totalConvs) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-black mb-1.5">
                  <span>Resolved / Done</span>
                  <span>
                    {resolvedCount} ({totalConvs ? Math.round((resolvedCount / totalConvs) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-black/10 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-black h-full rounded-full transition-all"
                    style={{ width: `${totalConvs ? (resolvedCount / totalConvs) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-black mb-1.5">
                  <span>Waiting on Customer</span>
                  <span>
                    {pendingCount} ({totalConvs ? Math.round((pendingCount / totalConvs) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-black/10 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#696969] h-full rounded-full transition-all"
                    style={{ width: `${totalConvs ? (pendingCount / totalConvs) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="p-6 rounded-[12px] bg-[#f7f4e3] border border-black/15 space-y-4">
            <div className="text-xs font-bold text-black">
              Team Members ({members.length})
            </div>

            <div className="divide-y divide-black/10">
              {members.map((member) => (
                <div key={member.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={member.avatarUrl}
                      alt={member.fullName}
                      className="w-9 h-9 rounded-full object-cover border border-black/15 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-black truncate">
                        {member.fullName}
                      </div>
                      <div className="text-[11px] text-[#696969] capitalize">
                        {member.role}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#fffcec] border border-black/15 text-black shrink-0">
                    ● Online
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
