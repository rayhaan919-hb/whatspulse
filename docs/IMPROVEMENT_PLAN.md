# WhatsPulse CRM Commercial Hardening & Completion Plan
**Document Version:** 2.0.0  
**Status:** PHASE 0 - AUDIT COMPLETE (Ready for Review)  
**Target:** CodeCanyon Commercial Release + Agency Custom Deployments  
**Stack:** Next.js 16.4.6 (App Router, Turbopack), React 19.3.0, TypeScript Strict, Tailwind CSS v4, Supabase (Postgres + RLS + Realtime), Meta WhatsApp Cloud API v20+, Google Gemini API.

---

## 1. Executive Summary & Audit Baseline

WhatsPulse CRM currently operates as a working functional prototype with an editorial interface, working in-memory/localStorage state engine, baseline Meta webhook handshake validation, message dispatch abstractions, and a 10-test automated verification suite (`test-e2e.mjs`).

Transitioning to a hardened, enterprise-grade, commercial release requires executing a modular, phased roadmap where each stop is tested independently.

### Current Verification Baseline:
- **TypeScript (`tsc --noEmit`):** ✅ PASSED (0 errors, strict mode)
- **Next.js Turbopack Build (`npm run build`):** ✅ PASSED (7/7 routes compiled)
- **Automated Verification (`node test-e2e.mjs`):** ✅ PASSED (10/10 tests, 100%)

---

## 2. Checklist vs. Current Repository State

