'use client';

import React from 'react';

export type NavigationTab = 'inbox' | 'broadcasts' | 'contacts' | 'simulator' | 'analytics' | 'settings';

interface SidebarProps {
  activeTab: NavigationTab;
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
  const navItems: Array<{
    id: NavigationTab;
    label: string;
    subtitle: string;
    icon: string;
    badge?: number;
  }> = [
    { id: 'inbox', label: 'Inbox', subtitle: 'Customer chats', icon: '💬', badge: unreadCount },
    { id: 'contacts', label: 'Contacts', subtitle: 'Customer list', icon: '👥' },
    { id: 'broadcasts', label: 'Campaigns', subtitle: 'Bulk messages', icon: '📢' },
    { id: 'simulator', label: 'Test Chat', subtitle: 'Send test message', icon: '🧪' },
    { id: 'analytics', label: 'Analytics', subtitle: 'Reports & stats', icon: '📊' },
    { id: 'settings', label: 'Connect WhatsApp', subtitle: 'API setup', icon: '⚙️' },
  ];

  const handleSelect = (tab: NavigationTab) => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-60 shrink-0 h-full bg-[#fffcec] border-r border-black/10 flex flex-col justify-between select-none overflow-y-auto">
      <div className="p-3.5 space-y-1">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="font-eyebrow text-[10px] text-[#696969]">
            MAIN MENU
          </span>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden w-7 h-7 rounded-lg hover:bg-black/10 flex items-center justify-center text-black font-bold text-xs"
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
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-black text-[#fffcec] shadow-xs'
                  : 'text-black hover:bg-[#f7f4e3]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base shrink-0">{item.icon}</span>
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
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full shrink-0 ${
                    isActive
                      ? 'bg-[#3139fb] text-[#fffcec]'
                      : 'bg-[#3139fb] text-[#fffcec]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Beginner Tip Footer Card */}
      <div className="p-3.5 m-3 rounded-[12px] bg-[#f7f4e3] border border-black/10 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-black">
          <span className="w-2 h-2 rounded-full bg-[#3139fb]"></span>
          <span>New here?</span>
        </div>
        <p className="text-[11px] text-[#696969] leading-relaxed">
          Try sending a simulated message in <strong>Test Chat</strong> to see how customer replies appear live in your Inbox.
        </p>
        {activeTab !== 'simulator' && (
          <button
            type="button"
            onClick={() => handleSelect('simulator')}
            className="w-full py-1.5 px-3 rounded-[8px] bg-black text-[#fffcec] text-[11px] font-semibold hover:bg-[#000354] transition-colors cursor-pointer"
          >
            Open Test Chat ➔
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0">{sidebarContent}</div>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
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
