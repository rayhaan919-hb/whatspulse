import crypto from 'crypto';
import type { OutboundWebhookDelivery } from '../../types/crm';

/**
 * OutboundWebhookService signs and verifies outbound CRM webhook dispatches:
 * - Uses HMAC-SHA256 with a timestamp prefix (`${timestamp}.${payload}`)
 * - Enforces replay window tolerance (prevents replay attacks)
 * - Logs and structures delivery attempts with exponential retry records
 */
export class OutboundWebhookService {
  /**
   * Signs an outbound payload with HMAC-SHA256 and attaches an epoch timestamp.
   */
  public static signPayload(
    payload: string | object,
    secret: string,
    timestamp?: number
  ): { signature: string; timestamp: number } {
    const ts = timestamp !== undefined ? timestamp : Math.floor(Date.now() / 1000);
    const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedData = `${ts}.${bodyString}`;

    const signature = crypto.createHmac('sha256', secret).update(signedData).digest('hex');

    return {
      signature,
      timestamp: ts,
    };
  }

  /**
   * Verifies an outbound webhook signature and validates replay protection tolerance.
   * Default tolerance: 300 seconds (5 minutes).
   */
  public static verifyOutboundSignature(
    payload: string | object,
    signature: string,
    timestamp: number,
    secret: string,
    toleranceSeconds = 300
  ): boolean {
    if (!signature || !secret || !timestamp) {
      return false;
    }

    // 1. Replay attack protection: ensure timestamp is within tolerance window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    // 2. Compute expected HMAC
    const expected = this.signPayload(payload, secret, timestamp).signature;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  /**
   * Generates a delivery log entry for an outbound webhook event.
   */
  public static createDeliveryRecord(input: {
    workspaceId: string;
    subscriptionId?: string;
    event: string;
    payload: unknown;
    responseStatus?: number;
    status: 'delivered' | 'failed' | 'retrying';
    attempts: number;
    lastError?: string;
  }): OutboundWebhookDelivery {
    return {
      id: `whd_${crypto.randomUUID()}`,
      workspaceId: input.workspaceId,
      subscriptionId: input.subscriptionId,
      event: input.event,
      payload: input.payload,
      responseStatus: input.responseStatus,
      status: input.status,
      attempts: input.attempts,
      lastError: input.lastError,
      createdAt: new Date().toISOString(),
    };
  }
}
