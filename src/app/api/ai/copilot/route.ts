// AI Copilot Endpoint for Suggested Replies and Conversation Summarization
// Path: /api/ai/copilot

import { NextRequest, NextResponse } from 'next/server';
import { AICopilotService } from '@/lib/ai/copilot';
import { Message } from '@/types/crm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, messages, contactName = 'Customer' } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (action === 'suggest_replies') {
      const suggestions = await AICopilotService.suggestReplies(
        (messages || []) as Message[],
        contactName,
        apiKey
      );
      return NextResponse.json({ success: true, data: suggestions });
    }

    if (action === 'summarize') {
      const summary = AICopilotService.summarizeConversation(
        (messages || []) as Message[],
        contactName
      );
      return NextResponse.json({ success: true, data: summary });
    }

    return NextResponse.json({ error: 'Invalid action. Supported: suggest_replies, summarize' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
