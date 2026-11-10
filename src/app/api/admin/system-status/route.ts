// API Route: /api/admin/system-status
// Provides real-time health checks for administrator system status dashboard
// Never returns secret keys or tokens.

import { NextResponse } from 'next/server';
import { SystemStatusService } from '@/lib/admin/system-status';

export async function GET() {
  try {
    const report = await SystemStatusService.runDiagnostics();
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to run system diagnostics', details: (error as Error).message },
      { status: 500 }
    );
  }
}
