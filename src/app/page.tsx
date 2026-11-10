'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CLEAN_WORKSPACE,
  CLEAN_MEMBERS,
  CLEAN_WABA_CONFIG,
  DEFAULT_TEMPLATES,
  DEMO_WORKSPACE,
  DEMO_MEMBERS,
  DEMO_WABA_CONFIG,
  DEMO_CONTACTS,
  DEMO_CONVERSATIONS,
  DEMO_MESSAGES,
  DEMO_CAMPAIGNS,
  DEFAULT_CANNED_REPLIES,
} from '@/lib/storage';
import {
  Conversation,
  Message,
  Contact,
  WABAConfig,
  BroadcastCampaign,
  MetaWebhookPayload,
  CannedReply,
  AgentNotification,
} from '@/types/crm';
import { AISummaryResponse } from '@/lib/ai/copilot';
import { MentionService } from '@/lib/inbox/mentions';
import { SnoozeService } from '@/lib/inbox/snooze';
import { AssignmentService } from '@/lib/inbox/assignment';
import { BusinessHoursService } from '@/lib/inbox/business-hours';
import { DemoIsolationService } from '@/lib/demo/demo-isolation';
import { playInboundChime, showInboundNotification } from '@/lib/audio/sound';

import { Navbar } from '@/components/layout/Navbar';
import { Sidebar, NavigationTab } from '@/components/layout/Sidebar';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { ContactDrawer } from '@/components/inbox/ContactDrawer';
import { WebhookSimulator } from '@/components/simulator/WebhookSimulator';
import { CampaignWizard } from '@/components/broadcast/CampaignWizard';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { WabaSettings } from '@/components/settings/WabaSettings';

