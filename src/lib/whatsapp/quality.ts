// WhatsApp Phone Number Quality Rating & Messaging Tier Monitor
// Phase 2: phone_number_quality_update webhook handling & degradation alerting
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt
// Reference: META_VERIFY.md MV-04

import type { InAppAlert, PhoneQualityLog } from '../../types/crm';

export interface QualityUpdatePayload {
  display_phone_number?: string;
  phone_number_id?: string;
  event?: string; // 'ON_FLAGGED' | 'ON_WARNING' | 'ON_LIMIT_CHANGED' | 'ON_UNFLAGGED'
  current_limit?: string; // 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED'
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | string;
}

export interface QualityProcessResult {
  degraded: boolean;
  limitDegraded: boolean;
  newRating: string;
  newLimit: string;
  alert?: InAppAlert;
  log?: PhoneQualityLog;
}

export class QualityMonitoringService {
  private static readonly RATING_SEVERITY: Record<string, number> = {
    GREEN: 0,
    UNKNOWN: 1,
    YELLOW: 2,
    RED: 3,
  };

  private static readonly TIER_ORDER: Record<string, number> = {
    TIER_1K: 1,
    TIER_10K: 2,
    TIER_100K: 3,
    TIER_UNLIMITED: 4,
  };

  /**
   * Evaluates phone_number_quality_update webhook payloads, updates audit logs,
   * and triggers in-app degradation alerts when quality or limits drop.
   */
  static processQualityUpdate(
    payload: QualityUpdatePayload,
    workspaceId: string,
    alertsStore: InAppAlert[],
    currentRating = 'GREEN',
    currentLimit = 'TIER_10K'
  ): QualityProcessResult {
    const newRating = (payload.quality_rating || currentRating).toUpperCase();
    const newLimit = (payload.current_limit || currentLimit).toUpperCase();
    const phoneDisplay = payload.display_phone_number || 'Registered Phone Number';

    const oldSev = this.RATING_SEVERITY[currentRating] ?? 0;
    const newSev = this.RATING_SEVERITY[newRating] ?? 0;
    const degraded = newSev > oldSev;

    const oldTier = this.TIER_ORDER[currentLimit] ?? 2;
    const newTier = this.TIER_ORDER[newLimit] ?? 2;
    const limitDegraded = newTier < oldTier;

    let alert: InAppAlert | undefined;

    // 1. Process Quality Rating Degradation
    if (degraded) {
      if (newRating === 'RED') {
        alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          workspaceId,
          level: 'danger',
          title: '🚨 Critical: Quality Rating Dropped to RED',
          message: `Phone number ${phoneDisplay} quality rating dropped to RED. Imminent risk of Meta account restriction or 24h block. Marketing campaigns should be halted immediately.`,
          acknowledged: false,
          timestamp: new Date().toISOString(),
        };
      } else if (newRating === 'YELLOW') {
        alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          workspaceId,
          level: 'warning',
          title: '⚠️ Phone Quality Rating Degraded to YELLOW',
          message: `Phone number ${phoneDisplay} quality rating dropped to YELLOW due to elevated user block/report rates. Review message templates and pause unverified audience broadcasts.`,
          acknowledged: false,
          timestamp: new Date().toISOString(),
        };
      }

      if (alert) {
        alertsStore.push(alert);
      }
    }

    // 2. Process Messaging Limit Tier Downgrade
    if (limitDegraded) {
      const tierAlert: InAppAlert = {
        id: `alert_tier_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId,
        level: 'warning',
        title: '📉 WhatsApp Messaging Limit Tier Reduced',
        message: `Meta has decreased your messaging tier for ${phoneDisplay} from ${currentLimit} to ${newLimit} (messages/24h) due to quality threshold violations.`,
        acknowledged: false,
        timestamp: new Date().toISOString(),
      };
      alertsStore.push(tierAlert);
    }

    const log: PhoneQualityLog = {
      id: `qlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId,
      phoneNumberId: payload.phone_number_id,
      displayPhoneNumber: payload.display_phone_number,
      qualityRating: newRating as PhoneQualityLog['qualityRating'],
      messagingLimit: newLimit,
      event: payload.event,
      createdAt: new Date().toISOString(),
    };

    return {
      degraded,
      limitDegraded,
      newRating,
      newLimit,
      alert,
      log,
    };
  }

  /**
   * Returns active unacknowledged alerts for workspace
   */
  static getActiveAlerts(workspaceId: string, alertsStore: InAppAlert[]): InAppAlert[] {
    return alertsStore.filter((a) => a.workspaceId === workspaceId && !a.acknowledged);
  }

  /**
   * Acknowledges an active alert
   */
  static acknowledgeAlert(alertId: string, alertsStore: InAppAlert[]): boolean {
    const alert = alertsStore.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
}
