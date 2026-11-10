-- ====================================================================
-- WhatsPulse CRM — Migration 20261111_02: Outbound Queue & Care Window
-- Phase 1B: Care Window Tracking, Broadcast Queue & Opt-Out Status
-- ====================================================================

-- 1. Contacts: Opt-in / Opt-out Status (Minimal baseline for Phase 1B)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS opt_status VARCHAR(20) DEFAULT 'unknown' 
CHECK (opt_status IN ('opted_in', 'opted_out', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_contacts_opt_status ON public.contacts(workspace_id, opt_status);

-- 2. Conversations: 24-Hour Customer Care Window & Free Entry Point Expiration
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS fep_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_conversations_care_window ON public.conversations(workspace_id, last_inbound_at);

-- 3. Outbound Job Queue Table
CREATE TABLE IF NOT EXISTS public.outbound_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.broadcast_campaigns(id) ON DELETE SET NULL,
    job_type VARCHAR(50) NOT NULL DEFAULT 'broadcast' CHECK (job_type IN ('single', 'broadcast')),
    status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'paused', 'failed')),
    total_count INT NOT NULL DEFAULT 0,
    processed_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    batch_size INT NOT NULL DEFAULT 50,
    rate_limit_per_second INT NOT NULL DEFAULT 80,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_jobs_status ON public.outbound_jobs(workspace_id, status);

-- 4. Campaign Recipients Table (Per-recipient state & resumable batch tracking)
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.outbound_jobs(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
    wa_message_id VARCHAR(255),
    error_code INT,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for high-throughput locking: FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_claim 
ON public.campaign_recipients(job_id, status) 
WHERE status = 'pending';
