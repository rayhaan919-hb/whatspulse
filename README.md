# ⚡ WhatsPulse CRM — Official Meta WhatsApp Cloud API SaaS & Multi-Agent Inbox

> **The modern, high-converting WhatsApp CRM and Broadcast Suite built with Next.js 16 (Turbopack), React 19, TypeScript strict, Tailwind CSS, and Supabase.**  
> Built strictly on the official Meta WhatsApp Cloud API (v20+), with zero unofficial QR-scan libraries or reverse-engineered protocols, featuring proactive opt-in compliance ledgers and tier health monitors to minimize restriction risk.

## ⚡ 1-Click Vercel Deployment

Click the button below to deploy WhatsPulse CRM directly to Vercel with automatic serverless route configuration and optimized edge caching:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-org%2Fwhatspulse-crm&env=NEXT_PUBLIC_APP_URL,META_PHONE_NUMBER_ID,META_WABA_ID,META_ACCESS_TOKEN,META_APP_SECRET,META_WEBHOOK_VERIFY_TOKEN,ENCRYPTION_KEY,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY)

---

## 📋 System Requirements

Before running WhatsPulse CRM, make sure you have:

* **Node.js:** `>= 20.0.0` (LTS recommended, verified on Node.js v22).
* **Supabase Project:** Free or Pro PostgreSQL database with Row Level Security (RLS) and Realtime enabled.
* **Meta Developer App:** Official WhatsApp Cloud API enabled with an Admin System User permanent access token and Webhook subscription.
* **Google Gemini API Key (Optional):** For context-aware AI Copilot agent drafts and sentiment analysis (free tier available at Google AI Studio).

---

## 🚀 Key Architectural Features

* **🛡️ Official Meta WhatsApp Cloud API v20+ Integration:**
  * Raw-body HMAC-SHA256 signature verification via `crypto.timingSafeEqual`.
  * Monotonic status ranking ensuring out-of-order `delivered` receipts never downgrade stored `read` statuses.
  * Late-message status inheritance and idempotent deduplication of Meta `wamid` messages.
  * Server-side 24-hour Customer Care Window enforcement and 72-hour Free Entry Point (FEP) cost attribution.

* **🔒 Enterprise Cryptography at Rest:**
  * Meta System User tokens and App Secrets encrypted at rest using **AES-256-GCM** with versioned key prefixes (`v1:`, `v2:`).
  * Multi-version keyring for zero-downtime key rotation (`scripts/migrate-secrets.mjs`).
  * Isolated `workspace_secrets` table strictly restricted to `service_role` (no `anon` or `authenticated` access).

* **💬 Unified Team Inbox & Productivity:**
  * Warm editorial design system (`#fffcec` canvas, `#f7f4e3` surfaces, `#000354` ink) with accessible contrast (20.4:1).
  * Bidirectional internationalization: English (LTR) and Arabic (RTL) wired end-to-end.
  * Canned replies autocomplete via `/` shortcut with dynamic placeholders (`{{contact_name}}`, `{{agent_name}}`).
  * Round-robin and least-loaded auto-assignment, snooze with auto-reopen on reply, and private notes with `@mention` notifications.
  * Collision detection (who is viewing/typing) and claim-on-reply protection.

* **📊 Cost & Compliance Cockpit:**
  * Spend attribution per workspace, campaign, and day based on status webhook `pricing` objects.
  * Custom Meta rate card importer with tier overrides.
  * Full opt-in/opt-out ledger with automatic `STOP` / `UNSUBSCRIBE` keyword processing.
  * Pre-send broadcast campaign compliance audit flagging contacts without verified opt-in.

* **🔌 External REST API & Outbound Webhooks:**
  * Documented REST API (`/api/v1/messages`, `/api/v1/contacts`, `/api/v1/conversations`) authenticated via hashed `wp_live_` API keys.
  * Complete OpenAPI 3.1 specification at `docs/openapi.yaml`.
  * Outbound webhook subscriptions with HMAC-SHA256 signatures (`X-WhatsPulse-Signature-256`) and replay attack protection.

* **🔍 Admin System Diagnostics Cockpit:**
  * Accessible at `/admin/system-status`.
  * Live verification of Supabase, Meta Graph API tokens, App Secrets, Webhooks, Encryption Keys, and Gemini AI without ever leaking secret values.

---

## 🏃 Quick Start (Local Development)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/your-org/whatspulse-crm.git
cd whatspulse-crm
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your credentials in `.env.local` (see [docs/INSTALL.md](docs/INSTALL.md) for full instructions).

### 3. Run Turnkey Setup Wizard
```bash
npm run setup
```
The wizard validates your environment, tests database connections, checks SQL migrations, formats the admin user seed, and runs a webhook self-check.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📚 Documentation & Guides

* **[Turnkey Installation & Deployment Guide](docs/INSTALL.md):** Complete guide for local dev, Supabase migrations, Vercel 1-click, and Docker/VPS self-hosting.
* **[Official Meta WhatsApp Cloud API Setup](docs/META_SETUP.md):** Step-by-step walkthrough for Meta Developer Apps, Business Portfolio, permanent System User tokens, and Webhook subscription.
* **[Troubleshooting & Diagnostics](docs/TROUBLESHOOTING.md):** Solutions for common Webhook 403s, 24-hour care window (error 131047), token expiration (error 190), and encryption keys.
* **[External REST API & Webhooks](docs/API.md):** Reference guide and integration examples for external CRM automation.
* **[OpenAPI 3.1 Specification](docs/openapi.yaml):** Machine-readable API schema.
* **[Internationalization (i18n) Guide](docs/I18N_GUIDE.md):** How to add new languages in 3 simple steps.
* **[Realtime Architecture Evaluation](docs/REALTIME_ARCHITECTURE.md):** Technical evaluation of Supabase Realtime Broadcast vs Postgres Changes.
* **[Changelog](CHANGELOG.md):** Release history and compliance enhancements.
* **[Credits & Third-Party Licenses](CREDITS.md):** Attribution for open-source frameworks, typography, and icons.

---

## 📄 Commercial License

Commercial Turnkey Product License. All rights reserved.