| Checklist Item | Current Status | Analysis / Gaps Found |
| :--- | :---: | :--- |
| **Phase 1A: Raw Body Signature Verification** | ⚠️ Partial | Reads `request.text()` first, but if `APP_SECRET` is unset it silently passes (`return true`). Uses global env var instead of resolving tenant app secret. |
| **Phase 1A: Async Webhook Persistence & 200 Ack** | ❌ Missing | No `webhook_events` table exists. Webhook parses synchronously in-request; if internal processing fails or takes >5s, Meta retries or disables the endpoint. |
| **Phase 1A: Webhook Message Idempotency** | ⚠️ Partial | `idx_messages_wa_id` exists in `schema.sql`, but lacks `UNIQUE(wa_message_id)`. Duplicate webhook deliveries would insert duplicate rows. |
| **Phase 1A: Out-of-Order Status Monotonicity** | ❌ Missing | Status updates are applied blindly without monotonic checks (`sent` < `delivered` < `read`). No pending status holding table. |
| **Phase 1A: Multi-Tenant Routing & Secrets** | ❌ Missing | Single global webhook route without path token or `phone_number_id` lookup to isolate tenant `app_secret` and access tokens. |
| **Phase 1A: Extended `test-e2e.mjs` Suite** | ❌ Missing | Covers basic 10 tests. Missing tests for duplicates, out-of-order statuses, window enforcement, tenant routing, and parameter validation. |
| **Phase 1B: Outbound Broadcast Job Queue** | ❌ Missing | Broadcasts run via UI state in-memory loop. No `campaign_recipients` or `outbound_jobs` table, no rate limiting, no chunking for serverless time limits. |
| **Phase 1B: Opt-in / Opt-out Filtering** | ❌ Missing | Contacts have `is_blocked`, but no opt-in verification or opt-out ledger table. Broadcasts do not skip non-opted-in contacts. |
| **Phase 1B: 24-Hour Customer Care Window** | ❌ Missing | `conversations` tracks `last_message_at`, but not `last_inbound_at`. No server-side rejection of non-template sends outside 24h. No UI countdown chip or template lock. |
| **Phase 1B: Meta Error Code Mapping Table** | ❌ Missing | Error codes (131047, 131049, 130429, etc.) are unmapped strings. No retry rules or UI retry buttons. |
| **Phase 1C: Graph API Template Sync & Webhooks** | ❌ Missing | Templates are hardcoded in `src/lib/storage.ts`. No Graph API sync endpoint, no handler for `message_template_status_update`, no dynamic parameter validation. |
| **Phase 1C: Inbound Media Storage** | ❌ Missing | Inbound media defaults to placeholder text `📷 [Photo Attached]`. Does not download Meta short-lived URLs to Supabase Storage. |
| **Phase 1C: Secrets Encryption at Rest** | ❌ Missing | `waba_configs` table stores tokens in plain text. No app-level AES-GCM or Vault encryption, no isolated service-role-only table. |
| **Phase 1C: Realtime Broadcast & DB Indexes** | ⚠️ Partial | Basic single-column indexes exist. Compound indexes for `(workspace_id, status, last_message_at DESC)` and `(workspace_id, unread_count)` are missing. |
| **Phase 2: Status Pricing Object Storage** | ❌ Missing | `ParsedStatusUpdate` in `webhook.ts` and `messages` table ignore the Meta `pricing` payload object (`billable`, `category`, `pricing_model`). |
| **Phase 2: Spend & Analytics Dashboard** | ⚠️ Partial | Dashboard shows message counts and dummy SLAs, but zero financial/spend telemetry, no rate card import, no category breakdown. |
| **Phase 2: Opt-In/Opt-Out Ledger & STOP Keywords**| ❌ Missing | No automated listener for STOP/UNSUBSCRIBE, no compliance ledger, no pre-send campaign warning. |
| **Phase 2: Quality Rating & Messaging Tier Alerts**| ⚠️ Partial | Static `'GREEN'` badge in `waba_configs`. No `phone_number_quality_update` webhook processing or threshold degradation alerts. |
| **Phase 3A: Canned Replies & Auto-Assignment** | ❌ Missing | No canned replies (`/`), round-robin auto-assignment, business hours with auto-reply, snooze, or `@mentions`. |
| **Phase 3B: Presence, UX & Extensibility** | ⚠️ Partial | Has checkmarks (`✓✓`), but no typing/viewing collision detection, no claim-on-reply, no keyboard shortcuts (j/k, Cmd+K), no REST API / OpenAPI spec. |
| **Phase 3B: Strict `is_demo` Isolation** | ⚠️ Partial | Demo mode is stored in `localStorage` and React state, but not persisted or flagged with an `is_demo` column in database tables. |
| **Phase 4A: Design Polish & Visual Architecture** | ⚠️ Partial | Light editorial palette is functional. Dark mode, compact density, skeleton loaders, and reduced-motion tokens are missing. |
| **Phase 4B: White-Labeling, i18n & Accessibility**| ⚠️ Partial | Needs dynamic CSS variable branding, i18n with RTL logical properties, ARIA dialog pass, and removal of "Arc Browser" copy. |
| **Phase 5: Distribution & Packaging** | ❌ Missing | Needs `npm run setup` using `SUPABASE_DB_URL`, admin `/admin/system-status` diagnostic, docs suite, sanitization, and third-party credits. |

---

## 3. High-Priority Risks Identified

1. **Webhook Dropped Messages & Meta Timeout (P0):**
   - Meta requires an HTTP 200 response within 5 seconds. If Supabase DB latency spikes or if multiple inbound messages arrive in a single webhook payload, processing in-request will cause HTTP 504 timeouts. Meta retries up to 7 days with exponential backoff and eventually disables the webhook.
   - *Fix (Phase 1A):* Ingest raw payload into a durable `webhook_events` staging table, respond with HTTP 200 immediately, and process asynchronously.
2. **Status Receipt Race Condition & Downgrade (P0):**
   - WhatsApp message statuses are asynchronous. In cellular networks, `read` or `delivered` receipts can arrive before the server has finished creating the initial `message` record, or `delivered` can arrive after `read`.
   - *Fix (Phase 1A):* Enforce status hierarchy (`pending` < `sent` < `delivered` < `read`). Maintain a `pending_status_updates` table to latch receipts for messages that have not yet landed in the DB.
3. **Out-of-Window Account Penalties & Template Rejection (P1):**
   - Dispatching freeform text outside the 24-hour customer service window results in Meta Graph API Error `131047`. Multiple violations degrade the WABA quality rating.
   - *Fix (Phase 1B):* Server-side window calculation based on `last_inbound_at`, strict validation before Graph API calls, and automatic UI composer lockout switching to template selection.
