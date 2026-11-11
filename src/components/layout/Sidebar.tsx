'use client';

import React from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';

export type NavigationTab = 'inbox' | 'broadcasts' | 'contacts' | 'simulator' | 'analytics' | 'settings';

interface SidebarProps {
  activeTab: NavigationTab;
  onChangeTab?: (tab: NavigationTab) => void;
  onTabChange: (tab: NavigationTab) => void;
  unreadCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { t } = useI18n();

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    subtitle: string;
    icon: string;
    badge?: number;
  }> = [
    { id: 'inbox', label: t('sidebar.inbox'), subtitle: t('sidebar.inboxSubtitle'), icon: '💬', badge: unreadCount },
    { id: 'contacts', label: t('sidebar.contacts'), subtitle: t('sidebar.contactsSubtitle'), icon: '👥' },
    { id: 'broadcasts', label: t('sidebar.broadcasts'), subtitle: t('sidebar.broadcastsSubtitle'), icon: '📢' },
    { id: 'simulator', label: t('sidebar.simulator'), subtitle: t('sidebar.simulatorSubtitle'), icon: '🧪' },
    { id: 'analytics', label: t('sidebar.analytics'), subtitle: t('sidebar.analyticsSubtitle'), icon: '📊' },
    { id: 'settings', label: t('sidebar.settings'), subtitle: t('sidebar.settingsSubtitle'), icon: '⚙️' },
  ];

  const handleSelect = (tab: NavigationTab) => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <aside
      aria-label="Main Navigation"
      className="w-60 shrink-0 h-full bg-[#fffcec] border-e border-black/10 flex flex-col justify-between select-none overflow-y-auto"
    >
      <div className="p-3.5 space-y-1" role="tablist" aria-orientation="vertical">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="font-eyebrow text-[10px] text-[#696969]">
            MAIN MENU
          </span>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close Navigation Menu"
              className="md:hidden w-7 h-7 rounded-lg hover:bg-black/10 flex items-center justify-center text-black font-bold text-xs focus-visible:ring-2 focus-visible:ring-[#3139fb]"
              title="Close Menu"
            >
              ✕
            </button>
          )}
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${item.label} - ${item.subtitle}`}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-start transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb] ${
                isActive
                  ? 'bg-gradient-to-r from-black via-black to-[#000354] text-[#fffcec] shadow-md shadow-black/15 scale-[1.02] border border-white/10'
                  : 'text-black hover:bg-[#f7f4e3] hover:translate-x-1'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base shrink-0 transition-transform group-hover:scale-110">{item.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight truncate">
                    {item.label}
                  </div>
                  <div
                    className={`text-[11px] truncate mt-0.5 ${
                      isActive ? 'text-[#fffcec]/75' : 'text-[#696969]'
                    }`}
                  >
                    {item.subtitle}
                  </div>
                </div>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 bg-[#3139fb] text-[#fffcec] shadow-xs shadow-[#3139fb]/40 animate-pulse"
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Beginner Tip Footer Card */}
      <div className="p-4 m-3 rounded-2xl bg-gradient-to-b from-[#f7f4e3] to-[#f2efd6] border border-black/10 shadow-xs space-y-2.5 text-start float-card">
        <div className="flex items-center gap-2 text-xs font-bold text-black">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3139fb] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3139fb]"></span>
          </span>
          <span>Interactive Preview</span>
        </div>
        <p className="text-[11px] text-[#696969] leading-relaxed">
          Send a simulated message in <strong>Test Chat</strong> to preview customer inbound events in real time.
        </p>
        {activeTab !== 'simulator' && (
          <button
            type="button"
            onClick={() => handleSelect('simulator')}
            aria-label="Open Test Chat Simulator"
            className="w-full py-2 px-3 rounded-xl bg-black text-[#fffcec] text-[11px] font-semibold hover:bg-[#000354] transition-all duration-200 hover:shadow-xs active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
          >
            Open Test Chat ➔
          </button>
        )}

        <div className="pt-2 border-t border-black/10">
          <Link
            href="/admin/system-status"
            className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/70 hover:bg-black hover:text-[#fffcec] text-[11px] font-semibold text-black transition-all duration-200 border border-black/10 shadow-2xs hover:shadow-xs group"
            title="Open Infrastructure Health & Diagnostics Dashboard"
          >
            <span className="flex items-center gap-1.5">
              <span>🩺</span>
              <span>System Status</span>
            </span>
            <span className="text-[10px] text-[#696969] group-hover:text-white/80 font-mono">Admin ➔</span>
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0">{sidebarContent}</div>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Sidebar"
          className="fixed inset-0 z-50 md:hidden flex"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
