// Outbound WhatsApp Message Dispatch Endpoint
// Path: /api/messages/send

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppClient } from '@/lib/whatsapp/client';
import { MessageType } from '@/types/crm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      to,
      content,
      messageType = 'text',
      templateName,
      templateLanguage,
      interactiveButtons,
      isInternalNote = false,
      senderId,
      senderName = 'Agent',
      conversationId,
    } = body;

    if (!to && !isInternalNote) {
      return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 });
    }

    if (!content && !templateName && !interactiveButtons) {
      return NextResponse.json({ error: 'Message content or template is required' }, { status: 400 });
    }

    // 1. If internal note, do not dispatch to WhatsApp
    if (isInternalNote) {
      const internalMsg = {
        id: `msg_note_${Date.now()}`,
        conversationId,
        senderType: 'agent',
        senderId,
        senderName,
        messageType: 'text',
        content,
        status: 'read',
        isInternalNote: true,
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, message: internalMsg });
    }

    // 2. Dispatch to Meta WhatsApp Cloud API
    const waClient = new WhatsAppClient();
    let metaResponse;

    if (interactiveButtons && interactiveButtons.length > 0) {
      metaResponse = await waClient.sendInteractiveButtons(to, content, interactiveButtons);
    } else if (templateName) {
      metaResponse = await waClient.sendTemplateMessage(to, templateName, templateLanguage || 'en_US');
    } else {
      metaResponse = await waClient.sendTextMessage(to, content);
    }

    const waMessageId = metaResponse.messages?.[0]?.id || `wamid.HBgL${Date.now()}`;

    const createdMessage = {
      id: `msg_${Date.now()}`,
      conversationId,
      waMessageId,
      senderType: 'agent',
      senderId,
      senderName,
      messageType: (messageType as MessageType) || 'text',
      content,
      status: 'sent',
      isInternalNote: false,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, message: createdMessage, metaResponse });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WhatsPulse Send API] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