4. **Credential Exposure Risk (P1):**
   - Permanent Meta System User tokens have full administrative control over the WABA. Storing them in readable tables or exposing them to client Supabase queries violates security standards.
   - *Fix (Phase 1C):* Encrypted storage via AES-256-GCM, isolated `waba_secrets` table with `GRANT ALL ON ... TO service_role` and zero `SELECT` access for `authenticated` or `anon` client roles.
5. **Serverless Broadcast Timeouts (P1):**
   - Sending broadcast campaigns to 500+ recipients in an in-memory loop will exceed Vercel/Next.js execution timeouts (10s–15s).
   - *Fix (Phase 1B):* Chunked queue with `campaign_recipients`, processing 25–50 messages per batch with exponential backoff and rate-limiting.

---

## 4. Phased Execution Roadmap & File Targets

### PHASE 1A: Reliability Foundation (Webhooks, Idempotency, Ordering, Tenant Routing, Tests)
* **Goal:** Hardened, asynchronous, multi-tenant webhook ingestion with cryptographic verification, idempotency, monotonic status ordering, and full TDD coverage.
* **Database Migrations:**
  - `supabase/migrations/20261111_01_webhook_events_and_idempotency.sql` (Creates `webhook_events` table, `pending_status_updates` table, adds `UNIQUE(wa_message_id)` to `messages`, compound indexes).
* **Files to Touch / Create:**
  - `src/lib/whatsapp/webhook.ts`: Raw body verification with `crypto.timingSafeEqual`, tenant app secret resolution, monotonic status checks (`sent` < `delivered` < `read`), pending status resolution.
  - `src/app/api/webhooks/whatsapp/route.ts`: Path token or `phone_number_id` lookup to resolve workspace, write raw payload to `webhook_events`, return HTTP 200 immediately, dispatch asynchronous background processor via Next.js `after()`.
  - `src/types/crm.ts`: Update status types, webhook event persistence interfaces, and tenant routing definitions.
  - `test-e2e.mjs`: Write failing tests first, then verify:
    - Bad HMAC signature rejection
    - Duplicate delivery idempotency (same `wamid` must be a no-op)
    - Out-of-order status receipts (monotonic guarantee: `delivered` after `read` does not downgrade)
    - Status arriving before message row exists (stored in `pending_status_updates` and resolved when message lands)
    - Multi-tenant webhook routing resolution

### PHASE 1B: Outbound Queue, Care Window & Error Handling
* **Goal:** Reliable outbound message dispatch, background broadcast queue with rate limiting, server-side 24h care window enforcement, and central Meta error code handling.
* **Database Migrations:**
  - `supabase/migrations/20261111_02_outbound_queue_and_window.sql` (Adds `last_inbound_at` and `referral_fep_expires_at` to `conversations`, creates `outbound_jobs` and `campaign_recipients` tables).
* **Files to Touch / Create:**
  - `src/lib/whatsapp/errors.ts` (New): Central Meta error code dictionary (codes 131047, 131049, 130429, 131056, 131026, 132000, 132001, 132012, 190) mapping to human messages and retry policies.
  - `src/lib/queue/outbound-queue.ts` (New): Resumable chunked processor with per-number rate-limiting (respecting MPS cap) and exponential backoff.
  - `src/app/api/messages/send/route.ts`: Enforce 24h customer care window server-side. Reject free-form text outside window with typed error. Map Meta error codes to structured responses.
  - `src/components/inbox/ChatWindow.tsx`: 24h window countdown chip, automatic switch to template-only mode when expired, readable error reason and "Retry" button on failed messages.
  - `src/components/broadcast/CampaignWizard.tsx`: Wire to `campaign_recipients` queue, report skip counts for unconfirmed opt-in / opted-out contacts.
  - `test-e2e.mjs`: Add tests for 24h window rejection, free entry point referral extension, error code mapping, and queue retry logic.

