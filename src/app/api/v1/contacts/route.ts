import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api/api-keys';
import { WorkspaceApiKey, Contact } from '@/types/crm';

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
 * Public REST API v1 — Contacts Endpoint
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

export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json();
    const { phoneNumber, name, email, tags, customAttributes } = body;

    if (!phoneNumber || !name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error: phoneNumber and name are required.',
        },
        { status: 400 }
      );
    }

    const contact: Contact = {
      id: `cnt_${Date.now()}`,
      workspaceId: authKey.workspaceId,
      phoneNumber,
      name,
      email,
      tags: Array.isArray(tags) ? tags : [],
      customAttributes: customAttributes || {},
      lastInteractionAt: new Date().toISOString(),
      isDemo: false,
    };

    return NextResponse.json(
      {
        success: true,
        data: contact,
      },
      { status: 201 }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
