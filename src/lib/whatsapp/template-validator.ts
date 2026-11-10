// WhatsApp Business Template Parameter & Media Pre-Validator
// Phase 1C: Pre-flight validation before hitting Meta Cloud API
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

export interface TemplateValidationInput {
  bodyParams?: string[];
  headerMediaUrl?: string;
  headerText?: string;
  buttonParams?: Array<{
    type: 'url' | 'quick_reply';
    index: number;
    value: string;
  }>;
}

export interface TemplateValidationResult {
  valid: boolean;
  errorCode?: number;
  reason: string;
}

export interface TemplateDefinition {
  id?: string;
  name: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | string;
  headerType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'NONE' | string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    value?: string;
  }>;
}

export class TemplateValidator {
  /**
   * Extracts distinct placeholder indices from template text (e.g. {{1}}, {{2}})
   */
  static extractPlaceholders(text: string): number[] {
    if (!text) return [];
    const matches = text.matchAll(/\{\{(\d+)\}\}/g);
    const indices = new Set<number>();
    for (const match of matches) {
      indices.add(parseInt(match[1], 10));
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Returns count of placeholders required in body text
   */
  static countVariables(text: string): number {
    return this.extractPlaceholders(text).length;
  }

  /**
   * Validates template parameters prior to dispatching Meta API request
   * Rejects parameter mismatches client-side / server-side to avoid Meta 132001 & 132012 errors
   */
  static validate(
    template: TemplateDefinition,
    params: TemplateValidationInput = {}
  ): TemplateValidationResult {
    const bodyParams = params.bodyParams || [];
    const expectedPlaceholders = this.extractPlaceholders(template.body);
    const expectedCount = expectedPlaceholders.length;

    // 1. Variable Count Validation
    if (bodyParams.length !== expectedCount) {
      return {
        valid: false,
        errorCode: 132001, // Meta error 132001: Parameter count mismatch
        reason: `Template parameter count mismatch: expected ${expectedCount}, received ${bodyParams.length}`,
      };
    }

    // 2. Empty / Whitespace Parameter Content Validation
    for (let i = 0; i < bodyParams.length; i++) {
      const val = bodyParams[i];
      if (typeof val !== 'string' || !val.trim()) {
        return {
          valid: false,
          errorCode: 132000,
          reason: `Template variable {{${i + 1}}} cannot be empty or whitespace`,
        };
      }
    }

    // 3. Header Media Validation
    const headerType = (template.headerType || '').toUpperCase();
    const mediaHeaders = ['IMAGE', 'VIDEO', 'DOCUMENT'];

    if (mediaHeaders.includes(headerType)) {
      const mediaUrl = params.headerMediaUrl;
      if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.trim()) {
        return {
          valid: false,
          errorCode: 132012, // Meta error 132012: Parameter format does not match
          reason: `Missing required header media URL for ${headerType} template header`,
        };
      }

      if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
        return {
          valid: false,
          errorCode: 132012,
          reason: `Header media URL must be a valid HTTP/HTTPS URL`,
        };
      }
    }

    // 4. Button Parameters Validation
    if (params.buttonParams && params.buttonParams.length > 0) {
      for (const btn of params.buttonParams) {
        if (!btn.value || typeof btn.value !== 'string' || !btn.value.trim()) {
          return {
            valid: false,
            errorCode: 132000,
            reason: `Button parameter at index ${btn.index} cannot be empty`,
          };
        }
      }
    }

    return {
      valid: true,
      reason: 'Template parameters valid',
    };
  }

  /**
   * Formats validated parameters into Meta Cloud API components payload
   */
  static formatMetaComponents(
    template: TemplateDefinition,
    params: TemplateValidationInput
  ): Array<Record<string, unknown>> {
    const components: Array<Record<string, unknown>> = [];

    // Header component
    const headerType = (template.headerType || '').toUpperCase();
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && params.headerMediaUrl) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: headerType.toLowerCase(),
            [headerType.toLowerCase()]: { link: params.headerMediaUrl },
          },
        ],
      });
    } else if (headerType === 'TEXT' && params.headerText) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'text',
            text: params.headerText,
          },
        ],
      });
    }

    // Body parameters
    if (params.bodyParams && params.bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: params.bodyParams.map((val) => ({
          type: 'text',
          text: val,
        })),
      });
    }

    // Button parameters
    if (params.buttonParams && params.buttonParams.length > 0) {
      for (const btn of params.buttonParams) {
        components.push({
          type: 'button',
          sub_type: btn.type,
          index: btn.index.toString(),
          parameters: [
            {
              type: 'text',
              text: btn.value,
            },
          ],
        });
      }
    }

    return components;
  }
}