### PHASE 1C: Templates, Media, Secrets & DB Performance
* **Goal:** Dynamic Graph API template sync, secure inbound media download to Supabase Storage, token encryption at rest, and optimized DB compound indexes.
* **Database Migrations:**
  - `supabase/migrations/20261111_03_secrets_and_templates.sql` (Creates isolated `waba_secrets` table restricted to `service_role`, adds encrypted token columns, compound indexes for inbox list ordering and unread counts).
* **Files to Touch / Create:**
  - `src/lib/whatsapp/crypto.ts` (New): AES-256-GCM token encryption and decryption utilities.
  - `src/lib/whatsapp/media.ts` (New): Inbound media downloader querying Graph API binary endpoint and piping to Supabase Storage bucket.
  - `src/lib/whatsapp/client.ts`: Template parameter validation (checking variable count and button URLs), header media support.
  - `src/app/api/templates/sync/route.ts` (New): Fetch and sync templates from Meta Graph API.
  - `src/app/api/webhooks/whatsapp/route.ts`: Handle `message_template_status_update`.
  - `test-e2e.mjs`: Add tests for template parameter mismatch, token encryption/decryption, and media download flow.

### PHASE 2: Cost & Compliance Cockpit
* **Goal:** Financial transparency, configurable Meta rate cards, opt-in/opt-out compliance ledger, and quality rating alerts.
* **Database Migrations:**
  - `supabase/migrations/20261112_01_pricing_and_compliance.sql` (Adds `pricing` JSONB to `messages`, creates `opt_in_ledger`, `workspace_rate_cards`, `phone_quality_logs`).
* **Files to Touch / Create:**
  - `src/lib/whatsapp/pricing.ts` (New): Cost engine calculating spend per message based on status webhook `pricing` object and custom workspace rate cards.
  - `src/lib/whatsapp/compliance.ts` (New): STOP / UNSUBSCRIBE keyword listener, opt-out ledger recording, pre-send broadcast validation.
  - `src/components/analytics/AnalyticsView.tsx`: Real-time spend per workspace/campaign/day, category breakdown (marketing, utility, service), custom rate card importer.
  - `src/components/settings/WabaSettings.tsx`: Messaging tier display, quality rating indicator, degradation alert banners.
  - `test-e2e.mjs`: Add tests for pricing parsing, rate card calculation, and STOP keyword handling.

### PHASE 3A: Core Inbox Productivity
* **Goal:** High-velocity multi-agent support tools (canned replies, auto-assignment, business hours, snooze).
* **Database Migrations:**
  - `supabase/migrations/20261113_01_inbox_productivity.sql` (Creates `canned_replies`, adds `business_hours` to `workspaces`, `snoozed_until` to `conversations`).
* **Files to Touch / Create:**
  - `src/lib/inbox/canned-replies.ts` (New): Fast slash command `/` matcher and macro inserter.
  - `src/lib/inbox/assignment.ts` (New): Round-robin and least-loaded conversation assignment algorithms.
  - `src/lib/inbox/business-hours.ts` (New): Check schedule and dispatch automated after-hours response.
  - `src/components/inbox/ChatWindow.tsx`: `/` canned reply autocomplete popover, snooze button (auto-reopens on new inbound message), `@mention` autocomplete in internal notes.
  - `src/components/inbox/ConversationList.tsx`: Snooze badge, auto-assignment status tags.

### PHASE 3B: Presence, UX & Extensibility
* **Goal:** Collision avoidance, message state clock, keyboard accessibility, external REST API, and clean demo data separation.
* **Database Migrations:**
  - `supabase/migrations/20261113_02_api_and_demo_isolation.sql` (Creates `workspace_api_keys`, adds `is_demo` boolean column to all entity tables).
* **Files to Touch / Create:**
  - `src/lib/realtime/presence.ts` (New): Supabase Realtime broadcast for "agent viewing" and "agent typing", claim-on-reply locking.
  - `src/app/api/v1/openapi.json` (New): OpenAPI 3.1 specification for external CRM integrations.
  - `src/app/api/v1/messages/route.ts` & `src/app/api/v1/contacts/route.ts` (New): Public REST API authenticated via workspace API keys.
  - `src/components/inbox/ChatWindow.tsx`: Collision warning banner ("Alex is typing..."), message state progression clock icon, notification sound.
  - `src/components/inbox/ConversationList.tsx`: Keyboard navigation (j/k shortcuts, Cmd+K command palette), bulk status change / assign actions.
  - `src/lib/storage.ts`: Isolate sample demo data with `is_demo: true`; "Clear Sample Data" deletes only `is_demo` rows.

