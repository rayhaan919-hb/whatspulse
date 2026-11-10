// Meta WhatsApp Cloud API Template Synchronization Endpoint
// Path: /api/templates/sync
// Phase 1C: Pulls approved message templates, categories & quality ratings from Graph API
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import { NextRequest, NextResponse } from 'next/server';
import { TenantResolver } from '@/lib/whatsapp/tenants';
import { TemplateValidator } from '@/lib/whatsapp/template-validator';
import type { MessageTemplate } from '@/types/crm';
import { DEFAULT_TEMPLATES } from '@/lib/storage';

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface MetaRawTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: MetaTemplateComponent[];
  quality_score?: {
    score: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspaceId = 'ws_prod_01', pathToken } = body;

    const tenant = TenantResolver.resolve({ pathToken });
    const wabaId = process.env.META_WABA_ID || '';
    const accessToken = process.env.META_ACCESS_TOKEN;

    // In demo or test mode when no live Graph API token is configured
    if (!accessToken || accessToken.startsWith('EAAG...whatspulse')) {
      return NextResponse.json({
        success: true,
        source: 'local_cache',
        count: DEFAULT_TEMPLATES.length,
        templates: DEFAULT_TEMPLATES,
        message: 'Synchronized templates from local template registry (Live Meta token not configured)',
      });
    }

    // Call Meta Graph API v20+ message_templates endpoint
    const graphUrl = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`;
    const response = await fetch(graphUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: `Meta Graph API error (${response.status})`,
          details: errData,
        },
        { status: response.status }
      );
    }

    const json = await response.json();
    const rawTemplates: MetaRawTemplate[] = json.data || [];

    // Transform Meta raw template definitions into WhatsPulse schema
    const syncedTemplates: MessageTemplate[] = rawTemplates.map((raw) => {
      let headerText: string | undefined;
      let headerType: MessageTemplate['headerType'] = 'NONE';
      let bodyText = '';
      let footerText: string | undefined;
      let buttons: MessageTemplate['buttons'];

      for (const comp of raw.components || []) {
        if (comp.type === 'HEADER') {
          headerType = (comp.format as MessageTemplate['headerType']) || 'TEXT';
          headerText = comp.text;
        } else if (comp.type === 'BODY') {
          bodyText = comp.text || '';
        } else if (comp.type === 'FOOTER') {
          footerText = comp.text;
        } else if (comp.type === 'BUTTONS') {
          buttons = (comp.buttons || []).map((b) => ({
            type: b.type,
            text: b.text,
            value: b.url || b.phone_number,
          }));
        }
      }

      const variableCount = TemplateValidator.countVariables(bodyText);

      return {
        id: `tmpl_${raw.id}`,
        workspaceId: tenant?.workspaceId || workspaceId,
        metaTemplateId: raw.id,
        name: raw.name,
        category: raw.category, // Categories affect billing (e.g. MARKETING vs UTILITY)
        language: raw.language,
        status: raw.status,
        header: headerText,
        headerType,
        body: bodyText,
        footer: footerText,
        buttons,
        qualityRating: raw.quality_score?.score || 'UNKNOWN',
        variableCount,
      };
    });

    return NextResponse.json({
      success: true,
      source: 'meta_graph_api',
      count: syncedTemplates.length,
      templates: syncedTemplates,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown template sync failure';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Support GET for manual browser or cron triggers
  return POST(request);
}
