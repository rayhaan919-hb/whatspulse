// Meta WhatsApp Cloud API 24-Hour Customer Care Window Service
// Phase 1B: Server-Side Care Window Enforcement & Free Entry Point (FEP) Mechanics
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
// // VERIFY: FEP 72-hour window only applies to pricing/cost; freeform messages are strictly gated by the 24-hour clock.

export interface CareWindowValidationResult {
  allowed: boolean;
  code?: 'WINDOW_CLOSED' | 'WINDOW_OPEN';
  errorCode?: number;
  reason?: string;
  isFepActive?: boolean;
}

export class CareWindowService {
  /**
   * Meta official 24-hour customer service window duration in milliseconds
   */
  public static readonly WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;

  /**
   * Validates whether an outbound message can be sent to this recipient
   * Server-side authority: Never trusts client-reported window state
   */
  static validateOutboundSend(input: {
    isTemplate: boolean;
    lastInboundAt?: string | null;
    fepExpiresAt?: string | null;
  }): CareWindowValidationResult {
    const isFep = this.isFepFree({ fepExpiresAt: input.fepExpiresAt });

    // 1. WhatsApp Pre-Approved Templates are ALWAYS permitted regardless of window state
    if (input.isTemplate) {
      return {
        allowed: true,
        code: 'WINDOW_OPEN',
        isFepActive: isFep,
      };
    }

    // 2. If no inbound message was ever received, freeform messages are prohibited
    if (!input.lastInboundAt) {
      return {
        allowed: false,
        code: 'WINDOW_CLOSED',
        errorCode: 131047,
        reason:
          'Customer care window has not opened. Send a pre-approved WhatsApp template to initiate conversation.',
        isFepActive: isFep,
      };
    }

    const lastInboundMs = new Date(input.lastInboundAt).getTime();
    const nowMs = Date.now();
    const elapsedMs = nowMs - lastInboundMs;

    // 3. Freeform message check: Must be within 24 hours of last customer inbound
    // Note: FEP referral never extends freeform messaging clock beyond 24 hours!
    if (elapsedMs > this.WINDOW_DURATION_MS) {
      return {
        allowed: false,
        code: 'WINDOW_CLOSED',
        errorCode: 131047,
        reason:
          'Customer care window closed. More than 24 hours have passed since the customer last replied. Switch to a pre-approved template.',
        isFepActive: isFep,
      };
    }

    return {
      allowed: true,
      code: 'WINDOW_OPEN',
      isFepActive: isFep,
    };
  }

  /**
   * Checks whether Free Entry Point (FEP) is currently active for zero-cost billing attribution
   */
  static isFepFree(input: { fepExpiresAt?: string | null }): boolean {
    if (!input.fepExpiresAt) {
      return false;
    }
    const expiryMs = new Date(input.fepExpiresAt).getTime();
    return Date.now() < expiryMs;
  }

  /**
   * Calculates milliseconds remaining in the customer care window
   */
  static getTimeRemainingMs(lastInboundAt?: string | null): number {
    if (!lastInboundAt) return 0;
    const lastInboundMs = new Date(lastInboundAt).getTime();
    const expiresAt = lastInboundMs + this.WINDOW_DURATION_MS;
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Returns human-readable countdown string for the UI chip
   */
  static formatCountdown(remainingMs: number): string {
    if (remainingMs <= 0) {
      return 'Window Closed';
    }
    const totalMinutes = Math.floor(remainingMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m left`;
  }
}