### PHASE 4A: Design Polish & Visual Architecture
* **Goal:** Editorial dark mode, compact density, optimistic updates, and performance animations.
* **Files to Touch / Create:**
  - `src/app/globals.css`: Dark mode editorial color tokens (`--canvas`, `--surface`, `--ink`, `--muted`), compact density scale, prefers-reduced-motion guards.
  - `src/components/layout/Navbar.tsx`: Dark mode toggle, density switcher (comfortable vs. compact).
  - `src/components/inbox/ChatWindow.tsx`: Optimistic message appending with sending clock, animated status transitions, skeleton loading states.

### PHASE 4B: White-Labeling, i18n & Accessibility
* **Goal:** White-label customization, internationalization with full RTL support, WCAG compliance, and brand neutrality.
* **Files to Touch / Create:**
  - `src/components/settings/BrandingSettings.tsx` (New): Workspace white-label configurator (app title, logo URL, primary brand color via CSS variables).
  - `src/lib/i18n/` (New): Lightweight i18n helper supporting English + Arabic/Hebrew RTL.
  - `src/app/globals.css`: Migrate physical spacing properties to logical properties (`ms-`, `me-`, `ps-`, `pe-`, `border-inline`).
  - Search & replace across all components, docs, and metadata: Remove all references to "Arc Browser", replace with "warm editorial theme".
  - Accessibility audit: ARIA roles on dialogs/drawers, keyboard trap management, high-contrast focus rings.

### PHASE 5: CodeCanyon Distribution Packaging
* **Goal:** Commercial turnkey distribution readiness for CodeCanyon buyers and agency self-hosters.
* **Files to Touch / Create:**
  - `scripts/setup-wizard.mjs` (New): Interactive CLI setup tool (`npm run setup`) that checks Node version, validates environment variables, tests Supabase connectivity, executes SQL migrations using `SUPABASE_DB_URL` (or Supabase CLI, since REST API cannot execute DDL), seeds the first admin user, and tests the webhook.
  - `src/app/admin/system-status/page.tsx` (New): Admin-only diagnostic dashboard. Checks Supabase connection, webhook reachability, live Meta Graph API token validity (via `GET /me`), and Gemini key presence. Never reveals secret values.
  - `docs/INSTALL.md`: Merged installation guide incorporating all steps from `SETUP_GUIDE.md` plus local/Vercel/Docker deployment instructions.
  - `docs/META_SETUP.md`: Comprehensive walkthrough for Meta Developer App creation, System User permanent token generation, and Webhook subscription. Must emphasize that clicking Meta's "Verify and Save" is the final confirmation of webhook correctness.
  - `docs/TROUBLESHOOTING.md`, `docs/API.md`: Common error resolutions and API usage guides.
  - `CHANGELOG.md`: Place in repository root detailing version history and compliance updates.
  - `CREDITS.md`: Open-source licenses and third-party attribution.
  - `README.md`: Sanitized commercial copy: remove every claim of "zero bans" and "sub-100ms delivery"; replace with accurate compliance phrasing ("Built 100% on the official Meta WhatsApp Cloud API with opt-in and quality management tools to minimize restriction risks"). Scan and eliminate any hardcoded test tokens or personal data. Add Vercel 1-click deploy section.

---

## 5. Execution Protocol & Verification

Every phase and sub-phase will strictly follow `docs/AGENT_RULES.md`:
1. Work one stop at a time on its own dedicated git branch.
2. Write failing tests first in `test-e2e.mjs`.
3. Implement clean, minimal code with zero `any` and strict TypeScript.
4. Run `tsc`, `lint`, `build`, and `test-e2e.mjs`.
5. Append structured entry to `docs/PHASE_LOG.md`.
6. STOP and wait for review before moving to the next stop.
