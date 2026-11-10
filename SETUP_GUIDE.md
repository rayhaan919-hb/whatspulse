# WhatsPulse CRM — Official Meta WhatsApp Cloud API Setup Guide

This guide walks you through connecting your **Official WhatsApp Business Account (WABA)** with **WhatsPulse CRM**. Following these steps guarantees **100% compliance with Meta's policies and zero phone number bans**.

---

## 1. Prerequisites
1. A **Meta for Developers Account** ([developers.facebook.com](https://developers.facebook.com)).
2. A **Meta Business Portfolio (Business Manager)**.
3. A phone number that can receive an SMS/voice OTP to verify on WhatsApp (this number must not be currently registered on personal WhatsApp).

---

## 2. Step 1: Create Meta Developer App
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and click **Create App**.
2. Select **Other** > click **Next**.
3. Select **Business** as the App Type > click **Next**.
4. Enter your App Name (e.g. `WhatsPulse Production`) and select your Business Account.
5. In the App Dashboard, scroll to **WhatsApp** and click **Set up**.

---

## 3. Step 2: Retrieve API Credentials
1. In the left navigation, go to **WhatsApp > API Setup**.
2. Note your **Phone number ID** and **WhatsApp Business Account ID**.
3. Under *Step 1: Select phone numbers*, you can use Meta's test number for immediate testing, or click **Add phone number** to register your official company number.

---

## 4. Step 3: Generate a Permanent System User Token
> ⚠️ **Important:** The temporary access token expires in 24 hours. For production use, generate a permanent token:
1. Go to [business.facebook.com/settings](https://business.facebook.com/settings).
2. Go to **Users > System Users** > click **Add**.
3. Name it `WhatsPulse Admin`, Role: **Admin System User**.
4. Click **Add Assets** > assign your WhatsApp Business Account with **Full Control**.
5. Click **Generate New Token**:
   * Select permissions:
     * `whatsapp_business_messaging`
     * `whatsapp_business_management`
6. Copy the generated permanent token and paste it into WhatsPulse Settings or `.env.local` as `META_ACCESS_TOKEN`.

---

## 5. Step 4: Configure Webhooks
1. In the Meta App Dashboard, navigate to **WhatsApp > Configuration**.
2. Click **Edit** under **Webhook**:
   * **Callback URL:** `https://your-domain.com/api/webhooks/whatsapp`
   * **Verify Token:** Enter your secret token (e.g. `whatspulse_secret_token_123` or your custom string from `.env.local`).
3. Click **Verify and Save**.
4. Under **Webhook fields**, click **Manage** and subscribe to:
   * ✅ `messages` (Incoming customer texts, buttons, media, list replies)
   * ✅ `message_template_status_update` (Template approval notices)

---

## 6. Step 5: Pre-Approved Message Templates
To initiate outbound conversations outside the 24-hour customer service window:
1. Go to **WhatsApp > Message Templates** in Meta Business Manager.
2. Create templates under `UTILITY`, `MARKETING`, or `AUTHENTICATION`.
3. Once approved by Meta (usually 1-15 minutes), these templates automatically appear in WhatsPulse CRM for 1-click messaging and broadcasts!

---

## 7. Understanding Meta Pricing & The Free Tier
* **1,000 Free Service Conversations every month:** Meta provides 1,000 customer-initiated service conversations per month completely free of charge.
* **Zero Ban Risk:** Unlike unofficial WhatsApp Web QR code scripts, the Official Cloud API has zero ban risk when sending within Meta's quality guidelines.
