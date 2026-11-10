-- ====================================================================
-- WhatsPulse CRM — Migration 20261112_01: Pricing & Compliance
-- Phase 2: Cost Tracking, Rate Cards, Opt-In/Opt-Out Ledger & Quality Logs
-- ====================================================================

-- 1. Messages: Attach Meta Status Pricing Object & Campaign Attribution
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS pricing JSONB;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.broadcast_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_campaign ON public.messages(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_pricing_category ON public.messages((pricing->>'category')) WHERE pricing IS NOT NULL;

-- 2. Compliance: Opt-In / Opt-Out Immutable Audit Ledger
CREATE TABLE IF NOT EXISTS public.opt_in_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('opted_in', 'opted_out', 'unknown')),
    source VARCHAR(50) NOT NULL, -- 'keyword_stop', 'keyword_start', 'web_form', 'checkout_checkbox', 'api', 'manual_admin', 'import'
    evidence_note TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opt_in_ledger_phone 
ON public.opt_in_ledger(workspace_id, phone_number, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_opt_in_ledger_contact 
ON public.opt_in_ledger(contact_id, timestamp DESC);

-- 3. Dynamic Workspace Rate Cards (Do NOT hardcode Meta pricing)
CREATE TABLE IF NOT EXISTS public.workspace_rate_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    marketing_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0500,
    utility_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0150,
    service_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0100,
    authentication_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0300,
    country_rates JSONB DEFAULT '{}'::jsonb, -- Custom country-specific rate overrides
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Free Allowance Configuration in WABA Configs
ALTER TABLE public.waba_configs 
ADD COLUMN IF NOT EXISTS allowance_scope VARCHAR(20) DEFAULT 'waba' 
CHECK (allowance_scope IN ('waba', 'phone_number'));

ALTER TABLE public.waba_configs 
ADD COLUMN IF NOT EXISTS free_service_messages_monthly INT DEFAULT 1000;

ALTER TABLE public.waba_configs 
ADD COLUMN IF NOT EXISTS messaging_limit VARCHAR(50) DEFAULT 'TIER_10K';

-- 5. Phone Quality & Messaging Limit Audit Logs
CREATE TABLE IF NOT EXISTS public.phone_quality_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(100),
    display_phone_number VARCHAR(50),
    quality_rating VARCHAR(50) NOT NULL, -- 'GREEN', 'YELLOW', 'RED', 'UNKNOWN'
    messaging_limit VARCHAR(50),        -- 'TIER_1K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED'
    event VARCHAR(100),                 -- 'ON_FLAGGED', 'ON_WARNING', 'ON_LIMIT_CHANGED', 'ON_UNFLAGGED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phone_quality_logs_workspace 
ON public.phone_quality_logs(workspace_id, created_at DESC);

-- 6. In-App Degradation & Policy Alerts
CREATE TABLE IF NOT EXISTS public.in_app_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'danger')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_in_app_alerts_unack 
ON public.in_app_alerts(workspace_id, created_at DESC) 
WHERE acknowledged = false;
