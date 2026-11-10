# WhatsPulse CRM — Turnkey Installation & Deployment Guide

This guide covers everything required to deploy **WhatsPulse CRM** for local development, self-hosted agency production, or 1-click cloud hosting on Vercel.

---

## 1. System Requirements & Prerequisites

Before installing WhatsPulse CRM, ensure your environment meets these minimum specifications:

| Requirement | Minimum Specification | Recommended |
|---|---|---|
| **Node.js** | `>= 20.0.0` (LTS) | `v22.x` or latest LTS |
| **Package Manager** | `npm 10+`, `pnpm 9+`, or `yarn 4+` | `npm` |
| **Database** | PostgreSQL 15+ or Supabase project | Hosted Supabase project (Free or Pro) |
| **Meta Cloud API** | Meta Developer Account | Meta Business Portfolio with verified phone |
| **Operating System** | Linux, macOS, or Windows 10/11 | Linux / macOS / WSL2 |

---

## 2. Quick Start: Local Development

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/your-org/whatspulse-crm.git
cd whatspulse-crm
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to create your local environment file:
```bash
cp .env.example .env.local
```
Open `.env.local` in your editor and configure your credentials (see [Section 4](#4-environment-variable-reference) below).

### Step 3: Run the Turnkey Setup Wizard
WhatsPulse includes an automated setup wizard that validates environment variables, tests Supabase connectivity, discovers migration files, and verifies webhook signatures:
```bash
npm run setup
```

### Step 4: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the warm editorial CRM inbox.

---

## 3. Database Setup & Supabase Migrations

WhatsPulse uses Supabase (PostgreSQL with Row Level Security and Realtime broadcasts).

### Option A: Using the Supabase CLI (Recommended)
1. Link your Supabase project:
   ```bash
   npx supabase link --project-ref your-supabase-project-ref
   ```
2. Apply all schema migrations in chronological order:
   ```bash
   npx supabase db push
   ```

### Option B: Direct PostgreSQL via `SUPABASE_DB_URL`
Provide your direct PostgreSQL connection string in `.env.local`:
```bash
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
```
Apply migrations sequentially using `psql`:
```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261111_01_webhook_events_and_idempotency.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261111_02_outbound_queue_and_window.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261111_03_secrets_templates_media_indexes.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261112_01_pricing_and_compliance.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261113_01_inbox_productivity.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20261113_02_api_and_demo_isolation.sql
```

### Option C: Supabase Web Dashboard SQL Editor
1. Open your Supabase Dashboard > **SQL Editor**.
2. Run `supabase/schema.sql`.
3. Sequentially paste and run each SQL file in `supabase/migrations/`.

---

## 4. Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **Yes** | Canonical public HTTPS base URL (e.g. `https://crm.yourdomain.com`). |
| `META_PHONE_NUMBER_ID` | **Yes** | Official phone number ID from Meta App Dashboard > WhatsApp > API Setup. |
| `META_WABA_ID` | **Yes** | WhatsApp Business Account ID from Meta App Dashboard. |
| `META_ACCESS_TOKEN` | **Yes** | Permanent System User token with `whatsapp_business_messaging` permissions. |
| `META_APP_SECRET` | **Yes** | App Secret from Meta Developer Dashboard > App Settings > Basic. |
| `META_WEBHOOK_VERIFY_TOKEN` | **Yes** | Custom secret token string matching your webhook configuration in Meta. |
| `ENCRYPTION_KEY` | **Yes** | 32-byte key (64 hex characters) for AES-256-GCM token encryption at rest. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project API URL (`https://xyz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase project anonymous public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key (bypasses RLS for secure background tasks). |
| `SUPABASE_DB_URL` | Optional | Direct Postgres connection URI for CLI migration execution. |
| `CRON_SECRET` | Recommended | Bearer token for authenticating `/api/cron/outbound-worker`. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for smart AI copilot reply suggestions. |

Generate a cryptographically secure 32-byte encryption key with:
```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

---

## 5. Meta WhatsApp Cloud API Setup

For a detailed step-by-step walkthrough, refer to [docs/META_SETUP.md](./META_SETUP.md).

### Summary:
1. **Developer App:** Create a Business App on [developers.facebook.com](https://developers.facebook.com).
2. **Add WhatsApp:** Add the WhatsApp product to your app.
3. **System User Token:** In Meta Business Settings > System Users, create an Admin System User, grant Full Control over your WhatsApp Account, and generate a permanent token with:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. **Webhook Subscription:**
   - **Callback URL:** `https://your-domain.com/api/webhooks/whatsapp`
   - **Verify Token:** Your `META_WEBHOOK_VERIFY_TOKEN`
   - **Subscribed Fields:** `messages`, `message_template_status_update`
   - *Note: Clicking **Verify and Save** in the Meta Developer Portal is the real confirmation that your public webhook is reachable.*

---

## 6. Production Deployment Options

### Deploying to Vercel (1-Click)
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Click the Deploy button or import the repository in [Vercel](https://vercel.com).
3. Configure the required environment variables in the Vercel project settings.
4. Deploy! Vercel automatically configures the serverless API routes and Turbopack production build.
5. In `vercel.json`, ensure the cron job is scheduled:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/outbound-worker",
         "schedule": "* * * * *"
       }
     ]
   }
   ```

### Deploying with Docker / VPS Self-Hosting
1. Build the production Docker container:
   ```bash
   docker build -t whatspulse-crm .
   ```
2. Run with environment variables:
   ```bash
   docker run -d -p 3000:3000 --env-file .env.local --name whatspulse whatspulse-crm
   ```
3. Set up a reverse proxy (Nginx or Caddy) with SSL certificate (Let's Encrypt) pointing to port 3000.

---

## 7. Production Verification Checklist

- [ ] All migrations applied in Supabase.
- [ ] `ENCRYPTION_KEY` configured with 64 hex characters (32 bytes).
- [ ] System status dashboard checked at `/admin/system-status` (all green).
- [ ] Webhook URL registered in Meta and confirmed via **Verify and Save**.
- [ ] Webhook fields `messages` and `message_template_status_update` subscribed.
- [ ] Outbound cron worker tested at `/api/cron/outbound-worker`.
- [ ] Sample demo data purged via **Clear Sample Data** before adding production contacts.
