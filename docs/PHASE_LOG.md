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

