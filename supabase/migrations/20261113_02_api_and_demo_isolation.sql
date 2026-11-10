-- ====================================================================
-- WhatsPulse CRM — Migration 20261113_02: API Keys, Outbound Webhooks & Demo Data Isolation
-- Phase 3B: Workspace API Keys, Outbound HMAC Webhooks, Strict is_demo Isolation
-- ====================================================================

-- 1. Strict Demo Data Isolation: Add is_demo Flag to All Entity Tables
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.broadcast_campaigns 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_is_demo 
ON public.conversations(workspace_id, is_demo);

CREATE INDEX IF NOT EXISTS idx_contacts_is_demo 
ON public.contacts(workspace_id, is_demo);

CREATE INDEX IF NOT EXISTS idx_messages_is_demo 
ON public.messages(workspace_id, is_demo);

-- 2. Workspace REST API Keys (Hashed at rest via SHA-256)
CREATE TABLE IF NOT EXISTS public.workspace_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(50) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_hash 
ON public.workspace_api_keys(key_hash) 
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_ws 
ON public.workspace_api_keys(workspace_id, created_at DESC);

-- 3. Outbound Webhook Subscriptions (HMAC SHA-256 Signed)
CREATE TABLE IF NOT EXISTS public.outbound_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    endpoint_url TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_ws 
ON public.outbound_webhooks(workspace_id) 
WHERE is_active = true;

-- 4. Outbound Webhook Delivery Log & Retry Ledger
CREATE TABLE IF NOT EXISTS public.outbound_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.outbound_webhooks(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed', 'retrying')),
    attempts INTEGER NOT NULL DEFAULT 1,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_deliveries_ws 
ON public.outbound_webhook_deliveries(workspace_id, created_at DESC);
