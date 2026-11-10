-- ====================================================================
-- WhatsPulse CRM — Migration 20261111_01: Webhook Events & Idempotency
-- Phase 1A: Reliability & Security
-- ====================================================================

-- 1. Webhook Raw Events Ledger (Durability & Asynchronous Processing)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(100),
    payload JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    attempts INT DEFAULT 0 NOT NULL,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for queue polling & retries
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_attempts ON public.webhook_events(status, attempts);
CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace ON public.webhook_events(workspace_id);

-- 2. Pending Status Updates (Handles status arriving before message exists)
CREATE TABLE IF NOT EXISTS public.pending_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    wa_message_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    error_code INT,
    error_details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_applied BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_statuses_wamid ON public.pending_statuses(wa_message_id) WHERE is_applied = false;

-- 3. Scoped Unique Index on Message wamid for Idempotency
-- Enforces that duplicate webhook deliveries are impossible at the database layer
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_unique_workspace_wamid 
ON public.messages(workspace_id, wa_message_id) 
WHERE wa_message_id IS NOT NULL;

-- 4. Add error_code column to messages for structured Meta error mapping
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS error_code INT;
