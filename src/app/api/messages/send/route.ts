// Outbound WhatsApp Message Dispatch Endpoint
// Path: /api/messages/send
// Phase 1B: Server-Side 24-Hour Care Window Enforcement & Meta Error Mapping
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppClient } from '@/lib/whatsapp/client';
import { CareWindowService } from '@/lib/whatsapp/care-window';
import { MetaErrorMapper } from '@/lib/whatsapp/errors';
import { TemplateValidator } from '@/lib/whatsapp/template-validator';
import { DEFAULT_TEMPLATES } from '@/lib/storage';
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
      lastInboundAt,
      fepExpiresAt,
    } = body;

    if (!to && !isInternalNote) {
      return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 });
    }

    if (!content && !templateName && !interactiveButtons) {
      return NextResponse.json({ error: 'Message content or template is required' }, { status: 400 });
    }

    // 1. If internal note, do not dispatch to WhatsApp or check customer care window
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

    // 2. Server-Side 24-Hour Customer Care Window Enforcement
    // Never trust client: validate whether freeform messages are permitted
    const isTemplate = Boolean(templateName);
    const windowCheck = CareWindowService.validateOutboundSend({
      isTemplate,
      lastInboundAt,
      fepExpiresAt,
    });

    if (!windowCheck.allowed) {
      return NextResponse.json(
        {
          error: windowCheck.reason,
          code: windowCheck.code,
          errorCode: windowCheck.errorCode,
          actionRequired: 'SWITCH_TO_TEMPLATE',
        },
        { status: 400 }
      );
    }

    // 3. Pre-Flight Template Parameter Validation (Before Meta API invocation)
    if (templateName) {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === templateName);
      if (template) {
        const validation = TemplateValidator.validate(template, {
          bodyParams: body.bodyParams,
          headerMediaUrl: body.headerMediaUrl,
          buttonParams: body.buttonParams,
        });

        if (!validation.valid) {
          return NextResponse.json(
            {
              error: validation.reason,
              code: 'TEMPLATE_VALIDATION_ERROR',
              errorCode: validation.errorCode,
              actionRequired: 'INSPECT_TEMPLATE_PARAMETERS',
            },
            { status: 400 }
          );
        }
      }
    }

    // 4. Dispatch to Meta WhatsApp Cloud API
    const waClient = new WhatsAppClient();
    let metaResponse;

    try {
      if (interactiveButtons && interactiveButtons.length > 0) {
        metaResponse = await waClient.sendInteractiveButtons(to, content, interactiveButtons);
      } else if (templateName) {
        metaResponse = await waClient.sendTemplateMessage(to, templateName, templateLanguage || 'en_US');
      } else {
        metaResponse = await waClient.sendTextMessage(to, content);
      }
    } catch (metaErr: unknown) {
      // Extract error code if present from Meta error message
      const errStr = metaErr instanceof Error ? metaErr.message : String(metaErr);
      const codeMatch = errStr.match(/"code":\s*(\d+)/) || errStr.match(/\((\d+)\)/);
      const errorCode = codeMatch ? parseInt(codeMatch[1], 10) : undefined;
      const mapped = MetaErrorMapper.mapError(errorCode, errStr);

      return NextResponse.json(
        {
          error: mapped.userMessage,
          code: mapped.category,
          errorCode: mapped.code,
          isRetryable: mapped.isRetryable,
          actionRequired: mapped.actionRequired,
        },
        { status: 400 }
      );
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
