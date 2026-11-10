# ⚡ WhatsPulse CRM — Official Meta WhatsApp Cloud API SaaS & Multi-Agent Inbox

> **The modern, high-converting WhatsApp CRM and Broadcast Suite built with Next.js 16 (Turbopack), React 19, TypeScript, Tailwind CSS, and Supabase.**
> Built strictly on the official Meta WhatsApp Cloud API (no unofficial QR-scan libraries), with opt-in and quality tooling to reduce restriction risk.

---

## 🚀 Key Features

* **🛡️ Official Meta WhatsApp Cloud API Architecture:**
  * Direct integration with official Meta Developer APIs (no unofficial QR-scan libraries, no Puppeteer browser instances, no WhatsApp Web disconnections).
  * Built-in opt-in compliance ledger and quality monitoring tools to minimize restriction risks.
  * 1,000 free monthly service conversations included by Meta.

* **💬 Live Multi-Agent Unified Team Inbox:**
  * Real-time conversation updates with filter tabs (`All`, `Mine`, `Unassigned`, `Resolved`).
  * Authentic WhatsApp Web chat timeline with delivery status receipts (`sent`, `delivered`, `read` with blue double ticks).
  * Internal Team Notes (private notes that are never sent over WhatsApp).
  * Pre-approved Meta Template selector and quick response triggers.

* **✨ AI Copilot for Human Support Agents:**
  * 1-Click suggested replies contextually drafted from conversation history.
  * AI conversation summarizer to produce instant executive briefs for agent handoffs.
  * Real-time customer sentiment detection (`Positive`, `Neutral`, `Frustrated`).

* **📢 WhatsApp Broadcast Campaigns & Template Manager:**
  * Segmented bulk messaging using pre-approved Meta templates.
  * Target audience tag filtering (e.g. `VIP Client`, `Wholesale`).
  * Live campaign analytics: Sent, Delivered %, Read %, and Failed rates.

* **👥 Comprehensive Customer CRM Directory:**
  * Contact profiles with phone number, email, custom CRM attributes, and tag chips.
  * One-click CSV export and instant chat launcher.

* **🧪 Built-in Interactive Webhook & API Simulator:**
  * Test and demonstrate full WhatsApp messaging, interactive button clicks, and blue tick receipts without needing an active Meta account right away.
  * View raw incoming Meta Webhook JSON payloads.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 15 (App Router, Server & Client Components)
* **Language:** TypeScript 5
* **Styling:** Tailwind CSS 4
* **Database & Realtime:** Supabase PostgreSQL with Row Level Security (RLS) & Realtime Publication
* **WhatsApp Engine:** Meta Graph API v20+ with HMAC SHA-256 Webhook Verification
* **AI Engine:** Google Gemini 1.5 Flash / OpenAI API with fallback heuristics

---

## 🏃 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Packaging for CodeCanyon & Freelance Gigs

WhatsPulse CRM is structured to be sold as:
1. **CodeCanyon Digital Product:** A complete, self-hostable multi-tenant WhatsApp CRM script.
2. **Upwork / Fiverr Service:** A turn-key deployment offering: *"I will set up and customize an Official WhatsApp CRM with AI Agents for your business."*

---

## 📄 License
Commercial Product License. All rights reserved.
