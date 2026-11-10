// Meta WhatsApp Cloud API Cost Engine & Dynamic Rate Card Processor
// Phase 2: Per-message billing, configurable rate cards, and free-allowance tracking
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
// References: META_VERIFY.md MV-01, MV-02, MV-06

import type { RateCard, ScopeConfig, Message, AllowanceScope } from '../../types/crm';

export interface CostCalculationResult {
  cost: number;
  currency: string;
  billable: boolean;
  rateApplied: number;
  isFreeTier: boolean;
  allowanceRemaining?: number;
}

export interface CategorySummary {
  count: number;
  cost: number;
}

export interface AggregatedCostGroup {
  groupKey: string;
  totalCost: number;
  messageCount: number;
  byCategory: {
    marketing: CategorySummary;
    utility: CategorySummary;
    service: CategorySummary;
    authentication: CategorySummary;
  };
}

export interface UsageTracker {
  allowanceScope: AllowanceScope;
  recordMessage(input: { category: string; phoneNumberId?: string; wabaId?: string }): void;
  canConsumeFreeServiceMessage(key: string): boolean;
  getConsumedCount(key: string): number;
  getRemainingAllowance(key: string): number;
}

export class PricingService {
  /**
   * Default fallback rate card when workspace has not imported a custom card
   * Marked // VERIFY: Rates vary dynamically by country and Meta pricing changes
   */
  static readonly DEFAULT_RATE_CARD: RateCard = {
    currency: 'USD',
    rates: {
      marketing: 0.0500, // // VERIFY
      utility: 0.0150,   // // VERIFY
      service: 0.0100,   // // VERIFY
      authentication: 0.0300, // // VERIFY
    },
  };

  /**
   * Creates an in-memory usage tracker enforcing free service message allowances
   * Scope: 'waba' (shared pool) vs 'phone_number' (independent pool)
   * Reference: META_VERIFY.md MV-01
   */
  static createUsageTracker(scopeConfig: ScopeConfig): UsageTracker {
    const usageCounts = new Map<string, number>();
    const monthlyLimit = scopeConfig.freeServiceMessagesMonthly || 1000;
    const scope = scopeConfig.allowanceScope || 'waba';

    const resolveKey = (input: { phoneNumberId?: string; wabaId?: string }): string => {
      if (scope === 'phone_number') {
        return input.phoneNumberId || 'default_phone';
      }
      return input.wabaId || 'default_waba';
    };

    return {
      allowanceScope: scope,

      recordMessage(input: { category: string; phoneNumberId?: string; wabaId?: string }) {
        if ((input.category || '').toLowerCase() !== 'service') return;
        const key = resolveKey(input);
        const current = usageCounts.get(key) || 0;
        usageCounts.set(key, current + 1);
      },

      canConsumeFreeServiceMessage(key: string): boolean {
        const current = usageCounts.get(key) || 0;
        return current < monthlyLimit;
      },

      getConsumedCount(key: string): number {
        return usageCounts.get(key) || 0;
      },

      getRemainingAllowance(key: string): number {
        const current = usageCounts.get(key) || 0;
        return Math.max(0, monthlyLimit - current);
      },
    };
  }

