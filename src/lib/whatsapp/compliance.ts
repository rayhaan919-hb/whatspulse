// WhatsApp Opt-In / Opt-Out Compliance & Audit Ledger Engine
// Phase 2: Automatic keyword handling, immutable audit trail, and campaign pre-send validation
// Official Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import type { Contact, OptInLedgerEntry, OptStatus } from '../../types/crm';

export interface KeywordProcessResult {
  optOutRecorded: boolean;
  optInRecorded: boolean;
  currentStatus: OptStatus;
  entry?: OptInLedgerEntry;
}

export interface CampaignComplianceAudit {
  total: number;
  optedInCount: number;
  unknownCount: number;
  optedOutCount: number;
  flaggedCount: number;
  flaggedRecipients: Contact[];
  warnings: string[];
  filterCompliantRecipients: (onlyOptedIn?: boolean) => Contact[];
}

export class ComplianceService {
  /**
   * Recognized multi-lingual opt-out keywords (strictly compliant with WhatsApp Business Policy)
   */
  static readonly STOP_KEYWORDS = [
    'STOP',
    'UNSUBSCRIBE',
    'CANCEL',
    'QUIT',
    'END',
    'ARRETEZ',
    'PARAR',
    'DETENER',
  ];

  /**
   * Recognized opt-in / unstop keywords
   */
  static readonly START_KEYWORDS = [
    'START',
    'UNSTOP',
    'OPTIN',
    'COMMENCER',
    'EMPEZAR',
  ];

  /**
   * Tests if message text constitutes an explicit opt-out command
   */
  static isOptOutKeyword(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toUpperCase();
    return this.STOP_KEYWORDS.includes(clean);
  }

  /**
   * Tests if message text constitutes an explicit opt-in / resume command
   */
  static isOptInKeyword(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toUpperCase();
    return this.START_KEYWORDS.includes(clean);
  }

  /**
   * Evaluates inbound message content for compliance keywords and records
   * immutable entries to the opt-in/opt-out ledger.
   */
  static processInboundKeyword(
    input: {
      text: string;
      workspaceId: string;
      contactId?: string;
      phoneNumber: string;
    },
    ledger: OptInLedgerEntry[]
  ): KeywordProcessResult {
    const text = input.text || '';

    // 1. Process Automatic Opt-Out
    if (this.isOptOutKeyword(text)) {
      const entry: OptInLedgerEntry = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        phoneNumber: input.phoneNumber,
        status: 'opted_out',
        source: 'keyword_stop',
        timestamp: new Date().toISOString(),
        evidenceNote: 'Customer replied STOP via WhatsApp',
      };

      ledger.push(entry);

      return {
        optOutRecorded: true,
        optInRecorded: false,
        currentStatus: 'opted_out',
        entry,
      };
    }

    // 2. Process Automatic Opt-In / Unstop
    if (this.isOptInKeyword(text)) {
      const entry: OptInLedgerEntry = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        phoneNumber: input.phoneNumber,
        status: 'opted_in',
        source: 'keyword_start',
        timestamp: new Date().toISOString(),
        evidenceNote: 'Customer replied START via WhatsApp',
      };

      ledger.push(entry);

      return {
        optOutRecorded: false,
        optInRecorded: true,
        currentStatus: 'opted_in',
        entry,
      };
    }

    // 3. Normal inbound message — resolve existing status
    return {
      optOutRecorded: false,
      optInRecorded: false,
      currentStatus: this.resolveContactStatus(input.contactId || input.phoneNumber, ledger),
    };
  }

  /**
   * Resolves contact opt status dynamically from chronological ledger history.
   * Latest ledger entry determines the authoritative status.
   */
  static resolveContactStatus(
    contactIdentifier: string,
    ledger: OptInLedgerEntry[]
  ): OptStatus {
    if (!contactIdentifier || !ledger.length) return 'unknown';

    // Reverse scan to fetch the most recent entry deterministically
    for (let i = ledger.length - 1; i >= 0; i--) {
      const e = ledger[i];
      if (e.contactId === contactIdentifier || e.phoneNumber === contactIdentifier) {
        return e.status;
      }
    }

    return 'unknown';
  }

  /**
   * Performs pre-send campaign compliance validation across prospective recipients
   * Generates warnings and allows excluding unverified or opted-out contacts.
   */
  static validateCampaignRecipients(
    contacts: Contact[],
    ledger: OptInLedgerEntry[]
  ): CampaignComplianceAudit {
    let optedInCount = 0;
    let unknownCount = 0;
    let optedOutCount = 0;
    const flaggedRecipients: Contact[] = [];
    const warnings: string[] = [];

    for (const contact of contacts) {
      const status = this.resolveContactStatus(contact.id || contact.phoneNumber, ledger);

      if (status === 'opted_in') {
        optedInCount += 1;
      } else if (status === 'opted_out') {
        optedOutCount += 1;
        flaggedRecipients.push(contact);
      } else {
        unknownCount += 1;
        flaggedRecipients.push(contact);
      }
    }

    const total = contacts.length;
    const flaggedCount = flaggedRecipients.length;

    if (optedOutCount > 0) {
      warnings.push(
        `⛔ High Risk: ${optedOutCount} recipient(s) have explicitly opted out. WhatsApp Cloud API policy strictly forbids sending marketing templates without active opt-in.`
      );
    }

    if (unknownCount > 0) {
      warnings.push(
        `⚠️ Compliance Notice: ${unknownCount} of ${total} recipient(s) lack recorded opt-in evidence. Sending broadcasts to unconfirmed contacts increases spam flags and can degrade phone number quality to RED.`
      );
    }

    const filterCompliantRecipients = (onlyOptedIn = true): Contact[] => {
      if (!onlyOptedIn) return contacts;
      return contacts.filter(
        (c) => this.resolveContactStatus(c.id || c.phoneNumber, ledger) === 'opted_in'
      );
    };

    return {
      total,
      optedInCount,
      unknownCount,
      optedOutCount,
      flaggedCount,
      flaggedRecipients,
      warnings,
      filterCompliantRecipients,
    };
  }
}
