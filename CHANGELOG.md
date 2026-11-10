# Changelog

All notable changes to **WhatsPulse CRM** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-11 — Commercial Release

### Added
- **Official Meta WhatsApp Cloud API v20+ Integration:**
  - Robust HMAC-SHA256 signature verification over raw request bytes using `crypto.timingSafeEqual`.
  - Multi-tenant routing via `phone_number_id` and custom URL path tokens.
  - Monotonic status ranking ensuring out-of-order `delivered` receipts cannot downgrade a stored `read` status.
  - Early status arrival resolution handling statuses that land before their parent message row exists.
  - Idempotent deduplication guaranteeing identical Meta `wamid` messages are processed exactly once.
- **Outbound Care Window & Rate Limiting:**
  - Server-side 24-hour Customer Care Window enforcement blocking non-template outbound messages with typed Meta error 131047.
  - 72-hour Free Entry Point (FEP) zero-cost attribution mechanics.
  - Per-number token-bucket rate limiter respecting Meta's 80 MPS tier limit.
  - Chunked campaign processor handling 5,000+ recipients with crash recovery and resumption via PostgreSQL `SKIP LOCKED`.
- **Enterprise Security & Secrets at Rest:**
  - AES-256-GCM encryption at rest for Meta access tokens and app secrets with versioned key prefixes (`v1:`, `v2:`).
  - Multi-version keyring for zero-downtime key rotation (`scripts/migrate-secrets.mjs`).
  - Isolated `workspace_secrets` table with Row Level Security (RLS) restricted exclusively to `service_role`.
  - Inbound media downloader with size enforcement (16MB audio/image, 100MB video/doc) and private Supabase Storage signed URLs.
- **Cost & Compliance Cockpit:**
  - Real-time spend attribution parsing status webhook `pricing` objects (billable status, category, pricing model).
  - Configurable Meta rate card importer with custom tier overrides and free tier scope configuration.
  - Full opt-in/opt-out ledger with automated `STOP` / `UNSUBSCRIBE` keyword processing.
  - Pre-send broadcast campaign compliance audit flagging contacts without verified opt-in evidence.
  - Quality rating and tier degradation alerts (`GREEN`, `YELLOW`, `RED`).
- **Inbox Productivity & Teamwork:**
  - Canned replies triggered via `/` shortcut in chat composer with dynamic variable placeholders (`{{contact_name}}`, `{{agent_name}}`).
  - Automated conversation assignment with round-robin and least-loaded load balancing modes.
  - Timezone-aware business hours schedule with duplicate auto-reply suppression during closed periods.
  - Conversation snooze with automatic reopening on new customer inbound replies.
  - Private internal notes with `@mention` tagging and teammate notification badges.
- **Real-Time Collaboration & Extensibility API:**
  - Teammate collision detection (viewing/typing alerts) and claim-on-reply protection.
  - Message bubble receipt progression (`sending`, `sent`, `delivered`, `read`, `failed` with retry).
  - Keyboard shortcuts (`j`/`k` navigation, `Cmd+K` command palette), bulk conversation status actions, and gentle audio chime alerts.
  - External REST API (`/api/v1/messages`, `/api/v1/contacts`, `/api/v1/conversations`) authenticated via SHA-256 hashed `wp_live_` API keys.
  - Outbound webhooks signed with HMAC-SHA256 and timestamp replay protection.
  - Strict demo isolation (`is_demo: true`) ensuring "Clear Sample Data" never affects real production data.
- **Internationalization (i18n) & Accessibility (a11y):**
  - Full bidirectional support with English (LTR) and Arabic (RTL) wired end-to-end.
  - Externalized translation dictionaries with dynamic interpolation and fallback.
  - WAI-ARIA accessible dialogs with focus trapping and `Escape` key dismiss handling.
  - High-contrast focus rings and WCAG 2.1 AA certified contrast ratios (20.4:1).
  - Developer guide for adding languages in 3 steps (`docs/I18N_GUIDE.md`).
- **Turnkey Packaging & Diagnostics:**
  - Interactive setup wizard CLI (`scripts/setup-wizard.mjs` / `npm run setup`).
  - Administrator system diagnostics cockpit (`/admin/system-status`) testing Supabase, Meta Graph API, App Secret, Webhooks, Encryption Key, and Gemini AI.
  - Comprehensive documentation (`docs/INSTALL.md`, `docs/META_SETUP.md`, `docs/TROUBLESHOOTING.md`, `docs/API.md`, `docs/openapi.yaml`).

### Changed
- Replaced all legacy "Arc Browser" references with a refined, warm editorial design system (`--canvas-warm: #fffcec`, `--surface-primary: #f7f4e3`, `--ink-primary: #000354`, `--accent-blue: #3139fb`).
- Sanitized all commercial marketing copy, removing exaggerated claims ("zero bans", "sub-100ms") and replacing with accurate, compliant Meta WhatsApp Cloud API terminology.