  /**
   * Calculates individual message cost based on status webhook pricing object,
   * rate card, free allowance tracker, and Free Entry Point (FEP) referral state.
   */
  static calculateMessageCost(
    message: {
      pricing?: { billable?: boolean; category?: string };
      phoneNumberId?: string;
      wabaId?: string;
      isFepDiscountActive?: boolean;
    },
    rateCard: RateCard = this.DEFAULT_RATE_CARD,
    usageTracker?: UsageTracker,
    scopeConfig?: ScopeConfig
  ): CostCalculationResult {
    const pricing = message.pricing;
    const currency = rateCard.currency || 'USD';

    // 1. If not billable by Meta, cost is zero
    if (!pricing || pricing.billable === false) {
      return {
        cost: 0,
        currency,
        billable: false,
        rateApplied: 0,
        isFreeTier: false,
      };
    }

    // 2. Free Entry Point (FEP) discounts cost to zero
    // Reference: META_VERIFY.md MV-02
    if (message.isFepDiscountActive) {
      return {
        cost: 0,
        currency,
        billable: true,
        rateApplied: 0,
        isFreeTier: true,
      };
    }

    const category = (pricing.category || 'service').toLowerCase();
    const rate = (rateCard.rates as Record<string, number>)[category] ?? 0.01;

    // 3. Free service tier allowance evaluation (1,000 monthly)
    // Reference: META_VERIFY.md MV-01
    if (category === 'service' && usageTracker) {
      const scope = usageTracker.allowanceScope || scopeConfig?.allowanceScope || 'waba';
      const scopeKey = scope === 'phone_number' ? (message.phoneNumberId || 'default_phone') : (message.wabaId || 'default_waba');

      if (usageTracker.canConsumeFreeServiceMessage(scopeKey)) {
        return {
          cost: 0,
          currency,
          billable: true,
          rateApplied: 0,
          isFreeTier: true,
          allowanceRemaining: usageTracker.getRemainingAllowance(scopeKey),
        };
      }
    }

    // 4. Standard billable message
    return {
      cost: rate,
      currency,
      billable: true,
      rateApplied: rate,
      isFreeTier: false,
    };
  }

  /**
   * Aggregates historical message spend by workspace, campaign, or day
   */
  static aggregateCosts(
    messages: Array<Message & { campaignId?: string }>,
    options: {
      groupBy: 'workspace' | 'campaign' | 'day';
      rateCard?: RateCard;
      scopeConfig?: ScopeConfig;
    }
  ): Record<string, AggregatedCostGroup> {
    const rateCard = options.rateCard || this.DEFAULT_RATE_CARD;
    const groups: Record<string, AggregatedCostGroup> = {};

    for (const msg of messages) {
      let groupKey = 'general';

      if (options.groupBy === 'workspace') {
        groupKey = msg.workspaceId || 'default_ws';
      } else if (options.groupBy === 'campaign') {
        groupKey = msg.campaignId || 'unassigned';
      } else if (options.groupBy === 'day') {
        groupKey = (msg.createdAt || new Date().toISOString()).slice(0, 10);
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          totalCost: 0,
          messageCount: 0,
          byCategory: {
            marketing: { count: 0, cost: 0 },
            utility: { count: 0, cost: 0 },
            service: { count: 0, cost: 0 },
            authentication: { count: 0, cost: 0 },
          },
        };
      }

      const costResult = this.calculateMessageCost(msg, rateCard);
      const cat = ((msg.pricing?.category || 'service').toLowerCase()) as keyof AggregatedCostGroup['byCategory'];

      groups[groupKey].totalCost = Number((groups[groupKey].totalCost + costResult.cost).toFixed(4));
      groups[groupKey].messageCount += 1;

      if (groups[groupKey].byCategory[cat]) {
        groups[groupKey].byCategory[cat].count += 1;
        groups[groupKey].byCategory[cat].cost = Number(
          (groups[groupKey].byCategory[cat].cost + costResult.cost).toFixed(4)
        );
      }
    }

    return groups;
  }

  /**
   * Parses rate card CSV imported by administrator
   * Format: category,rate OR country,category,rate
   */
  static parseRateCardCsv(csvContent: string): Partial<RateCard> {
    const lines = csvContent.split('\n');
    const rates: Record<string, number> = {};

    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim().toLowerCase());
      if (parts.length >= 2) {
        const [category, rateStr] = parts;
        const num = parseFloat(rateStr);
        if (!isNaN(num)) {
          rates[category] = num;
        }
      }
    }

    return {
      rates: {
        marketing: rates.marketing ?? 0.05,
        utility: rates.utility ?? 0.015,
        service: rates.service ?? 0.01,
        authentication: rates.authentication ?? 0.03,
      },
    };
  }
}
