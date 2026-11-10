# WhatsPulse CRM — Troubleshooting & Diagnostics Guide

This document provides resolutions for common issues encountered during setup, webhook integration, message delivery, and database operations.

---

## 1. Webhook Configuration Issues

### Symptom: Meta says "The URL couldn't be validated" on Verify and Save
**Cause:** Meta's servers sent a `GET` request with challenge parameters, but did not receive a 200 OK containing the exact challenge string.
**Resolution:**
1. Ensure your application is accessible over public **HTTPS** (self-signed certificates are rejected by Meta).
2. Check that `META_WEBHOOK_VERIFY_TOKEN` in `.env.local` exactly matches what you typed in Meta's "Verify Token" field.
3. Test locally using curl or PowerShell:
   ```bash
   curl "https://your-domain.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test1234&hub.verify_token=YOUR_TOKEN"
   ```
   The response must be plain text `test1234` with HTTP status `200`.

---

### Symptom: Webhook POST requests return 401 or 403 Forbidden
**Cause:** The `x-hub-signature-256` header on inbound POST requests does not match the signature computed with `META_APP_SECRET`.
**Resolution:**
1. Check that `META_APP_SECRET` in `.env.local` matches the App Secret from Meta Developer Dashboard > **App Settings > Basic**.
2. If using a reverse proxy (e.g. Nginx, Cloudflare), verify that the proxy does not buffer or alter the raw HTTP request body before it reaches Next.js. WhatsPulse computes HMAC over the unmodified raw bytes.

---

## 2. Message Dispatch & Meta API Errors

### Error 131047: "Message failed to send because more than 24 hours have passed"
**Cause:** You attempted to send a free-form message outside Meta's 24-hour Customer Care Window.
**Resolution:**
- Outside 24 hours from the contact's last message, you **must use an approved template**.
- In the WhatsPulse chat composer, click the **Template** icon to choose a pre-approved template.
- Once the customer replies to your template message, the 24-hour free-form messaging window will reopen automatically.

---

### Error 190: "Invalid OAuth access token - Cannot parse access token"
**Cause:** The access token is either invalid, revoked, or expired.
**Resolution:**
- If you used the temporary test token from Meta's API Setup page, it has expired (they only last 24 hours).
- Generate a permanent System User Token following the steps in [docs/META_SETUP.md](./META_SETUP.md#5-step-4-generate-a-permanent-system-user-token).
- Update `META_ACCESS_TOKEN` in `.env.local` and restart the application.

---

### Error 130429: "Rate limit hit" / Error 131056: "Too many messages to this recipient"
**Cause:** Dispatches exceeded Meta's throughput limit (default 80 MPS) or sent too many messages to the same phone number within a short window.
**Resolution:**
- WhatsPulse includes an automated token-bucket rate limiter that throttles sends.
- For high-volume broadcast campaigns, adjust the batch chunk delay in campaign settings.
- WhatsPulse's background queue automatically retries rate-limited messages with exponential backoff and jitter.

---

## 3. Database & Supabase Issues

### Symptom: "new row violates row-level security policy"
**Cause:** Supabase Row Level Security (RLS) is enabled, but the query was executed with an unauthorized client or unauthenticated session.
**Resolution:**
- System operations (webhook ingestion, cron workers, secret encryption) require `SUPABASE_SERVICE_ROLE_KEY`. Verify this key is set in `.env.local`.
- Check that user requests carry a valid authenticated Supabase session JWT.
- Review migrations in `supabase/migrations/` to verify all policies are applied.

---

### Symptom: "relation does not exist" or table missing
**Cause:** Schema migrations have not been applied to your Supabase PostgreSQL database.
**Resolution:**
- Run the setup wizard:
  ```bash
  npm run setup
  ```
- Or apply migrations using the Supabase CLI:
  ```bash
  npx supabase db push
  ```
- Verify all tables (`workspaces`, `contacts`, `conversations`, `messages`, `workspace_secrets`, `webhook_events`) exist in Supabase Table Editor.

---

## 4. Cryptographic Secrets & Token Storage

### Symptom: "Unsupported state or unable to authenticate data" on token decryption
**Cause:** The `ENCRYPTION_KEY` used to decrypt the token does not match the key that was used when the token was encrypted, or the ciphertext has been corrupted.
**Resolution:**
- Ensure `ENCRYPTION_KEY` has not been changed without running the key rotation script (`scripts/migrate-secrets.mjs`).
- If you rotated keys, ensure the key version prefix matches the keyring in `src/lib/whatsapp/crypto.ts`.
- Ensure `ENCRYPTION_KEY` is exactly 32 bytes (64 hex characters or 32 raw bytes).

---

## 5. Background Jobs & Cron Workers

### Symptom: Cron endpoint returns 401 Unauthorized
**Cause:** The request to `/api/cron/outbound-worker` lacks the matching `Authorization: Bearer <CRON_SECRET>` header.
**Resolution:**
- Set `CRON_SECRET` in `.env.local`.
- When triggering via curl or Vercel Cron:
  ```bash
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/outbound-worker
  ```

---

## 6. System Diagnostics Self-Check

When in doubt, log in as an administrator and visit the diagnostic cockpit at:
```
/admin/system-status
```
This dashboard checks all infrastructure connections (Supabase, Meta Graph API, App Secret, Webhooks, Encryption Key, Gemini AI) and outputs specific fix hints for any failing service.