export default function WhatsPulseApp() {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [workspace, setWorkspace] = useState(CLEAN_WORKSPACE);
  const [allMembers, setAllMembers] = useState(CLEAN_MEMBERS);
  const [currentMemberId, setCurrentMemberId] = useState(CLEAN_MEMBERS[0].id);

  const [wabaConfig, setWabaConfig] = useState<WABAConfig>(CLEAN_WABA_CONFIG);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates] = useState(DEFAULT_TEMPLATES);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [cannedReplies] = useState<CannedReply[]>(DEFAULT_CANNED_REPLIES);
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);

  // Round-robin cycling index state reference
  const rrStateRef = useRef<{ lastIndex: number }>({ lastIndex: -1 });

  const [activeTab, setActiveTab] = useState<NavigationTab>('inbox');
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  // Default ContactDrawer to closed so the Inbox feels spacious and uncluttered
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [aiSummary, setAiSummary] = useState<AISummaryResponse | null>(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Bulk conversation operations
  const handleBulkUpdateStatus = (ids: string[], status: Conversation['status']) => {
    setConversations((prev) =>
      prev.map((c) => (ids.includes(c.id) ? { ...c, status } : c))
    );
  };

  const handleBulkAssign = (ids: string[], agentId?: string) => {
    const assignedAgent = allMembers.find((m) => m.id === agentId);
    setConversations((prev) =>
      prev.map((c) =>
        ids.includes(c.id) ? { ...c, assignedTo: agentId, assignedAgent } : c
      )
    );
  };

  const handleBulkAddLabel = (ids: string[], label: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (!ids.includes(c.id)) return c;
        const existing = c.labels || [];
        if (existing.includes(label)) return c;
        return { ...c, labels: [...existing, label] };
      })
    );
  };

  const clearDemoData = () => {
    setIsDemoMode(false);
    if (workspace.isDemo) {
      setWorkspace(CLEAN_WORKSPACE);
      setAllMembers(CLEAN_MEMBERS);
      setCurrentMemberId(CLEAN_MEMBERS[0].id);
      setWabaConfig(CLEAN_WABA_CONFIG);
    }
    // Strict isolation: only purge records tagged with isDemo: true
    setContacts((prev) => DemoIsolationService.purgeDemoData(prev).remaining);
    setConversations((prev) => DemoIsolationService.purgeDemoData(prev).remaining);
    setMessages((prev) => DemoIsolationService.purgeDemoData(prev).remaining);
    setCampaigns((prev) => DemoIsolationService.purgeDemoData(prev).remaining);
    setSelectedConversationId('');
    setIsDrawerOpen(false);
    localStorage.setItem('whatspulse_demo_mode', 'false');
  };

  const loadDemoData = () => {
    setIsDemoMode(true);
    setWorkspace(DEMO_WORKSPACE);
    setAllMembers(DEMO_MEMBERS);
    setCurrentMemberId(DEMO_MEMBERS[0].id);
    setWabaConfig(DEMO_WABA_CONFIG);
    setContacts(DEMO_CONTACTS);
    setConversations(DEMO_CONVERSATIONS);
    setMessages(DEMO_MESSAGES);
    setCampaigns(DEMO_CAMPAIGNS);
    setSelectedConversationId(DEMO_CONVERSATIONS[0].id);
    localStorage.setItem('whatspulse_demo_mode', 'true');
  };

  // Check saved preference on client mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('whatspulse_demo_mode') : null;
    if (saved === 'true') {
      const timer = setTimeout(() => {
        loadDemoData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const currentMember = allMembers.find((m) => m.id === currentMemberId) || allMembers[0];
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const currentMessages = messages.filter((m) => m.conversationId === selectedConversation?.id);

  const totalUnreadCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Send message handler (Agent Outbound / Note)
  const handleSendMessage = async (data: {
    content: string;
    isInternalNote: boolean;
    templateName?: string;
  }) => {
    if (!selectedConversation) return;

    // Handle @mentions in internal notes
    if (data.isInternalNote) {
      const mentions = MentionService.extractMentions(data.content, allMembers);
      if (mentions.length > 0) {
        const newNotifs: AgentNotification[] = mentions.map((mentioned) =>
          MentionService.createMentionNotification({
            workspaceId: workspace.id,
            conversationId: selectedConversation.id,
            senderName: currentMember.fullName,
            mentionedMember: mentioned,
            noteContent: data.content,
          })
        );
        setNotifications((prev) => [...newNotifs, ...prev]);
      }
    }

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation.contact.phoneNumber,
          content: data.content,
          isInternalNote: data.isInternalNote,
          templateName: data.templateName,
          senderId: currentMember.id,
          senderName: currentMember.fullName,
          conversationId: selectedConversation.id,
          lastInboundAt: selectedConversation.lastInboundAt,
          fepExpiresAt: selectedConversation.fepExpiresAt,
        }),
      });

      const json = await res.json();
      if (json.success && json.message) {
        setMessages((prev) => [...prev, json.message]);

        if (!data.isInternalNote) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedConversation.id
                ? {
                    ...c,
                    lastMessagePreview: data.content,
                    lastMessageAt: new Date().toISOString(),
                  }
                : c
            )
          );
        }
      } else if (!json.success && !data.isInternalNote) {
        // Render failed message bubble with error code and retry action
        const failedMsg: Message = {
          id: `msg_failed_${Date.now()}`,
          conversationId: selectedConversation.id,
          workspaceId: workspace.id,
          senderType: 'agent',
          senderId: currentMember.id,
          senderName: currentMember.fullName,
          messageType: 'text',
          content: data.content,
          status: 'failed',
          errorCode: json.errorCode || 131047,
          errorDetails: json.error || 'Care window closed or send rejected',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, failedMsg]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Update Conversation Status
  const handleUpdateStatus = (status: 'open' | 'pending' | 'resolved') => {
    if (!selectedConversation) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? { ...c, status } : c))
    );
  };

  // Assign Agent
  const handleAssignAgent = (agentId?: string) => {
    if (!selectedConversation) return;
    const assignedAgent = allMembers.find((m) => m.id === agentId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id ? { ...c, assignedTo: agentId, assignedAgent } : c
      )
    );
  };

  // Priority Update
  const handleUpdatePriority = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    if (!selectedConversation) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? { ...c, priority } : c))
    );
  };

  // Tags management
  const handleAddTag = (tag: string) => {
    if (!selectedConversation || selectedConversation.tags.includes(tag)) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id ? { ...c, tags: [...c.tags, tag] } : c
      )
    );
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedConversation) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, tags: c.tags.filter((t) => t !== tag) }
          : c
      )
    );
  };

  // Snooze management
  const handleSnoozeConversation = (until: string | null) => {
    if (!selectedConversation) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? {
              ...c,
              snoozedUntil: until,
              status: until ? 'pending' : 'open',
            }
          : c
      )
    );
  };

  // Labels management
  const handleAddLabel = (label: string) => {
    if (!selectedConversation) return;
    const existing = selectedConversation.labels || [];
    if (existing.includes(label)) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, labels: [...existing, label] }
          : c
      )
    );
  };

  const handleRemoveLabel = (label: string) => {
    if (!selectedConversation) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, labels: (c.labels || []).filter((l) => l !== label) }
          : c
      )
    );
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Trigger AI Summary
  const handleRequestAISummary = async () => {
    if (!selectedConversation) return;
    setIsAiSummaryLoading(true);
    setIsDrawerOpen(true);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize',
          messages: currentMessages,
          contactName: selectedConversation.contact.name,
        }),
      });
      const data = await res.json();
      if (data.data) {
        setAiSummary(data.data);
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setIsAiSummaryLoading(false);
    }
  };

  // Webhook Simulator Event Injection (Inbound messages and delivery receipts)
  const handleTriggerWebhook = async (payload: MetaWebhookPayload) => {
    const entry = payload.entry?.[0]?.changes?.[0]?.value;
    if (!entry) return;

    // 1. If incoming message
    if (entry.messages && entry.messages[0]) {
      const waMsg = entry.messages[0];
      const fromNumber = waMsg.from.startsWith('+') ? waMsg.from : `+${waMsg.from}`;
      const senderName = entry.contacts?.[0]?.profile?.name || fromNumber;
      const textBody =
        waMsg.text?.body ||
        waMsg.interactive?.button_reply?.title ||
        waMsg.interactive?.list_reply?.title ||
        'Received message';

      let targetConv = conversations.find((c) => c.contact.phoneNumber === fromNumber);

      // Free Entry Point referral check
      const rawWaMsg = waMsg as unknown as { referral?: unknown };
      const fepExpiresAt = rawWaMsg.referral
        ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
        : undefined;

      if (!targetConv) {
        const newContact: Contact = {
          id: `cnt_${Date.now()}`,
          workspaceId: workspace.id,
          phoneNumber: fromNumber,
          name: senderName,
          tags: ['New Lead'],
          customAttributes: { Source: 'WhatsApp' },
          lastInteractionAt: new Date().toISOString(),
        };

        // Auto-assign new conversation if configured
        let assignedAgent = undefined;
        let assignedTo = undefined;
        if (workspace.autoAssignmentMode && workspace.autoAssignmentMode !== 'disabled') {
          const chosen =
            workspace.autoAssignmentMode === 'least_loaded'
              ? AssignmentService.assignLeastLoaded(allMembers, conversations)
              : AssignmentService.assignRoundRobin(allMembers, rrStateRef.current);
          if (chosen) {
            assignedAgent = chosen;
            assignedTo = chosen.id;
          }
        }

        const newConv: Conversation = {
          id: `conv_${Date.now()}`,
          workspaceId: workspace.id,
          contactId: newContact.id,
          contact: newContact,
          assignedTo,
          assignedAgent,
          status: 'open',
          priority: 'medium',
          unreadCount: 1,
          lastMessagePreview: textBody,
          lastMessageAt: new Date().toISOString(),
          lastInboundAt: new Date().toISOString(),
          fepExpiresAt,
          tags: ['New Lead'],
          labels: [],
          snoozedUntil: null,
        };
        targetConv = newConv;
        setContacts((prev) => [newContact, ...prev]);
        setConversations((prev) => [newConv, ...prev]);
        setSelectedConversationId(newConv.id);
      } else {
        // Unsnooze and reopen conversation on inbound message
        const reopened = SnoozeService.handleInboundMessage(targetConv);

        // Auto-assignment if conversation is unassigned
        let assignedTo = reopened.assignedTo;
        let assignedAgent = reopened.assignedAgent;
        if (!assignedTo && workspace.autoAssignmentMode && workspace.autoAssignmentMode !== 'disabled') {
          const chosen =
            workspace.autoAssignmentMode === 'least_loaded'
              ? AssignmentService.assignLeastLoaded(allMembers, conversations)
              : AssignmentService.assignRoundRobin(allMembers, rrStateRef.current);
          if (chosen) {
            assignedAgent = chosen;
            assignedTo = chosen.id;
          }
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConv!.id
              ? {
                  ...c,
                  ...reopened,
                  assignedTo,
                  assignedAgent,
                  unreadCount: c.id === selectedConversationId ? 0 : c.unreadCount + 1,
                  lastMessagePreview: textBody,
                  lastMessageAt: new Date().toISOString(),
                  lastInboundAt: new Date().toISOString(),
                  fepExpiresAt: fepExpiresAt || c.fepExpiresAt,
                  status: 'open',
                }
              : c
          )
        );
      }

      // Record customer message in chat timeline
      const newMsg: Message = {
        id: `msg_sim_${Date.now()}`,
        conversationId: targetConv.id,
        workspaceId: workspace.id,
        waMessageId: waMsg.id,
        senderType: 'contact',
        senderName,
        messageType: (waMsg.type as Message['messageType']) || 'text',
        content: textBody,
        interactiveData: waMsg.interactive?.button_reply
          ? {
              type: 'button',
              selectedButtonId: waMsg.interactive.button_reply.title,
            }
          : undefined,
        status: 'delivered',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);

      // Sound and browser notification for inbound messages
      if (soundEnabled) {
        playInboundChime();
      }
      showInboundNotification(senderName, textBody);

      // Check Business Hours & Dispatch After-Hours Auto-Reply if eligible
      if (workspace.businessHours && workspace.businessHours.enabled) {
        const shouldReply = BusinessHoursService.shouldSendAfterHoursAutoReply(
          targetConv,
          new Date(),
          workspace.businessHours
        );
        if (shouldReply) {
          const autoReplyMsg: Message = {
            id: `msg_auto_${Date.now()}`,
            conversationId: targetConv.id,
            workspaceId: workspace.id,
            senderType: 'bot',
            senderName: 'Auto-Reply',
            messageType: 'text',
            content: workspace.businessHours.autoReplyMessage,
            status: 'delivered',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, autoReplyMsg]);
          // Mark lastAfterHoursReplyAt on conversation
          const nowIso = new Date().toISOString();
          setConversations((prev) =>
            prev.map((c) =>
              c.id === targetConv!.id
                ? { ...c, lastAfterHoursReplyAt: nowIso }
                : c
            )
          );
        }
      }
    }

    // 2. If status receipt update
    if (entry.statuses && entry.statuses[0]) {
      const st = entry.statuses[0];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === st.id || m.waMessageId === st.id
            ? { ...m, status: st.status as Message['status'] }
            : m
        )
      );
    }
  };

  const handleAddContact = (contactData: Partial<Contact>) => {
    const newContact: Contact = {
      id: `cnt_${Date.now()}`,
      workspaceId: workspace.id,
      phoneNumber: contactData.phoneNumber || '+1 555 000 0000',
      name: contactData.name || 'New Contact',
      email: contactData.email,
      tags: contactData.tags || ['Lead'],
      customAttributes: contactData.customAttributes || {},
      lastInteractionAt: new Date().toISOString(),
    };
    setContacts((prev) => [newContact, ...prev]);

    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      workspaceId: workspace.id,
      contactId: newContact.id,
      contact: newContact,
      status: 'open',
      priority: 'medium',
      unreadCount: 0,
      lastMessagePreview: 'Conversation started',
      lastMessageAt: new Date().toISOString(),
      tags: newContact.tags,
      labels: [],
      snoozedUntil: null,
    };
    setConversations((prev) => [newConv, ...prev]);
    setSelectedConversationId(newConv.id);
  };

  const handleOpenChatWithContact = (contactId: string) => {
    let conv = conversations.find((c) => c.contactId === contactId);
    if (!conv) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        conv = {
          id: `conv_${Date.now()}`,
          workspaceId: workspace.id,
          contactId: contact.id,
          contact,
          status: 'open',
          priority: 'medium',
          unreadCount: 0,
          lastMessagePreview: 'Conversation started',
          lastMessageAt: new Date().toISOString(),
          tags: contact.tags,
          labels: [],
          snoozedUntil: null,
        };
        setConversations((prev) => [conv!, ...prev]);
      }
    }
    if (conv) {
      setSelectedConversationId(conv.id);
      setActiveTab('inbox');
    }
  };

  const handleCreateCampaign = (data: {
    name: string;
    templateId: string;
    targetTags: string[];
  }) => {
    const template = templates.find((t) => t.id === data.templateId);
    const recipientCount = contacts.filter((c) =>
      c.tags.some((t) => data.targetTags.includes(t))
    ).length;

    const newCampaign: BroadcastCampaign = {
      id: `camp_${Date.now()}`,
      workspaceId: workspace.id,
      templateId: data.templateId,
      templateName: template?.name || 'template',
      name: data.name,
      targetTags: data.targetTags,
      totalRecipients: recipientCount,
      sentCount: recipientCount,
      deliveredCount: recipientCount,
      readCount: 0,
      failedCount: 0,
      status: 'completed',
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setCampaigns((prev) => [newCampaign, ...prev]);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#fffcec] font-sans text-black antialiased">
      {/* Top Navbar */}
      <Navbar
        workspace={workspace}
        currentMember={currentMember}
        allMembers={allMembers}
        onSwitchMember={setCurrentMemberId}
        activeTab={activeTab}
        isDemoMode={isDemoMode}
        onClearDemoData={clearDemoData}
        onLoadDemoData={loadDemoData}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        notifications={notifications}
        onDismissNotification={handleDismissNotification}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unreadCount={totalUnreadCount}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* View Switcher */}
        {activeTab === 'inbox' && (
          <div className="flex-1 flex min-w-0 overflow-hidden relative">
            {/* Conversation List */}
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={(id) => {
                setSelectedConversationId(id);
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
                );
              }}
              currentMember={currentMember}
              onOpenSimulator={() => setActiveTab('simulator')}
              availableAgents={allMembers}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkAssign={handleBulkAssign}
              onBulkAddLabel={handleBulkAddLabel}
              soundEnabled={soundEnabled}
              onToggleSound={setSoundEnabled}
            />

            {/* Central Chat Window or Beginner-Friendly 3-Step Quick Start */}
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                messages={currentMessages}
                currentMember={currentMember}
                allMembers={allMembers}
                templates={templates}
                cannedReplies={cannedReplies}
                onSendMessage={handleSendMessage}
                onUpdateStatus={handleUpdateStatus}
                onAssignAgent={handleAssignAgent}
                onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
                isDrawerOpen={isDrawerOpen}
                onRequestAISummary={handleRequestAISummary}
                onSnooze={handleSnoozeConversation}
                onAddLabel={handleAddLabel}
                onRemoveLabel={handleRemoveLabel}
              />
            ) : (
              <div className="flex-1 min-w-0 overflow-y-auto flex flex-col items-center justify-center p-6 md:p-10 bg-[#fffcec] select-none">
                <div className="max-w-xl w-full space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-black text-[#fffcec] flex items-center justify-center font-bold text-xl mx-auto shadow-xs">
                      💬
                    </div>
                    <div className="font-eyebrow text-[10px] text-[#3139fb] font-bold">
                      WELCOME TO WHATSPULSE CRM
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-black tracking-[-1.2px]">
                      Get Started in 3 Simple Steps
                    </h2>
                    <p className="text-xs text-[#696969] max-w-md mx-auto leading-relaxed">
                      Your workspace is clean and ready. Choose how you would like to begin:
                    </p>
                  </div>

                  {/* 3 Beginner-Friendly Action Cards */}
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setActiveTab('simulator')}
                      className="text-left p-4 rounded-[12px] bg-[#f7f4e3] hover:bg-[#fffcec] border border-black/15 hover:border-black transition-all flex items-center justify-between gap-4 group cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="w-8 h-8 rounded-lg bg-black text-[#fffcec] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <div>
                          <div className="font-bold text-sm text-black group-hover:text-[#3139fb] transition-colors">
                            Send Yourself a Test WhatsApp Message
                          </div>
                          <p className="text-xs text-[#696969] mt-0.5">
                            Try the live inbox right now without needing any Meta API keys.
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-black shrink-0">
                        Try Now &rarr;
                      </span>
                    </button>

                    <button
                      onClick={loadDemoData}
                      className="text-left p-4 rounded-[12px] bg-[#f7f4e3] hover:bg-[#fffcec] border border-black/15 hover:border-black transition-all flex items-center justify-between gap-4 group cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="w-8 h-8 rounded-lg bg-[#3139fb] text-[#fffcec] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <div>
                          <div className="font-bold text-sm text-black group-hover:text-[#3139fb] transition-colors">
                            Explore with Sample Customer Data
                          </div>
                          <p className="text-xs text-[#696969] mt-0.5">
                            Load realistic sample chats, contacts, and campaigns (you can clear them in 1 click anytime).
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#3139fb] shrink-0">
                        Load Sample &rarr;
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('settings')}
                      className="text-left p-4 rounded-[12px] bg-[#f7f4e3] hover:bg-[#fffcec] border border-black/15 hover:border-black transition-all flex items-center justify-between gap-4 group cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="w-8 h-8 rounded-lg bg-black/10 text-black font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          3
                        </span>
                        <div>
                          <div className="font-bold text-sm text-black group-hover:text-[#3139fb] transition-colors">
                            Connect Your Official WhatsApp Business Number
                          </div>
                          <p className="text-xs text-[#696969] mt-0.5">
                            Step-by-step guide to linking your Meta WhatsApp Cloud API credentials.
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-black shrink-0">
                        Setup &rarr;
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Right Contact Details Drawer */}
            {isDrawerOpen && selectedConversation && (
              <ContactDrawer
                conversation={selectedConversation}
                allMembers={allMembers}
                onAssignAgent={handleAssignAgent}
                onUpdatePriority={handleUpdatePriority}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onClose={() => setIsDrawerOpen(false)}
                aiSummary={aiSummary}
                isAiSummaryLoading={isAiSummaryLoading}
              />
            )}
          </div>
        )}

        {activeTab === 'broadcasts' && (
          <CampaignWizard
            campaigns={campaigns}
            templates={templates}
            availableTags={['VIP Client', 'Enterprise', 'Lead - High Intent', 'Wholesale', 'Urgent Support']}
            contacts={contacts}
            onCreateCampaign={handleCreateCampaign}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsTable
            contacts={contacts}
            onOpenChatWithContact={handleOpenChatWithContact}
            onAddContact={handleAddContact}
          />
        )}

        {activeTab === 'simulator' && (
          <WebhookSimulator
            contacts={contacts.length > 0 ? contacts : DEMO_CONTACTS}
            onTriggerWebhook={handleTriggerWebhook}
            onNavigateToInbox={() => setActiveTab('inbox')}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            conversations={conversations}
            messages={messages}
            members={allMembers}
          />
        )}

        {activeTab === 'settings' && (
          <WabaSettings
            config={wabaConfig}
            workspace={workspace}
            onSaveConfig={(updated) => setWabaConfig((prev) => ({ ...prev, ...updated }))}
            onSaveWorkspace={(updated) => setWorkspace((prev) => ({ ...prev, ...updated }))}
          />
        )}
      </div>
    </div>
  );
}
