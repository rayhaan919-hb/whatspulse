'use client';

import React, { useState } from 'react';
import { Workspace, WorkspaceMember, AgentNotification } from '@/types/crm';
import { useI18n } from '@/lib/i18n/context';

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
  const { locale, setLocale, t } = useI18n();

  // Filter unread notifications intended for the currently active member
  const memberNotifications = notifications.filter(
    (n) => n.memberId === currentMember.id && !n.isRead
  );

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  };

  return (
    <header className="h-16 shrink-0 glass-header px-4 md:px-6 flex items-center justify-between gap-4 z-30 select-none sticky top-0 transition-colors">
      {/* Start: Brand & Workspace Title */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-xl border border-black/10 hover:bg-black/5 text-black shrink-0 transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-[#3139fb]"
            title="Toggle Navigation Menu"
          >
            ☰
          </button>
        )}

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-black via-[#000354] to-black text-[#fffcec] flex items-center justify-center font-bold text-base tracking-tighter shrink-0 shadow-sm shadow-black/20 border border-white/10 transition-transform hover:scale-105">
          W
        </div>

        <div className="min-w-0 text-start">
          <div className="flex items-center gap-2">
            <span className="font-bold text-black text-base tracking-tight truncate">
              {t('navbar.brand')}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#3139fb]/10 text-[#3139fb] border border-[#3139fb]/25 shrink-0 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3139fb] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3139fb]"></span>
              </span>
              {t('navbar.badge')}
            </span>
          </div>
          <p className="text-xs text-[#696969] truncate">
            {workspace.name}
          </p>
        </div>
      </div>

      {/* End Controls: Language Switcher, Sample Data Toggle, Notifications & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Language Switcher Pill (English / Arabic RTL) */}
        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={`Switch language: currently ${locale.toUpperCase()}. Click to switch to ${locale === 'en' ? 'Arabic (RTL)' : 'English (LTR)'}`}
          className="px-3 py-1.5 rounded-xl bg-[#f7f4e3] hover:bg-[#efeccf] border border-black/10 text-xs font-semibold text-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#3139fb]"
          title="Switch Language (English / العربية)"
        >
          <span>{locale === 'en' ? '🇺🇸' : '🇸🇦'}</span>
          <span className="font-mono text-[11px] font-bold">
            {locale === 'en' ? 'EN' : 'عربي'}
          </span>
        </button>

        {isDemoMode ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f7f4e3] border border-black/10 text-xs shadow-2xs">
            <span className="text-[#696969] hidden sm:inline font-medium">
              {t('navbar.demoMode')}
            </span>
            <button
              type="button"
              onClick={onClearDemoData}
              aria-label={t('navbar.clearDemo')}
              className="bg-black hover:bg-[#fb3a4d] text-[#fffcec] px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 hover:shadow-xs active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
              title="Remove sample data and return to a clean workspace"
            >
              {t('navbar.clearDemo')} ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLoadDemoData}
            aria-label={t('navbar.loadDemo')}
            className="px-3 py-1.5 rounded-xl bg-[#f7f4e3] hover:bg-[#efeccf] border border-black/15 text-black text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#3139fb]"
            title="Load sample conversations and contacts to explore how the app works"
          >
            <span>✨</span>
            <span>{t('navbar.loadDemo')}</span>
          </button>
        )}

        {/* Notifications Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label={`${t('navbar.notifications')} (${memberNotifications.length} unread)`}
            aria-expanded={showNotifications}
            className="w-9 h-9 rounded-xl bg-[#f7f4e3] hover:bg-[#efeccf] border border-black/10 flex items-center justify-center text-sm relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
            title="Notifications (@mentions)"
          >
            <span>🔔</span>
            {memberNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-[#3139fb] text-[#fffcec] rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                {memberNotifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              role="dialog"
              aria-modal="false"
              aria-label={t('navbar.notifications')}
              className="absolute end-0 top-full mt-2 w-80 sm:w-96 bg-[#fffcec]/95 backdrop-blur-xl border border-black/10 rounded-2xl shadow-2xl p-4 z-50 text-xs text-start transition-all"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-black/10 mb-2.5">
                <span className="font-bold text-black text-xs">
                  {t('navbar.notifications')} ({memberNotifications.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  aria-label={t('common.close')}
                  className="w-6 h-6 rounded-lg hover:bg-black/10 flex items-center justify-center text-xs text-[#696969] hover:text-black font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3139fb]"
                >
                  ✕
                </button>
              </div>

              {memberNotifications.length === 0 ? (
                <div className="py-8 text-center text-[#696969] text-xs space-y-1">
                  <div className="text-2xl mb-1">🔕</div>
                  <p>{t('navbar.noNotifications')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {memberNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3 rounded-xl bg-[#f7f4e3] border border-black/10 space-y-1 hover:border-[#3139fb]/40 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center justify-between font-bold text-black text-[11px]">
                        <span>{notif.title}</span>
                        {onDismissNotification && (
                          <button
                            type="button"
                            onClick={() => onDismissNotification(notif.id)}
                            aria-label={`Dismiss notification: ${notif.title}`}
                            className="text-[#696969] hover:text-black text-[10px] font-semibold cursor-pointer"
                          >
                            Dismiss ✕
                          </button>
                        )}
                      </div>
                      <p className="text-[#696969] text-[11px] line-clamp-2">
                        &ldquo;{notif.content}&rdquo;
                      </p>
                      <div className="text-[9px] text-[#696969] text-end font-mono">
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
        <div className="flex items-center gap-2.5 ps-3 border-s border-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentMember.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
            alt={currentMember.fullName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-black/10 shadow-xs shrink-0"
          />
          <div className="hidden lg:block text-start">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-black leading-none">
                {currentMember.fullName}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 text-[#696969] capitalize">
                {currentMember.role}
              </span>
            </div>
            {allMembers.length > 1 && (
              <select
                value={currentMember.id}
                onChange={(e) => onSwitchMember(e.target.value)}
                aria-label="Switch active agent profile"
                className="text-[11px] text-[#696969] bg-transparent border-none p-0 mt-0.5 focus:ring-0 cursor-pointer hover:text-black block focus-visible:ring-2 focus-visible:ring-[#3139fb]"
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
