// Next.js App Router API Route for Meta WhatsApp Cloud API Webhooks
// Path: /api/webhooks/whatsapp

import { NextRequest, NextResponse } from 'next/server';
import { WebhookProcessor } from '@/lib/whatsapp/webhook';
import { MetaWebhookPayload } from '@/types/crm';

const DEFAULT_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'whatspulse_secret_token_123';
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * GET Handler — Meta Webhook Verification Handshake
 * Triggered by Meta Developer Dashboard when configuring the webhook URL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verification = WebhookProcessor.verifySubscription(
    mode,
    token,
    challenge,
    DEFAULT_VERIFY_TOKEN
  );

  if (verification.isValid && verification.challenge) {
    console.log('[WhatsPulse Webhook] Verified successfully with Meta!');
    return new NextResponse(verification.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[WhatsPulse Webhook] Verification failed. Token mismatch or invalid mode.');
  return NextResponse.json({ error: 'Verification token mismatch' }, { status: 403 });
}

/**
 * POST Handler — Incoming WhatsApp Messages & Delivery Status Receipts
 * Must respond with HTTP 200 within 5 seconds to prevent Meta retries / disabling
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // 1. Verify HMAC SHA-256 Signature (if APP_SECRET configured)
    const isAuthentic = WebhookProcessor.verifySignature(rawBody, signature, APP_SECRET);
    if (!isAuthentic) {
      console.error('[WhatsPulse Webhook] Invalid signature from Meta');
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const payload: MetaWebhookPayload = JSON.parse(rawBody);

    // 2. Parse Incoming Events
    const { incomingMessages, statusUpdates } = WebhookProcessor.parsePayload(payload);

    console.log(
      `[WhatsPulse Webhook] Received ${incomingMessages.length} messages and ${statusUpdates.length} status updates.`
    );

    // Note: In production with Supabase, these are inserted into public.messages and public.conversations.
    // Supabase Realtime broadcast triggers the frontend update automatically.

    return NextResponse.json({
      success: true,
      processed: {
        messages: incomingMessages.length,
        statuses: statusUpdates.length,
      },
    });
  } catch (error) {
    console.error('[WhatsPulse Webhook] Error processing webhook event:', error);
    // Always return 200 to acknowledge receipt to Meta even on internal parse errors
    return NextResponse.json({ success: false, error: 'Internal processing error' }, { status: 200 });
  }
}
