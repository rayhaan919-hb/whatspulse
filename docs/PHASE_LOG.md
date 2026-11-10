# WhatsPulse CRM — Phased Implementation & Verification Log

This log tracks all completed stops, architectural decisions, migration records, and automated test results.

---

## [STOP 1A] Phase 1A — Reliability Foundation: Webhooks, Idempotency, Ordering & Routing
- **Date / Timestamp:** 2026-11-11T03:26:00+05:00
- **Git Branch:** `phase-1a-webhooks`
- **Files Changed:**
  - `src/lib/whatsapp/webhook.ts` (Harden signature verification, monotonic status ranking, early-status resolution, idempotency)
  - `src/app/api/webhooks/whatsapp/route.ts` (Raw body verification, multi-tenant resolution, immediate 200 ack, async Next.js after() processing)
  - `src/lib/whatsapp/tenants.ts` (Multi-tenant routing by phone_number_id and pathToken)
  - `src/lib/whatsapp/event-queue.ts` (Webhook raw event ledger, async queue, retry tracking, dead-letter threshold)
  - `src/types/crm.ts` (Added WebhookEventRecord, PendingStatusRecord, TenantRoutingConfig, errorCode on Message)
  - `test-e2e.mjs` (TDD test suite with 28 automated test assertions)
- **Migrations Added:**
  - `supabase/migrations/20261111_01_webhook_events_and_idempotency.sql` (Creates `webhook_events`, `pending_statuses`, scoped unique index on `messages(workspace_id, wa_message_id)`, error_code column)
- **Environment Variables Added:**
  - `META_APP_SECRET` (Meta App Secret for HMAC SHA-256 signature verification)
  - `DEFAULT_WORKSPACE_ID` (Optional default workspace UUID fallback)
  - `DEFAULT_WORKSPACE_PATH_TOKEN` (Optional default URL routing token)
- **Tests Added & Results:**
  - Added 18 new automated tests to `test-e2e.mjs` (28 total):
    - Signature edge cases: null header, undefined header, empty secret, malformed prefix, truncated hex, oversized hex (pre-timingSafeEqual length check preventing RangeError)
    - GET handshake verification and invalid token/mode rejection
    - Multi-tenant routing by phone_number_id, pathToken, and unknown tenant rejection
    - Webhook idempotency: duplicate wamid delivery returns deduplicated no-op, single message row remains
    - Monotonic status ranking: sent -> delivered -> read; status "read" arriving before "delivered" does NOT downgrade
    - Early status arrival: status arriving before message stored in `pending_statuses`, applied immediately when message lands
    - Error code storage on failed statuses (code 131047 recorded on message)
  - TypeScript strict: PASS (`tsc --noEmit` exited 0)
  - Next.js Turbopack build: PASS (7/7 routes compiled cleanly)
  - E2E Tests: 28/28 passed (100%)
- **// VERIFY Items:**
  - Confirm webhook payload metadata extraction for multi-WABA setups (`entry[].changes[].value.metadata.phone_number_id`).
  - Confirm maximum retry backoff interval with Meta Graph API for webhook delivery.
- **Skipped & Rationale:**
  - Outbound sending untouched as instructed (strictly scoped to Phase 1A webhook receiving).
- **Status:** Complete / Ready for Review

## [STOP 1B] Phase 1B — Outbound Sending, Care Window & Error Mapping
- **Date / Timestamp:** 2026-11-11T03:34:00+05:00
- **Git Branch:** `phase-1b-outbound`
- **Files Changed:**
  - `src/lib/whatsapp/care-window.ts` (Created CareWindowService: server-side 24h window calculation, FEP 72h cost-only attribution, countdown formatting)
  - `src/lib/whatsapp/errors.ts` (Created MetaErrorMapper: central mapping of Meta codes 131047, 131049, 130429, 131056, 131026, 132000, 132001, 132012, 190 to human messages and retry policies)
  - `src/lib/queue/outbound-queue.ts` (Created OutboundQueue: chunked batch runner, crash resumption, opt-out filtering, token-bucket per-number rate limiter, exponential backoff)
  - `src/app/api/messages/send/route.ts` (Server-side 24h care window enforcement, structured error mapping)
  - `src/app/api/cron/outbound-worker/route.ts` (Protected cron worker route with Vercel Cron and pg_cron documentation)
  - `src/components/inbox/ChatWindow.tsx` (Conversation care window countdown chip, template-only composer locking when closed, failure bubble reason & retry button)
  - `src/app/page.tsx` (Pass lastInboundAt/fepExpiresAt to send endpoint, update lastInboundAt on inbound messages, render failed message state)
  - `src/lib/storage.ts` (Added lastInboundAt to demo conversations for open vs expired care window demonstration)
  - `src/types/crm.ts` (Added OptStatus, OutboundJob, CampaignRecipient, lastInboundAt, fepExpiresAt)
  - `test-e2e.mjs` (Added 17 new automated tests for Phase 1B, 45 total)
- **Migrations Added:**
  - `supabase/migrations/20261111_02_outbound_queue_and_window.sql` (Adds `contacts.opt_status`, `conversations.last_inbound_at`, `conversations.fep_expires_at`, creates `outbound_jobs` and `campaign_recipients` tables with `SKIP LOCKED` index)
- **Environment Variables Added:**
  - `CRON_SECRET` (Bearer token for authenticating `/api/cron/outbound-worker` cron jobs)
- **Tests Added & Results:**
  - Added 17 new automated test assertions to `test-e2e.mjs` (45 total):
    - 24h customer care window: non-template send outside window rejected with code 131047 (`WINDOW_CLOSED`), template send permitted, within-window non-template permitted, window resets on inbound message
    - Free Entry Point (FEP): 72h window sets `fep_expires_at` for cost attribution only, NEVER permits free-form sends after 24h
    - Campaign chunking & resumption: 5,000-recipient batch processed in chunks, resumes after simulated crash without re-sending
    - Opt-out filtering: contacts with `opt_status = 'opted_out'` are skipped and counted accurately
    - Per-number rate limit: 80 MPS rate limiter throttles excess burst dispatches
    - Meta error mapping: code 130429 & 131056 mapped to retryable with backoff, code 131047 & 131026 & 190 mapped to permanent failure
  - TypeScript strict: PASS (`tsc --noEmit` exited 0)
  - Next.js Turbopack build: PASS (8/8 routes compiled cleanly)
  - E2E Tests: 45/45 passed (100%)
- **// VERIFY Items:**
  - Confirmed: FEP referral only discounts message billing to zero; freeform messaging clock remains strictly gated by 24h from last customer reply.
  - Confirmed: Meta Cloud API default rate limit is 80 MPS per registered phone number.
- **Skipped & Rationale:**
  - Full opt-in/opt-out ledger tables and campaign compliance warnings are scheduled for Phase 2 as specified in prompt and `docs/IMPROVEMENT_PLAN.md`.
- **Status:** Complete / Ready for Review


