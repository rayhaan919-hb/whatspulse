import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api/api-keys';
import { WorkspaceApiKey, Message } from '@/types/crm';

// Mock in-memory API key store for development & testing
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
 * Public REST API v1 — Messages Endpoint
 * Protected via Bearer <workspace_api_key>
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const authKey = ApiKeyService.authenticateRequest(authHeader, IN_MEMORY_API_KEYS);

  if (!authKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Missing or invalid API key. Use Authorization: Bearer wp_live_...',
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { to, content, templateName, mediaUrl } = body;

    if (!to || (!content && !templateName && !mediaUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed: "to" phone number and either "content", "templateName", or "mediaUrl" are required.',
        },
        { status: 400 }
      );
    }

    const message: Message = {
      id: `msg_api_${Date.now()}`,
      conversationId: `conv_${to.replace(/[^0-9]/g, '')}`,
      workspaceId: authKey.workspaceId,
      senderType: 'agent',
      messageType: mediaUrl ? 'image' : 'text',
      content: content || `[Template: ${templateName}]`,
      mediaUrl,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        data: message,
      },
      { status: 201 }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const authKey = ApiKeyService.authenticateRequest(authHeader, IN_MEMORY_API_KEYS);

  if (!authKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Missing or invalid API key. Use Authorization: Bearer wp_live_...',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: [],
  });
}
