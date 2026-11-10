# Official Meta WhatsApp Cloud API Setup Guide

This guide walks you through connecting your **Official WhatsApp Business Account (WABA)** with **WhatsPulse CRM** via Meta's official Cloud API.

WhatsPulse is built 100% on the official Meta WhatsApp Cloud API (v20+). It does not use unofficial web scraping, browser automation, or QR code scanning libraries.

---

## 1. Prerequisites

Before starting, make sure you have:
1. A **Meta for Developers Account** at [developers.facebook.com](https://developers.facebook.com).
2. A **Meta Business Portfolio (Business Manager)** at [business.facebook.com](https://business.facebook.com).
3. A clean phone number capable of receiving SMS or voice verification codes that is **not** currently active on personal WhatsApp or WhatsApp Business mobile app.

---

## 2. Step 1: Create Your Meta Developer App

1. Navigate to [developers.facebook.com/apps](https://developers.facebook.com/apps) and click **Create App**.
2. When asked *"What do you want your app to do?"*, select **Other** > click **Next**.
3. Select **Business** as the App Type > click **Next**.
4. Configure your App details:
   - **App Name:** Enter a clear name (e.g. `WhatsPulse Production`).
   - **App Contact Email:** Your developer contact email.
   - **Business Account:** Select your official Meta Business Account.
5. Click **Create App** and complete the security check.
6. On the App Dashboard, locate **WhatsApp** in the product catalog and click **Set up**.

---

## 3. Step 2: Retrieve App Secret

1. In the left navigation, click **App Settings > Basic**.
2. Find the **App Secret** field.
3. Click **Show** (you may be asked to re-enter your Meta password).
4. Copy the App Secret and paste it into `.env.local` as `META_APP_SECRET`.
   > 🔒 *Security Note: WhatsPulse verifies every inbound webhook payload against this secret using HMAC-SHA256 with constant-time equality checks to prevent tampering and forged requests.*

---

## 4. Step 3: Configure Your WhatsApp Business Number

1. In the left navigation, go to **WhatsApp > API Setup**.
2. Locate your **Phone number ID** and **WhatsApp Business Account ID**:
   - Save the **Phone number ID** as `META_PHONE_NUMBER_ID` in `.env.local`.
   - Save the **WhatsApp Business Account ID** as `META_WABA_ID` in `.env.local`.
3. Under *Step 1: Select phone numbers*, you can test immediately with Meta's Sandbox Test Number, or click **Add phone number** to register and verify your real company number via SMS/voice OTP.

---

## 5. Step 4: Generate a Permanent System User Token

> ⚠️ **CRITICAL:** The temporary access token displayed in the API Setup tab expires after 24 hours. For reliable 24/7 CRM operations, you must generate a permanent System User Token.

1. Open [business.facebook.com/settings](https://business.facebook.com/settings).
2. In the left menu, navigate to **Users > System Users**.
3. Click **Add** to create a new system user:
   - **System User Name:** `WhatsPulse Service User`
   - **System User Role:** `Admin` (required for managing WhatsApp assets)
4. Click **Create System User**.
5. With the system user selected, click **Add Assets**:
   - Choose **WhatsApp Accounts** in the asset column.
   - Select your WhatsApp Business Account.
   - Toggle **Full Control** (Manage WhatsApp Business Account) to **ON**.
   - Click **Save Changes**.
6. Click **Generate New Token**:
   - Select your App from the dropdown.
   - Set **Token Expiration** to **Never** (or the maximum allowed by your organization).
   - Under available permissions, check both:
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_management`
7. Click **Generate Token**.
8. Copy the generated permanent token immediately (it begins with `EAAG...` or `EAA...`) and save it as `META_ACCESS_TOKEN` in `.env.local`.
   > ℹ️ WhatsPulse automatically encrypts this token at rest using AES-256-GCM in the isolated `workspace_secrets` database table.

---

## 6. Step 5: Configure and Verify Webhooks

1. Return to your App Dashboard on [developers.facebook.com](https://developers.facebook.com).
2. In the left menu, navigate to **WhatsApp > Configuration**.
3. In the **Webhook** section, click **Edit**:
   - **Callback URL:** `https://your-public-domain.com/api/webhooks/whatsapp`
   - **Verify Token:** The custom secret string you configured in `META_WEBHOOK_VERIFY_TOKEN` (e.g. `whatspulse_prod_sec_8392`).
4. Click **Verify and Save**.

> 💡 **IMPORTANT CONFIRMATION NOTE:**  
> While local tools (like `npm run setup`) simulate the handshake and signature verification, **clicking Meta's "Verify and Save" button in the Developer Dashboard is the real and final confirmation** that Meta's servers can reach your public HTTPS webhook endpoint.

5. Once verified, click **Manage** under **Webhook fields**.
6. Subscribe to the following webhook fields:
   - ✅ **`messages`**: Ingests incoming customer messages, location, contacts, and delivery status updates (`sent`, `delivered`, `read`, `failed`).
   - ✅ **`message_template_status_update`**: Real-time notifications when your broadcast templates are approved, rejected, or paused by Meta.

---

## 7. Step 6: Customer Care Window (24-Hour Rule)

Meta enforces a 24-hour Customer Care Window:
- **Inside the 24-Hour Window:** When a customer sends an inbound message, you have 24 hours of free-form conversation where you can send text, voice notes, media, and attachments without templates.
- **Outside the 24-Hour Window:** Once 24 hours elapse since the customer's last inbound message, free-form sending is automatically locked. Outbound messages can only be initiated using **Meta-Approved Message Templates**.
- WhatsPulse CRM automatically displays a countdown timer chip in the chat window and safely enforces this server-side to prevent delivery failures (Meta error code `131047`).
