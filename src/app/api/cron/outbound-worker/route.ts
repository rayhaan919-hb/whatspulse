// Outbound Job Queue Worker Endpoint
// Path: /api/cron/outbound-worker
// Triggered by Vercel Cron or PostgreSQL pg_cron
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
//
// ============================================================================
// CRON SETUP INSTRUCTIONS FOR BUYERS / DEPLOYERS:
// ----------------------------------------------------------------------------
// OPTION A (Vercel Cron):
// Add the following to vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/outbound-worker",
//       "schedule": "* * * * *"
//     }
//   ]
// }
// Set CRON_SECRET in your Vercel Project Environment Variables.
//
// OPTION B (Supabase / PostgreSQL pg_cron):
// In your Supabase SQL editor:
// SELECT cron.schedule(
//   'process-outbound-broadcasts',
//   '* * * * *',
//   $$
//     SELECT net.http_post(
//       url:='https://your-domain.com/api/cron/outbound-worker',
//       headers:=jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret', true))
//     );
//   $$
// );
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { OutboundQueue, QueueRecipientItem } from '@/lib/queue/outbound-queue';

export async function GET(request: NextRequest) {
  return handleWorker(request);
}

export async function POST(request: NextRequest) {
  return handleWorker(request);
}

async function handleWorker(request: NextRequest) {
  // 1. Verify Cron Authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
  }

  try {
    // 2. In serverless environment, query pending recipients with chunking
    // In database-connected mode:
    // SELECT * FROM public.campaign_recipients WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED
    // Here we provide the standard worker response contract:
    const mockRecipients: QueueRecipientItem[] = [];

    const result = OutboundQueue.processBatch(mockRecipients, {
      batchSize: 50,
      maxBatches: 1,
      rateLimitPerSecond: 80,
    });

    return NextResponse.json({
      success: true,
      workerStatus: 'idle',
      batch: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Worker failure';
    console.error('[Outbound Worker Error]:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
