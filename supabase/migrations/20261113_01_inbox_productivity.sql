-- ====================================================================
-- WhatsPulse CRM — Migration 20261113_01: Inbox Productivity
-- Phase 3A: Canned Replies, Auto-Assignment, Business Hours, Snooze & Mentions
-- ====================================================================

-- 1. Workspace Canned Quick Replies
CREATE TABLE IF NOT EXISTS public.canned_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shortcut VARCHAR(50) NOT NULL, -- e.g. 'refund', 'hours'
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_canned_replies_workspace 
ON public.canned_replies(workspace_id, shortcut);

-- 2. Workspaces: Auto-Assignment & Business Hours Settings
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS auto_assignment_mode VARCHAR(50) DEFAULT 'round_robin' 
CHECK (auto_assignment_mode IN ('disabled', 'round_robin', 'least_loaded'));

ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "enabled": false,
    "timezone": "UTC",
    "schedule": {
        "1": {"open": "09:00", "close": "18:00"},
        "2": {"open": "09:00", "close": "18:00"},
        "3": {"open": "09:00", "close": "18:00"},
        "4": {"open": "09:00", "close": "18:00"},
        "5": {"open": "09:00", "close": "18:00"}
    },
    "auto_reply_message": "Thank you for contacting us. We are currently outside of business hours."
}'::jsonb;

-- 3. Conversations: Snooze, Labels & After-Hours Suppression
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS last_after_hours_reply_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_conversations_snooze 
ON public.conversations(workspace_id, snoozed_until) 
WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_labels 
ON public.conversations USING GIN (labels);

-- 4. Internal Notes @Mention Agent Notifications
CREATE TABLE IF NOT EXISTS public.agent_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_notifications_member 
ON public.agent_notifications(member_id, is_read, created_at DESC);
