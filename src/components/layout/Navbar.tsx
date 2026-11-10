'use client';

import React from 'react';
import { Workspace, WorkspaceMember } from '@/types/crm';

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
}) => {
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

      {/* Right Controls: Sample Data Toggle & User Profile */}
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
