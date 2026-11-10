// Meta WhatsApp Cloud API Error Code Dictionary & Retry Policies
// Phase 1B: Centralized Mapping & Action Recommendations
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
// // VERIFY: All error codes and retry rules registered against docs/META_VERIFY.md (MV-05)

export interface MappedMetaError {
  code: number;
  category: 'CARE_WINDOW' | 'RATE_LIMIT' | 'THROTTLE' | 'UNDELIVERABLE' | 'TEMPLATE' | 'AUTH' | 'GENERAL';
  title: string;
  userMessage: string;
  isRetryable: boolean;
  retryDelayMs: number;
  actionRequired?: 'SWITCH_TO_TEMPLATE' | 'REFRESH_TOKEN' | 'RESYNC_TEMPLATES' | 'VERIFY_MEDIA' | 'CHECK_NUMBER';
}

export class MetaErrorMapper {
  // // VERIFY: Table of documented Meta Cloud API Graph API error codes
  private static readonly ERROR_MAP: Record<number, Omit<MappedMetaError, 'code'>> = {
    // 131047: 24-Hour Customer Care Window Closed
    131047: {
      category: 'CARE_WINDOW',
      title: '24-Hour Care Window Expired',
      userMessage:
        'Message cannot be delivered because more than 24 hours have passed since the customer last replied. You must use a pre-approved template message.',
      isRetryable: false,
      retryDelayMs: 0,
      actionRequired: 'SWITCH_TO_TEMPLATE',
    },

    // 131049: Marketing / Engagement Throttling
    131049: {
      category: 'THROTTLE',
      title: 'Recipient Throttled',
      userMessage:
        'Meta has temporarily throttled marketing messages to this recipient to prevent spam. Do not retry immediately.',
      isRetryable: false,
      retryDelayMs: 0,
    },

    // 130429: Cloud API Rate Limit Exceeded
    130429: {
      category: 'RATE_LIMIT',
      title: 'Rate Limit Exceeded',
      userMessage: 'Cloud API Rate limit exceeded. Retrying automatically with exponential backoff.',
      isRetryable: true,
      retryDelayMs: 2000,
    },

    // 131056: Pair-Rate Limit (Too many messages to single recipient)
    131056: {
      category: 'RATE_LIMIT',
      title: 'Pair-Rate Limit Exceeded',
      userMessage: 'Too many messages dispatched to this customer in a short window. Queued for delayed retry.',
      isRetryable: true,
      retryDelayMs: 60000,
    },

    // 131026: Undeliverable / Number not on WhatsApp
    131026: {
      category: 'UNDELIVERABLE',
      title: 'Message Undeliverable',
      userMessage: 'This phone number cannot receive WhatsApp messages or is not registered on WhatsApp.',
      isRetryable: false,
      retryDelayMs: 0,
      actionRequired: 'CHECK_NUMBER',
    },

    // 132000: Template Not Found
    132000: {
      category: 'TEMPLATE',
      title: 'Template Not Found',
      userMessage: 'The selected template does not exist or has been deleted in your Meta WhatsApp Manager.',
      isRetryable: false,
      retryDelayMs: 0,
      actionRequired: 'RESYNC_TEMPLATES',
    },

    // 132001: Template Parameter Count Mismatch
    132001: {
      category: 'TEMPLATE',
      title: 'Template Parameters Mismatch',
      userMessage: 'The number of variable values provided does not match the placeholder count in the template.',
      isRetryable: false,
      retryDelayMs: 0,
    },

    // 132012: Header Media Format Mismatch
    132012: {
      category: 'TEMPLATE',
      title: 'Media Format Rejected',
      userMessage: 'The header media attachment does not match the required format or aspect ratio.',
      isRetryable: false,
      retryDelayMs: 0,
      actionRequired: 'VERIFY_MEDIA',
    },

    // 190: System User Token Revoked or Expired
    190: {
      category: 'AUTH',
      title: 'WhatsApp Token Expired',
      userMessage: 'Your Meta permanent access token has expired or been revoked. Update your credentials in settings.',
      isRetryable: false,
      retryDelayMs: 0,
      actionRequired: 'REFRESH_TOKEN',
    },
  };

  /**
   * Maps an error code from Meta to human-readable message and retry policy
   */
  static mapError(errorCode: number | string | undefined, defaultMessage?: string): MappedMetaError {
    const numCode = typeof errorCode === 'string' ? parseInt(errorCode, 10) : Number(errorCode);

    if (numCode && this.ERROR_MAP[numCode]) {
      return {
        code: numCode,
        ...this.ERROR_MAP[numCode],
      };
    }

    return {
      code: numCode || 0,
      category: 'GENERAL',
      title: 'Dispatch Error',
      userMessage: defaultMessage || 'An unexpected error occurred while communicating with Meta Cloud API.',
      isRetryable: false,
      retryDelayMs: 0,
    };
  }
}
