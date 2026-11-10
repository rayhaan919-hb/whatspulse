import type { BusinessHoursConfig } from '../../types/crm';

const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * BusinessHoursService handles timezone-aware business schedule checks
 * and duplicate after-hours auto-reply suppression to prevent billable loops.
 */
export class BusinessHoursService {
  /**
   * Determine if the given date falls within the configured business hours.
   */
  public static isWithinBusinessHours(date: Date, config: BusinessHoursConfig): boolean {
    if (!config || !config.enabled) {
      return true;
    }

    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: config.timezone || 'UTC',
        weekday: 'short',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(date);

      const map: Record<string, string> = {};
      for (const p of parts) {
        map[p.type] = p.value;
      }

      const dayOfWeek = DAY_MAP[map.weekday];
      if (dayOfWeek === undefined) {
        return false;
      }

      const scheduleForDay = config.schedule[dayOfWeek];
      if (!scheduleForDay) {
        return false;
      }

      const [openHour, openMin] = scheduleForDay.open.split(':').map((v) => parseInt(v, 10));
      const [closeHour, closeMin] = scheduleForDay.close.split(':').map((v) => parseInt(v, 10));

      const currentMinutes = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;

      return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } catch {
      // Fallback: if timezone is invalid or formatting fails, treat as within hours
      return true;
    }
  }

  /**
   * Check if an after-hours auto-reply should be dispatched.
   * Rates / Meta pricing safeguard: dispatches at most ONCE per conversation per closed period.
   * If an auto-reply was already sent in the current closed period without the business opening
   * in between, duplicate auto-replies are suppressed.
   */
  public static shouldSendAfterHoursAutoReply(
    conversation: { lastAfterHoursReplyAt?: string | null },
    date: Date,
    config: BusinessHoursConfig
  ): boolean {
    if (!config || !config.enabled) {
      return false;
    }

    // Never send auto-reply if currently within business hours
    if (this.isWithinBusinessHours(date, config)) {
      return false;
    }

    // If never sent before, permit the first auto-reply
    if (!conversation.lastAfterHoursReplyAt) {
      return true;
    }

    const lastReply = new Date(conversation.lastAfterHoursReplyAt);
    if (isNaN(lastReply.getTime()) || lastReply >= date) {
      return false;
    }

    const diffMs = date.getTime() - lastReply.getTime();
    // If more than 8 days have passed, a new weekly cycle definitely occurred
    if (diffMs > 8 * 24 * 60 * 60 * 1000) {
      return true;
    }

    // Step through time between lastReply and now to check if business was open in between
    const stepMs = 15 * 60 * 1000; // 15-minute intervals
    for (let t = lastReply.getTime() + stepMs; t < date.getTime(); t += stepMs) {
      if (this.isWithinBusinessHours(new Date(t), config)) {
        // Business opened between the last reply and now, meaning this is a new closed period
        return true;
      }
    }

    // No open business period occurred; still in the same closed period
    return false;
  }
}
