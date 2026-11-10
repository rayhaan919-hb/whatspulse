/**
 * SnoozeService handles hiding inactive conversations until a specified future time
 * and automatically unsnoozing/reopening them when a new inbound message arrives.
 */
export class SnoozeService {
  /**
   * Returns true if the conversation is currently actively snoozed.
   */
  public static isSnoozed(conversation: { snoozedUntil?: string | null }): boolean {
    if (!conversation.snoozedUntil) {
      return false;
    }

    const snoozeTime = new Date(conversation.snoozedUntil).getTime();
    if (isNaN(snoozeTime)) {
      return false;
    }

    return snoozeTime > Date.now();
  }

  /**
   * Handles inbound messages on a conversation:
   * Clears snoozedUntil and reopens the conversation if it was snoozed or pending.
   */
  public static handleInboundMessage<T extends { snoozedUntil?: string | null; status?: string }>(
    conversation: T
  ): T & { snoozedUntil: null; status: 'open' } {
    return {
      ...conversation,
      snoozedUntil: null,
      status: 'open',
    };
  }

  /**
   * Helper to compute future ISO strings for common snooze presets
   */
  public static calculateSnoozePreset(preset: '1h' | '4h' | 'tomorrow_9am' | 'next_week'): string {
    const now = new Date();
    switch (preset) {
      case '1h':
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      case '4h':
        return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      case 'tomorrow_9am': {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow.toISOString();
      }
      case 'next_week': {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(9, 0, 0, 0);
        return nextWeek.toISOString();
      }
      default:
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
  }
}
