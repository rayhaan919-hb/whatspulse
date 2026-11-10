// Next.js App Router API Route for Meta WhatsApp Cloud API Webhooks
// Path: /api/webhooks/whatsapp
// Phase 1A: Hardened Verification, Multi-Tenant Routing, Immediate 200 Ack, and Async Ingestion
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import { NextRequest, NextResponse, after } from 'next/server';
import { WebhookProcessor } from '@/lib/whatsapp/webhook';
import { TenantResolver } from '@/lib/whatsapp/tenants';
import { WebhookEventQueue } from '@/lib/whatsapp/event-queue';
import type { MetaWebhookPayload } from '@/types/crm';

const DEFAULT_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'whatspulse_secret_token_123';

/**
 * GET Handler — Meta Webhook Verification Handshake
 * Triggered by Meta Developer Dashboard when configuring the webhook URL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const pathToken = searchParams.get('token') || undefined;

  // Resolve tenant verify token if pathToken is provided
  let expectedToken = DEFAULT_VERIFY_TOKEN;
  if (pathToken) {
    const tenant = TenantResolver.resolve({ pathToken });
    if (tenant?.webhookVerifyToken) {
      expectedToken = tenant.webhookVerifyToken;
    }
  }

  const verification = WebhookProcessor.verifySubscription(
    mode,
    token,
    challenge,
    expectedToken
  );

  if (verification.isValid && verification.challenge) {
    return new NextResponse(verification.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Verification token mismatch or invalid mode' }, { status: 403 });
}

/**
 * POST Handler — Incoming WhatsApp Messages & Delivery Status Receipts
 * Must respond with HTTP 200 immediately to prevent Meta timeout and retries
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Read RAW request body first
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const pathToken = request.nextUrl.searchParams.get('token') || undefined;

    // 2. Parse payload safely to extract metadata for tenant routing
    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { phoneNumberId } = WebhookProcessor.parsePayload(payload);

    // 3. Resolve tenant workspace and app secret
    const tenant = TenantResolver.resolve({ phoneNumberId, pathToken });
    const appSecret = tenant?.appSecret || process.env.META_APP_SECRET;

    if (!appSecret) {
      // Unknown tenant without configured secret — reject without leaking internal details
      return NextResponse.json({ error: 'Unauthorized webhook destination' }, { status: 401 });
    }

    // 4. Verify HMAC SHA-256 signature against RAW body
    const isAuthentic = WebhookProcessor.verifySignature(rawBody, signature, appSecret);
    if (!isAuthentic) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // 5. Persist raw event immediately to guarantee zero event loss
    const eventRecord = WebhookEventQueue.persistEvent(
      tenant?.workspaceId,
      phoneNumberId,
      payload
    );

    // 6. Process asynchronously using Next.js after() to guarantee response within sub-50ms
    after(async () => {
      try {
        await WebhookEventQueue.processEventAsync(eventRecord);
      } catch (asyncErr) {
        console.error('[WhatsPulse Webhook Queue] Background processing error:', asyncErr);
      }
    });

    // 7. Acknowledge receipt to Meta immediately with HTTP 200
    return NextResponse.json({
      success: true,
      eventId: eventRecord.id,
      status: 'queued',
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal error';
    console.error('[WhatsPulse Webhook] Ingestion error:', errorMsg);
    // Return HTTP 200 to acknowledge receipt to Meta even on internal errors
    return NextResponse.json({ success: false, error: 'Internal processing acknowledged' }, { status: 200 });
  }
}
