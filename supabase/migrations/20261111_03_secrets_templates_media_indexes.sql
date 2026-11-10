-- ====================================================================
-- WhatsPulse CRM — Migration 20261111_03: Secrets, Templates & Media Indexes
-- Phase 1C: Token Encryption at Rest, Template Enhancements & DB Indexes
-- ====================================================================

-- 1. Workspace Secrets Table (Zero Client Access — Service Role Only)
CREATE TABLE IF NOT EXISTS public.workspace_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    key_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    access_token_encrypted TEXT NOT NULL,
    app_secret_encrypted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id)
);

-- Enable RLS strictly: with NO policies defined for anon or authenticated roles,
-- direct client SDK queries are blocked unconditionally; only service_role can read/write.
ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;

-- 2. Message Templates Enhancements
ALTER TABLE public.message_templates 
ADD COLUMN IF NOT EXISTS header_type VARCHAR(20) DEFAULT 'NONE';

ALTER TABLE public.message_templates 
ADD COLUMN IF NOT EXISTS quality_rating VARCHAR(50) DEFAULT 'UNKNOWN';

ALTER TABLE public.message_templates 
ADD COLUMN IF NOT EXISTS variable_count INT DEFAULT 0;

-- 3. High-Performance Compound & Partial Indexes for Live Inbox
-- Optimize fast sorting by recent activity within each workspace
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_last_message 
ON public.conversations(workspace_id, last_message_at DESC);

-- Partial index for active unread conversation filtering
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_unread 
ON public.conversations(workspace_id) 
WHERE unread_count > 0;

-- Optimize conversation message history retrieval in chronological order
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages(conversation_id, created_at ASC);
