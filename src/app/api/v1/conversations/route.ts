import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api/api-keys';
import { WorkspaceApiKey } from '@/types/crm';

const IN_MEMORY_API_KEYS: WorkspaceApiKey[] = [
  {
    id: 'key_prod_master',
    workspaceId: 'ws_prod_01',
    name: 'Production Server Key',
    keyPrefix: 'wp_live_master...',
    keyHash: ApiKeyService.hashKey('wp_live_default_dev_key_1234567890abcdef'),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  },
];

/**
 * Public REST API v1 — Conversations Endpoint
 * Protected via Bearer <workspace_api_key>
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const authKey = ApiKeyService.authenticateRequest(authHeader, IN_MEMORY_API_KEYS);

  if (!authKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Missing or invalid API key.',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: [],
  });
}
