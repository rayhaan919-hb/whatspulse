'use client';

import React, { useState } from 'react';
import { Workspace, WorkspaceMember, AgentNotification } from '@/types/crm';

interface NavbarProps {
  workspace: Workspace;
  currentMember: WorkspaceMember;
  allMembers: WorkspaceMember[];
  onSwitchMember: (memberId: string) => void;
  activeTab: string;
  isDemoMode: boolean;
  onClearDemoData: () => void;
  onLoadDemoData: () => void;
  onToggleSidebar?: () => void;
  notifications?: AgentNotification[];
  onDismissNotification?: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  workspace,
  currentMember,
  allMembers,
  onSwitchMember,
  isDemoMode,
  onClearDemoData,
  onLoadDemoData,
  onToggleSidebar,
  notifications = [],
  onDismissNotification,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  // Filter unread notifications intended for the currently active member
  const memberNotifications = notifications.filter(
    (n) => n.memberId === currentMember.id && !n.isRead
  );

  return (
    <header className="h-16 shrink-0 border-b border-black/10 bg-[#fffcec] px-4 md:px-6 flex items-center justify-between gap-4 z-20 select-none">
      {/* Left: Brand & Workspace Title */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-[8px] border border-black/15 hover:bg-black/5 text-black shrink-0"
            title="Toggle Navigation Menu"
          >
            ☰
          </button>
        )}

        <div className="w-9 h-9 rounded-[10px] bg-black text-[#fffcec] flex items-center justify-center font-bold text-base tracking-tighter shrink-0">
          W
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-black text-base tracking-tight truncate">
              WhatsPulse
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#3139fb]/10 text-[#3139fb] border border-[#3139fb]/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3139fb]"></span>
              Official Meta API
            </span>
          </div>
          <p className="text-xs text-[#696969] truncate">
            {workspace.name}
          </p>
        </div>
      </div>

      {/* Right Controls: Sample Data Toggle, Notifications & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {isDemoMode ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#f7f4e3] border border-black/15 text-xs">
            <span className="text-[#696969] hidden sm:inline font-medium">
              Viewing Sample Data
            </span>
            <button
              type="button"
              onClick={onClearDemoData}
              className="bg-black hover:bg-[#fb3a4d] text-[#fffcec] px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
              title="Remove sample data and return to a clean workspace"
            >
              Clear Sample Data ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLoadDemoData}
            className="px-3 py-1.5 rounded-[10px] bg-[#f7f4e3] hover:bg-[#efeccf] border border-black/20 text-black text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            title="Load sample conversations and contacts to explore how the app works"
          >
            <span>✨</span>
            <span>Load Sample Data</span>
          </button>
        )}

        {/* Notifications Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            className="w-8 h-8 rounded-[8px] bg-[#f7f4e3] hover:bg-[#efeccf] border border-black/15 flex items-center justify-center text-sm relative transition-colors cursor-pointer"
            title="Notifications (@mentions)"
          >
            <span>🔔</span>
            {memberNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-[#3139fb] text-[#fffcec] rounded-full text-[9px] font-bold flex items-center justify-center">
                {memberNotifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#fffcec] border border-black/20 rounded-[12px] shadow-xl p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-black/10 mb-2">
                <span className="font-bold text-black text-xs">
                  Team Notifications ({memberNotifications.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-[#696969] hover:text-black font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {memberNotifications.length === 0 ? (
                <div className="py-6 text-center text-[#696969] text-xs">
                  No new @mentions or notifications
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {memberNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-2.5 rounded-[8px] bg-[#f7f4e3] border border-black/10 space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-black text-[11px]">
                        <span>{notif.title}</span>
                        {onDismissNotification && (
                          <button
                            type="button"
                            onClick={() => onDismissNotification(notif.id)}
                            className="text-[#696969] hover:text-black text-[10px] font-semibold cursor-pointer"
                          >
                            Dismiss ✕
                          </button>
                        )}
                      </div>
                      <p className="text-[#696969] text-[11px] line-clamp-2">
                        &ldquo;{notif.content}&rdquo;
                      </p>
                      <div className="text-[9px] text-[#696969] text-right">
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User / Agent Switcher */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentMember.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
            alt={currentMember.fullName}
            className="w-8 h-8 rounded-full object-cover border border-black/20 shrink-0"
          />
          <div className="hidden lg:block text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-black leading-none">
                {currentMember.fullName}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/5 text-[#696969] capitalize">
                {currentMember.role}
              </span>
            </div>
            {allMembers.length > 1 && (
              <select
                value={currentMember.id}
                onChange={(e) => onSwitchMember(e.target.value)}
                className="text-[11px] text-[#696969] bg-transparent border-none p-0 mt-0.5 focus:ring-0 cursor-pointer hover:text-black block"
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#fffcec] text-black">
                    Switch agent: {m.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
