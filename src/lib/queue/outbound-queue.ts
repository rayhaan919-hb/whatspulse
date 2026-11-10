// Outbound Broadcast Job Queue & Rate Limiter
// Phase 1B: Resumable chunked processing, rate limiting, and opt-out filtering
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
// // VERIFY: Meta default Cloud API rate limit is 80 messages per second per phone number.

export interface QueueRecipientItem {
  id: string;
  phoneNumber: string;
  optStatus?: 'opted_in' | 'opted_out' | 'unknown';
  status: 'pending' | 'processing' | 'sent' | 'skipped' | 'failed';
  errorCode?: number;
  errorMessage?: string;
  retryCount?: number;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  maxBatches?: number;
  rateLimitPerSecond?: number;
}

export interface BatchRunResult {
  startIndex: number;
  processedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  remainingCount: number;
  isComplete: boolean;
}

export interface RateLimiter {
  isAllowed(): boolean;
  consume(): boolean;
  getTokensRemaining(): number;
}

export class OutboundQueue {
  /**
   * Processes a slice of pending recipients with chunking, crash safety, and opt-out filtering
   */
  static processBatch(
    recipients: QueueRecipientItem[],
    options: BatchProcessingOptions = {}
  ): BatchRunResult {
    const batchSize = options.batchSize || 50;
    const maxBatches = options.maxBatches || 1;
    const totalToProcess = batchSize * maxBatches;

    // 1. Locate starting point (First pending recipient, enabling instant crash resumption)
    const pendingIndices: number[] = [];
    for (let i = 0; i < recipients.length; i++) {
      if (recipients[i].status === 'pending') {
        pendingIndices.push(i);
      }
    }

    const startIndex = pendingIndices.length > 0 ? pendingIndices[0] : recipients.length;
    const targetIndices = pendingIndices.slice(0, totalToProcess);

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const idx of targetIndices) {
      const recipient = recipients[idx];

      // 2. Opt-Out Filter: Skip opted-out contacts
      if (recipient.optStatus === 'opted_out') {
        recipient.status = 'skipped';
        recipient.errorMessage = 'Contact opted out of WhatsApp broadcasts';
        skippedCount++;
        continue;
      }

      // 3. Mark processed / sent
      recipient.status = 'sent';
      sentCount++;
    }

    const remainingCount = recipients.filter((r) => r.status === 'pending').length;

    return {
      startIndex,
      processedCount: targetIndices.length,
      sentCount,
      skippedCount,
      failedCount,
      remainingCount,
      isComplete: remainingCount === 0,
    };
  }

  /**
   * Creates a token-bucket per-number rate limiter
   */
  static createRateLimiter(options: { maxMessagesPerSecond?: number } = {}): RateLimiter {
    const limit = options.maxMessagesPerSecond || 80;
    let tokens = limit;
    let lastRefill = Date.now();

    const refill = () => {
      const now = Date.now();
      const elapsedMs = now - lastRefill;
      if (elapsedMs >= 1000) {
        tokens = limit;
        lastRefill = now;
      }
    };

    return {
      isAllowed(): boolean {
        refill();
        return tokens > 0;
      },
      consume(): boolean {
        refill();
        if (tokens > 0) {
          tokens--;
          return true;
        }
        return false;
      },
      getTokensRemaining(): number {
        refill();
        return tokens;
      },
    };
  }

  /**
   * Calculates exponential backoff delay in milliseconds
   */
  static getBackoffDelayMs(retryCount: number, baseDelayMs = 2000, maxDelayMs = 60000): number {
    const delay = baseDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, maxDelayMs);
  }
}
