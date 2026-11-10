// Multi-Tenant Routing & WABA Credential Resolver
// Resolves workspace credentials by phone_number_id or pathToken
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import type { TenantRoutingConfig } from '../../types/crm';
import { CLEAN_WABA_CONFIG, DEMO_WABA_CONFIG } from '../storage';

export class TenantResolver {
  /**
   * Returns list of configured tenant routing profiles
   * Pulls from environment variables, database configs, and default fallback
   */
  static getTenantConfigs(): TenantRoutingConfig[] {
    const tenants: TenantRoutingConfig[] = [];

    // 1. Primary workspace configured via environment variables
    const envPhoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const envAppSecret = process.env.META_APP_SECRET;
    const envVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (envAppSecret) {
      tenants.push({
        workspaceId: process.env.DEFAULT_WORKSPACE_ID || 'ws_prod_01',
        phoneNumberId: envPhoneNumberId || '',
        pathToken: process.env.DEFAULT_WORKSPACE_PATH_TOKEN || 'default',
        appSecret: envAppSecret,
        webhookVerifyToken: envVerifyToken || '',
      });
    }

    // 2. Demo workspace tenant profile (for development & testing)
    if (DEMO_WABA_CONFIG.phoneNumberId) {
      tenants.push({
        workspaceId: DEMO_WABA_CONFIG.workspaceId,
        phoneNumberId: DEMO_WABA_CONFIG.phoneNumberId,
        pathToken: 'demo',
        appSecret: process.env.META_APP_SECRET || '',
        webhookVerifyToken: DEMO_WABA_CONFIG.webhookVerifyToken,
      });
    }

    // 3. Fallback clean workspace profile
    if (!tenants.some((t) => t.workspaceId === CLEAN_WABA_CONFIG.workspaceId)) {
      tenants.push({
        workspaceId: CLEAN_WABA_CONFIG.workspaceId,
        phoneNumberId: CLEAN_WABA_CONFIG.phoneNumberId || '',
        pathToken: 'prod',
        appSecret: envAppSecret || '',
        webhookVerifyToken: CLEAN_WABA_CONFIG.webhookVerifyToken || '',
      });
    }

    return tenants;
  }

  /**
   * Resolves tenant for an incoming webhook request
   */
  static resolve(input: { phoneNumberId?: string; pathToken?: string }): TenantRoutingConfig | null {
    const configs = this.getTenantConfigs();

    // 1. Direct match by phone_number_id
    if (input.phoneNumberId) {
      const matchByPhone = configs.find((c) => c.phoneNumberId === input.phoneNumberId);
      if (matchByPhone) return matchByPhone;
    }

    // 2. Direct match by pathToken / query token
    if (input.pathToken) {
      const matchByToken = configs.find((c) => c.pathToken === input.pathToken);
      if (matchByToken) return matchByToken;
    }

    // 3. Single-tenant default fallback if only 1 tenant is registered
    if (configs.length === 1) {
      return configs[0];
    }

    return null;
  }
}
