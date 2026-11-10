// End-to-End Automated Verification Script for WhatsPulse CRM
// Phase 1A: Reliability & Security Test Suite
// Run with: node test-e2e.mjs

import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Re-exec with --experimental-strip-types in Node 22 if not already active
if (!process.execArgv.includes('--experimental-strip-types')) {
  const { spawnSync } = await import('child_process');
  const scriptPath = fileURLToPath(import.meta.url);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', scriptPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

// Dynamic import after strip-types is guaranteed active
const { WebhookProcessor } = await import('./src/lib/whatsapp/webhook.ts');
const { CareWindowService } = await import('./src/lib/whatsapp/care-window.ts');
const { MetaErrorMapper } = await import('./src/lib/whatsapp/errors.ts');
const { OutboundQueue } = await import('./src/lib/queue/outbound-queue.ts');
const { CryptoService } = await import('./src/lib/whatsapp/crypto.ts');
const { TemplateValidator } = await import('./src/lib/whatsapp/template-validator.ts');
const { MediaStorageService } = await import('./src/lib/whatsapp/media.ts');
const { PricingService } = await import('./src/lib/whatsapp/pricing.ts');
const { ComplianceService } = await import('./src/lib/whatsapp/compliance.ts');
const { QualityMonitoringService } = await import('./src/lib/whatsapp/quality.ts');
const { CannedReplyService } = await import('./src/lib/inbox/canned-replies.ts');
const { AssignmentService } = await import('./src/lib/inbox/assignment.ts');
const { BusinessHoursService } = await import('./src/lib/inbox/business-hours.ts');
const { SnoozeService } = await import('./src/lib/inbox/snooze.ts');
const { MentionService } = await import('./src/lib/inbox/mentions.ts');
const { ApiKeyService } = await import('./src/lib/api/api-keys.ts');
const { OutboundWebhookService } = await import('./src/lib/webhooks/outbound-webhook.ts');
const { DemoIsolationService } = await import('./src/lib/demo/demo-isolation.ts');
const { PresenceService } = await import('./src/lib/realtime/presence.ts');

console.log('🚀 Starting WhatsPulse CRM Phase 3B Automated Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// Group 1: HMAC SHA-256 Signature Verification & Edge Cases
// ============================================================================
console.log('--- Test Group 1: Meta Webhook Security & Signature Edge Cases ---');
const testSecret = 'secret_test_key_phase1a_987654321';
const validPayload = JSON.stringify({ entry: [{ id: '109847291823749' }] });
const validHmac = crypto.createHmac('sha256', testSecret).update(validPayload).digest('hex');
const validHeader = `sha256=${validHmac}`;

// 1.1 Valid signature is accepted
assert(
  WebhookProcessor.verifySignature(validPayload, validHeader, testSecret) === true,
  'Valid HMAC signature accepted'
);

// 1.2 Tampered payload is rejected
const tamperedPayload = JSON.stringify({ entry: [{ id: '109847291823749', tampered: true }] });
assert(
  WebhookProcessor.verifySignature(tamperedPayload, validHeader, testSecret) === false,
  'Tampered payload rejected'
);

// 1.3 Missing signature header is rejected
assert(
  WebhookProcessor.verifySignature(validPayload, null, testSecret) === false,
  'Missing signature header (null) is rejected'
);
assert(
  WebhookProcessor.verifySignature(validPayload, undefined, testSecret) === false,
  'Missing signature header (undefined) is rejected'
);

// 1.4 Missing appSecret is rejected (never allow silent bypass)
assert(
  WebhookProcessor.verifySignature(validPayload, validHeader, '') === false,
  'Empty appSecret rejected'
);
assert(
  WebhookProcessor.verifySignature(validPayload, validHeader, undefined) === false,
  'Undefined appSecret rejected'
);

// 1.5 Malformed header prefixes
assert(
  WebhookProcessor.verifySignature(validPayload, `sha1=${validHmac}`, testSecret) === false,
  'Non-sha256 prefix rejected'
);
assert(
  WebhookProcessor.verifySignature(validPayload, 'malformed_header_string', testSecret) === false,
  'Header without prefix rejected'
);
assert(
  WebhookProcessor.verifySignature(validPayload, 'sha256=', testSecret) === false,
  'Empty sha256 hex digest rejected'
);

// 1.6 Hex length mismatch MUST NOT throw RangeError in timingSafeEqual
assert(
  WebhookProcessor.verifySignature(validPayload, 'sha256=1234abcd', testSecret) === false,
  'Truncated hex signature rejected safely without timingSafeEqual throwing'
);
assert(
  WebhookProcessor.verifySignature(validPayload, `sha256=${validHmac}extra00`, testSecret) === false,
  'Oversized hex signature rejected safely without timingSafeEqual throwing'
);

// ============================================================================
// Group 2: Webhook Subscription Handshake (GET /api/webhooks/whatsapp)
// ============================================================================
console.log('\n--- Test Group 2: Webhook Subscription Handshake ---');
const expectedVerifyToken = 'whatspulse_secret_token_123';
const challengeCode = '1158201444';

const validHandshake = WebhookProcessor.verifySubscription(
  'subscribe',
  expectedVerifyToken,
  challengeCode,
  expectedVerifyToken
);
assert(
  validHandshake.isValid === true && validHandshake.challenge === challengeCode,
  'Meta GET webhook subscription challenge returns challenge'
);

const invalidTokenHandshake = WebhookProcessor.verifySubscription(
  'subscribe',
  'invalid_token_xyz',
  challengeCode,
  expectedVerifyToken
);
assert(
  invalidTokenHandshake.isValid === false,
  'Invalid verify token rejected'
);

const invalidModeHandshake = WebhookProcessor.verifySubscription(
  'unsubscribe',
  expectedVerifyToken,
  challengeCode,
  expectedVerifyToken
);
assert(
  invalidModeHandshake.isValid === false,
  'Invalid hub.mode rejected'
);

// ============================================================================
// Group 3: Multi-Tenant Routing & Tenant Resolution
// ============================================================================
console.log('\n--- Test Group 3: Multi-Tenant Routing & Isolation ---');

const mockTenants = [
  {
    workspaceId: 'ws_tenant_alpha',
    phoneNumberId: 'phone_id_alpha_111',
    pathToken: 'token_alpha_xyz',
    appSecret: 'secret_alpha_001',
    webhookVerifyToken: 'verify_alpha_001',
  },
  {
    workspaceId: 'ws_tenant_beta',
    phoneNumberId: 'phone_id_beta_222',
    pathToken: 'token_beta_abc',
    appSecret: 'secret_beta_002',
    webhookVerifyToken: 'verify_beta_002',
  },
];

// 3.1 Resolve by phone_number_id
const resolvedAlpha = WebhookProcessor.resolveTenant(
  { phoneNumberId: 'phone_id_alpha_111' },
  mockTenants
);
assert(
  resolvedAlpha !== null && resolvedAlpha.workspaceId === 'ws_tenant_alpha' && resolvedAlpha.appSecret === 'secret_alpha_001',
  'Tenant resolved correctly by phone_number_id'
);

// 3.2 Resolve by path token
const resolvedBeta = WebhookProcessor.resolveTenant(
  { pathToken: 'token_beta_abc' },
  mockTenants
);
assert(
  resolvedBeta !== null && resolvedBeta.workspaceId === 'ws_tenant_beta' && resolvedBeta.appSecret === 'secret_beta_002',
  'Tenant resolved correctly by path token'
);

// 3.3 Unknown tenant returns null without leaking details
const unknownTenant = WebhookProcessor.resolveTenant(
  { phoneNumberId: 'unknown_phone_999' },
  mockTenants
);
assert(
  unknownTenant === null,
  'Unknown tenant returns null without leaking internal credentials'
);

// ============================================================================
// Group 4: Webhook Idempotency (Duplicate wamid Ingestion)
// ============================================================================
console.log('\n--- Test Group 4: Webhook Idempotency (Duplicate Deliveries) ---');

const messageStore = [];
const pendingStatusStore = [];

const incomingMsgPayload = {
  from: '+14155552671',
  name: 'Marcus Vance',
  messageId: 'wamid.HBgL_IDEMPOTENCY_TEST_001',
  timestamp: new Date().toISOString(),
  type: 'text',
  body: 'Testing idempotency on duplicate webhook deliveries.',
};

// First delivery
const firstResult = WebhookProcessor.processIncomingMessage(
  'ws_tenant_alpha',
  incomingMsgPayload,
  messageStore,
  pendingStatusStore
);
assert(
  firstResult.deduplicated === false && messageStore.length === 1,
  'First delivery of wamid successfully creates message row'
);

// Duplicate delivery with same wamid
const secondResult = WebhookProcessor.processIncomingMessage(
  'ws_tenant_alpha',
  incomingMsgPayload,
  messageStore,
  pendingStatusStore
);
assert(
  secondResult.deduplicated === true && messageStore.length === 1,
  'Duplicate delivery of identical wamid is a no-op (exactly 1 message row remains)'
);

// ============================================================================
// Group 5: Monotonic Status Ordering (Never Downgrade Status)
// ============================================================================
console.log('\n--- Test Group 5: Monotonic Status Ranking ---');

// 5.1 Progression sent -> delivered -> read
assert(
  WebhookProcessor.canTransitionStatus('sent', 'delivered') === true,
  'Status can progress: sent -> delivered'
);
assert(
  WebhookProcessor.canTransitionStatus('delivered', 'read') === true,
  'Status can progress: delivered -> read'
);

// 5.2 Out-of-order delivery: "read" arriving before "delivered" does NOT downgrade
assert(
  WebhookProcessor.canTransitionStatus('read', 'delivered') === false,
  'Out-of-order check: read -> delivered is rejected (status cannot downgrade)'
);
assert(
  WebhookProcessor.canTransitionStatus('read', 'sent') === false,
  'Out-of-order check: read -> sent is rejected'
);

// 5.3 Apply out-of-order update to stored message
const monotonicMsg = {
  id: 'msg_monotonic_01',
  conversationId: 'conv_01',
  workspaceId: 'ws_tenant_alpha',
  waMessageId: 'wamid.HBgL_MONOTONIC_TEST_002',
  status: 'read',
  content: 'Monotonic test message',
};
const storeForMonotonic = [monotonicMsg];

const downgradeAttempt = WebhookProcessor.processStatusUpdate(
  'ws_tenant_alpha',
  {
    messageId: 'wamid.HBgL_MONOTONIC_TEST_002',
    recipientId: '+14155552671',
    status: 'delivered',
    timestamp: new Date().toISOString(),
  },
  storeForMonotonic,
  []
);
assert(
  downgradeAttempt.applied === false && storeForMonotonic[0].status === 'read',
  'Stored message status stays "read" when subsequent "delivered" arrives out-of-order'
);

// ============================================================================
// Group 6: Early Status Arrival (Status Arriving Before Message Row Exists)
// ============================================================================
console.log('\n--- Test Group 6: Early Status Arrival & Pending Status Resolution ---');

const earlyStatusStore = [];
const earlyPendingStatuses = [];

const earlyWamid = 'wamid.HBgL_EARLY_STATUS_TEST_003';

// 6.1 Status arrives FIRST (message does not exist yet)
const earlyStatusResult = WebhookProcessor.processStatusUpdate(
  'ws_tenant_alpha',
  {
    messageId: earlyWamid,
    recipientId: '+14155552671',
    status: 'read',
    timestamp: new Date().toISOString(),
  },
  earlyStatusStore,
  earlyPendingStatuses
);
assert(
  earlyStatusResult.applied === false &&
  earlyStatusResult.pending === true &&
  earlyPendingStatuses.length === 1 &&
  earlyPendingStatuses[0].waMessageId === earlyWamid,
  'Status arriving before message is stored in pending_statuses'
);

// 6.2 Message arrives LATER -> Pending status is immediately resolved & applied
const lateMessagePayload = {
  from: '+14155552671',
  name: 'Marcus Vance',
  messageId: earlyWamid,
  timestamp: new Date().toISOString(),
  type: 'text',
  body: 'Delayed message arriving after its read receipt.',
};

const lateMessageResult = WebhookProcessor.processIncomingMessage(
  'ws_tenant_alpha',
  lateMessagePayload,
  earlyStatusStore,
  earlyPendingStatuses
);

assert(
  lateMessageResult.message.status === 'read',
  'Late-arriving message immediately inherits the pending "read" status'
);
assert(
  earlyPendingStatuses[0].isApplied === true,
  'Pending status marked as applied once message row exists'
);

// ============================================================================
// Group 7: Error Code Storage on Failed Statuses
// ============================================================================
console.log('\n--- Test Group 7: Error Code Storage on Failed Statuses ---');

const failedMsgWamid = 'wamid.HBgL_FAIL_TEST_004';
const failedMsgStore = [
  {
    id: 'msg_fail_01',
    conversationId: 'conv_01',
    workspaceId: 'ws_tenant_alpha',
    waMessageId: failedMsgWamid,
    status: 'sent',
    content: 'Failing message test',
  },
];

const failUpdate = WebhookProcessor.processStatusUpdate(
  'ws_tenant_alpha',
  {
    messageId: failedMsgWamid,
    recipientId: '+14155552671',
    status: 'failed',
    timestamp: new Date().toISOString(),
    error: {
      code: 131047,
      title: 'Message failed to send',
      message: 'More than 24 hours have passed since the customer last replied',
    },
  },
  failedMsgStore,
  []
);

assert(
  failUpdate.applied === true &&
  failedMsgStore[0].status === 'failed' &&
  failedMsgStore[0].errorCode === 131047 &&
  failedMsgStore[0].errorDetails?.code === 131047,
  'Failed status update records error code 131047 and error details on the message'
);

// ============================================================================
// Group 8: Customer Care Window (24h) & Server-Side Enforcement
// ============================================================================
console.log('\n--- Test Group 8: Customer Care Window (24h) Server-Side Enforcement ---');

const nowMs = Date.now();
const twentyFiveHoursAgo = new Date(nowMs - 25 * 60 * 60 * 1000).toISOString();
const tenHoursAgo = new Date(nowMs - 10 * 60 * 60 * 1000).toISOString();

// 8.1 Non-template send outside 24h window is rejected with typed error
const expiredNonTemplate = CareWindowService.validateOutboundSend({
  isTemplate: false,
  lastInboundAt: twentyFiveHoursAgo,
});
assert(
  expiredNonTemplate.allowed === false &&
  expiredNonTemplate.code === 'WINDOW_CLOSED' &&
  expiredNonTemplate.errorCode === 131047,
  'Non-template send outside 24h window is rejected with typed error 131047 (WINDOW_CLOSED)'
);

// 8.2 Template send outside 24h window is ALLOWED
const expiredTemplate = CareWindowService.validateOutboundSend({
  isTemplate: true,
  lastInboundAt: twentyFiveHoursAgo,
});
assert(
  expiredTemplate.allowed === true,
  'Template send outside 24h window is permitted'
);

// 8.3 Non-template send INSIDE 24h window is allowed
const validNonTemplate = CareWindowService.validateOutboundSend({
  isTemplate: false,
  lastInboundAt: tenHoursAgo,
});
assert(
  validNonTemplate.allowed === true,
  'Non-template send within 24h window is permitted'
);

// 8.4 Window resets on each new inbound message
const resetTimestamp = new Date().toISOString();
const resetCheck = CareWindowService.validateOutboundSend({
  isTemplate: false,
  lastInboundAt: resetTimestamp,
});
assert(
  resetCheck.allowed === true,
  'Window resets on new inbound message timestamp'
);

// ============================================================================
// Group 9: Free Entry Point (FEP) 72h Window Mechanics
// ============================================================================
console.log('\n--- Test Group 9: Free Entry Point (FEP) Mechanics ---');

const fepActiveExpiry = new Date(nowMs + 47 * 60 * 60 * 1000).toISOString(); // Active 72h FEP

// 9.1 FEP NEVER permits free-form sends after 24h window has closed
const fepFreeformAttempt = CareWindowService.validateOutboundSend({
  isTemplate: false,
  lastInboundAt: twentyFiveHoursAgo,
  fepExpiresAt: fepActiveExpiry,
});
assert(
  fepFreeformAttempt.allowed === false &&
  fepFreeformAttempt.code === 'WINDOW_CLOSED',
  'FEP referral NEVER permits free-form sends after 24h care window expires'
);

// 9.2 FEP correctly flags message for COST attribution
const isCostFree = CareWindowService.isFepFree({
  fepExpiresAt: fepActiveExpiry,
});
assert(
  isCostFree === true,
  'FEP active window accurately flags conversation for zero-cost attribution'
);

// 9.3 Expired FEP is not free
const expiredFep = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
assert(
  CareWindowService.isFepFree({ fepExpiresAt: expiredFep }) === false,
  'Expired FEP is correctly marked non-free'
);

// ============================================================================
// Group 10: Campaign Chunking & Crash Resumption (5,000 Recipients)
// ============================================================================
console.log('\n--- Test Group 10: Campaign Chunking & Resumption (5,000 Recipients) ---');

// Generate 5,000 mock recipients
const largeRecipientList = [];
for (let i = 1; i <= 5000; i++) {
  largeRecipientList.push({
    id: `rec_${i}`,
    phoneNumber: `+1415555${String(i).padStart(4, '0')}`,
    optStatus: 'opted_in',
    status: 'pending',
  });
}

// 10.1 Chunked processing with batchSize = 50
const batchSize = 50;
const firstBatchResult = OutboundQueue.processBatch(largeRecipientList, {
  batchSize,
  maxBatches: 2, // Process 100 recipients (2 chunks)
});

assert(
  firstBatchResult.processedCount === 100 &&
  firstBatchResult.remainingCount === 4900,
  '5,000-recipient campaign processes in chunks (2 batches of 50 = 100 processed)'
);

// 10.2 Simulated crash & resumption
// Simulate crash by creating a new queue worker on the same list state
const resumedBatchResult = OutboundQueue.processBatch(largeRecipientList, {
  batchSize,
  maxBatches: 1, // Resume and process next batch
});

assert(
  resumedBatchResult.startIndex === 100 &&
  resumedBatchResult.processedCount === 50 &&
  resumedBatchResult.remainingCount === 4850,
  'Campaign resumes correctly after simulated crash without re-sending processed recipients'
);

// ============================================================================
// Group 11: Opt-Out Contact Skipping
// ============================================================================
console.log('\n--- Test Group 11: Opt-Out Contact Skipping ---');

const mixedOptList = [
  { id: 'opt_1', phoneNumber: '+1001', optStatus: 'opted_in', status: 'pending' },
  { id: 'opt_2', phoneNumber: '+1002', optStatus: 'opted_in', status: 'pending' },
  { id: 'opt_3', phoneNumber: '+1003', optStatus: 'unknown', status: 'pending' },
  { id: 'opt_4', phoneNumber: '+1004', optStatus: 'opted_out', status: 'pending' },
  { id: 'opt_5', phoneNumber: '+1005', optStatus: 'opted_out', status: 'pending' },
];

const optRunResult = OutboundQueue.processBatch(mixedOptList, { batchSize: 10 });
assert(
  optRunResult.sentCount === 3 &&
  optRunResult.skippedCount === 2 &&
  mixedOptList[3].status === 'skipped' &&
  mixedOptList[4].status === 'skipped',
  'Opted-out contacts are skipped, status set to "skipped", and skip counts reported accurately'
);

// ============================================================================
// Group 12: Per-Number Rate Limiting
// ============================================================================
console.log('\n--- Test Group 12: Per-Number Rate Limiter ---');

const rateLimiter = OutboundQueue.createRateLimiter({ maxMessagesPerSecond: 80 });
assert(
  rateLimiter.isAllowed() === true,
  'Initial message dispatch allowed within rate limit'
);

// Simulate burst consumption
for (let i = 0; i < 80; i++) {
  rateLimiter.consume();
}
// 81st message in same second should trigger throttle
const throttled = !rateLimiter.isAllowed();
assert(
  throttled === true,
  'Per-number rate limit (80 MPS) is strictly respected, throttling excess burst'
);

// ============================================================================
// Group 13: Meta Error Mapping & Exponential Backoff
// ============================================================================
console.log('\n--- Test Group 13: Meta Error Mapping & Retry Guidance ---');

// 13.1 Rate limit error 130429 -> retryable with backoff
const rateLimitErr = MetaErrorMapper.mapError(130429);
assert(
  rateLimitErr.isRetryable === true &&
  rateLimitErr.retryDelayMs > 0 &&
  rateLimitErr.userMessage.includes('Rate limit'),
  'Code 130429 mapped to retryable with exponential backoff'
);

// 13.2 Pair rate limit 131056 -> retryable with 60s delay
const pairRateErr = MetaErrorMapper.mapError(131056);
assert(
  pairRateErr.isRetryable === true &&
  pairRateErr.retryDelayMs >= 60000,
  'Code 131056 mapped to pair rate limit retry rule'
);

// 13.3 Care window closed 131047 -> permanent failure, NO retry
const windowErr = MetaErrorMapper.mapError(131047);
assert(
  windowErr.isRetryable === false &&
  windowErr.userMessage.includes('24 hours'),
  'Code 131047 mapped to permanent failure (no retry, switch to template)'
);

// 13.4 Undeliverable 131026 -> permanent failure, NO retry
const undeliverableErr = MetaErrorMapper.mapError(131026);
assert(
  undeliverableErr.isRetryable === false,
  'Code 131026 mapped to permanent failure'
);

// 13.5 Auth token expired 190 -> permanent failure, NO retry
const authErr = MetaErrorMapper.mapError(190);
assert(
  authErr.isRetryable === false &&
  authErr.actionRequired === 'REFRESH_TOKEN',
  'Code 190 mapped to auth revoked alert rule'
);

// ============================================================================
// Group 14: AES-256-GCM Token Encryption & Key Rotation Prefix
// ============================================================================
console.log('\n--- Test Group 14: AES-256-GCM Token Encryption & Key Rotation ---');

const masterKeyV1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 32 bytes hex
const masterKeyV2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const sampleToken = 'EAAGm0PX4ZCpsBAK987654321_meta_access_token_secret_sample';

// 14.1 Encrypt with version prefix (v1)
const encryptedV1 = CryptoService.encrypt(sampleToken, masterKeyV1, 'v1');
assert(
  encryptedV1.startsWith('v1:') && encryptedV1.split(':').length === 4,
  'Encrypted token format starts with key version prefix (v1:iv:tag:ciphertext)'
);

// 14.2 Decrypt round trip returns exact plaintext
const decryptedV1 = CryptoService.decrypt(encryptedV1, masterKeyV1);
assert(
  decryptedV1 === sampleToken,
  'AES-256-GCM decrypt round trip reproduces exact original plaintext token'
);

// 14.3 Key rotation allows multiple active key versions
const encryptedV2 = CryptoService.encrypt(sampleToken, masterKeyV2, 'v2');
assert(
  encryptedV2.startsWith('v2:'),
  'Key rotation produces new ciphertext with v2 prefix'
);

const keyRing = { v1: masterKeyV1, v2: masterKeyV2 };
const decryptedRotatedV1 = CryptoService.decryptWithKeyring(encryptedV1, keyRing);
const decryptedRotatedV2 = CryptoService.decryptWithKeyring(encryptedV2, keyRing);
assert(
  decryptedRotatedV1 === sampleToken && decryptedRotatedV2 === sampleToken,
  'Keyring successfully decrypts both v1 and v2 encrypted tokens (seamless key rotation)'
);

// 14.4 Tampered ciphertext is rejected by GCM authentication tag
const tamperedEncrypted = encryptedV1.slice(0, -4) + 'abcd';
let tamperCaught = false;
try {
  CryptoService.decrypt(tamperedEncrypted, masterKeyV1);
} catch {
  tamperCaught = true;
}
assert(
  tamperCaught === true,
  'Tampered ciphertext rejected by AES-GCM authentication tag verification'
);

// ============================================================================
// Group 15: Secrets Table RLS Policy Contract
// ============================================================================
console.log('\n--- Test Group 15: Secrets Table RLS Security Contract ---');

// Verify that workspace_secrets access is strictly restricted to service_role
assert(
  CryptoService.checkRlsAccess('anon') === false,
  'RLS Policy Contract: anon role has zero read/select permission on workspace_secrets'
);
assert(
  CryptoService.checkRlsAccess('authenticated') === false,
  'RLS Policy Contract: authenticated client role has zero read/select permission on workspace_secrets'
);
assert(
  CryptoService.checkRlsAccess('service_role') === true,
  'RLS Policy Contract: only service_role is authorized to query workspace_secrets'
);

// ============================================================================
// Group 16: Template Parameter Pre-Validation
// ============================================================================
console.log('\n--- Test Group 16: Template Parameter Count, Format & Media Header Pre-Validation ---');

const testTemplate = {
  id: 'tmpl_shipping_01',
  name: 'order_status_update',
  category: 'UTILITY',
  headerType: 'IMAGE',
  body: 'Hi {{1}}, your order {{2}} has been confirmed for {{3}}.',
};

// 16.1 Variable count mismatch (expected 3, provided 2) -> rejected before calling Meta
const underCountResult = TemplateValidator.validate(testTemplate, {
  bodyParams: ['Elena', 'ORD-9821'],
  headerMediaUrl: 'https://example.com/receipt.jpg',
});
assert(
  underCountResult.valid === false &&
  underCountResult.errorCode === 132001 &&
  underCountResult.reason.includes('mismatch'),
  'Parameter count mismatch (expected 3, provided 2) rejected before calling Meta API'
);

// 16.2 Empty or whitespace variable -> rejected
const emptyParamResult = TemplateValidator.validate(testTemplate, {
  bodyParams: ['Elena', 'ORD-9821', '   '],
  headerMediaUrl: 'https://example.com/receipt.jpg',
});
assert(
  emptyParamResult.valid === false &&
  emptyParamResult.reason.includes('empty'),
  'Blank / whitespace variable rejected'
);

// 16.3 Missing required header media for IMAGE header -> rejected
const missingMediaResult = TemplateValidator.validate(testTemplate, {
  bodyParams: ['Elena', 'ORD-9821', 'Tomorrow'],
  headerMediaUrl: '',
});
assert(
  missingMediaResult.valid === false &&
  missingMediaResult.errorCode === 132012,
  'Missing header image for template with IMAGE header rejected with code 132012'
);

// 16.4 Fully valid template parameters -> accepted
const validTemplateResult = TemplateValidator.validate(testTemplate, {
  bodyParams: ['Elena', 'ORD-9821', 'Tomorrow'],
  headerMediaUrl: 'https://example.com/receipt.jpg',
});
assert(
  validTemplateResult.valid === true,
  'Complete template parameters (body variables + header media) pass pre-validation'
);

// ============================================================================
// Group 17: Inbound Media Download & Storage (Stubbed Meta Fetch)
// ============================================================================
console.log('\n--- Test Group 17: Inbound Media Download & Size Enforcement ---');

// Mock a 1KB image fetch
const mockImageFetch = async (url) => {
  if (url.includes('graph.facebook.com')) {
    return {
      ok: true,
      json: async () => ({
        url: 'https://lookaside.fbsbx.com/sample_image.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
      }),
    };
  }
  return {
    ok: true,
    headers: new Map([['content-type', 'image/jpeg'], ['content-length', '1024']]),
    arrayBuffer: async () => new ArrayBuffer(1024),
  };
};

const mediaDownloadResult = await MediaStorageService.downloadAndStoreMedia(
  'media_id_sample_123',
  'image/jpeg',
  'test_token_abc',
  'ws_prod_01',
  mockImageFetch
);

assert(
  mediaDownloadResult.success === true &&
  mediaDownloadResult.storagePath.includes('ws_prod_01') &&
  mediaDownloadResult.mimeType === 'image/jpeg' &&
  mediaDownloadResult.sizeBytes === 1024,
  'Inbound media downloaded from Meta Graph API and stored in Supabase storage path'
);

// 17.2 Enforce size limit (Reject image exceeding 16MB)
const mockOversizedFetch = async () => {
  return {
    ok: true,
    json: async () => ({
      url: 'https://lookaside.fbsbx.com/oversized_image.jpg',
      mime_type: 'image/jpeg',
      file_size: 20 * 1024 * 1024, // 20 MB
    }),
  };
};

const oversizedResult = await MediaStorageService.downloadAndStoreMedia(
  'media_id_oversized_456',
  'image/jpeg',
  'test_token_abc',
  'ws_prod_01',
  mockOversizedFetch
);

assert(
  oversizedResult.success === false &&
  oversizedResult.errorCode === 'MEDIA_TOO_LARGE',
  'Oversized media (20MB image) rejected exceeding 16MB limit'
);

// ============================================================================
// Group 18: Status Webhook Pricing Object Parsing & Message Attachment
// ============================================================================
console.log('\n--- Test Group 18: Status Webhook Pricing Object & Storage ---');

const mockPricingPayload = {
  entry: [{
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { phone_number_id: '109847291823749', display_phone_number: '+15550192834' },
        statuses: [{
          id: 'wamid.HBgL_PRICE_001',
          recipient_id: '14155552671',
          status: 'delivered',
          timestamp: '1731234567',
          pricing: {
            billable: true,
            pricing_model: 'CBP',
            category: 'marketing',
          },
        }],
      },
      field: 'messages',
    }],
  }],
};

const parsedPricing = WebhookProcessor.parsePayload(mockPricingPayload);
assert(
  parsedPricing.statusUpdates.length === 1 &&
  parsedPricing.statusUpdates[0].pricing?.billable === true &&
  parsedPricing.statusUpdates[0].pricing?.category === 'marketing' &&
  parsedPricing.statusUpdates[0].pricing?.pricingModel === 'CBP',
  'Pricing object parsed accurately from incoming status webhook payload'
);

const testMessageStore = [{
  id: 'msg_price_01',
  workspaceId: 'ws_prod_01',
  waMessageId: 'wamid.HBgL_PRICE_001',
  senderType: 'agent',
  messageType: 'template',
  content: 'Black Friday 50% Off!',
  status: 'sent',
  createdAt: '2026-11-10T12:00:00Z',
}];

WebhookProcessor.processStatusUpdate(
  'ws_prod_01',
  parsedPricing.statusUpdates[0],
  testMessageStore,
  []
);

assert(
  testMessageStore[0].status === 'delivered' &&
  testMessageStore[0].pricing?.billable === true &&
  testMessageStore[0].pricing?.category === 'marketing',
  'Pricing object securely attached to stored message entity upon status update'
);

// ============================================================================
// Group 19: Dynamic Rate Card Spend Aggregation (Workspace, Campaign, Day)
// ============================================================================
console.log('\n--- Test Group 19: Dynamic Rate Card Spend Aggregation ---');

const customRateCard = {
  id: 'rc_custom_2026',
  workspaceId: 'ws_prod_01',
  currency: 'USD',
  rates: {
    marketing: 0.05,
    utility: 0.015,
    service: 0.01,
    authentication: 0.03,
  },
};

const sampleAggMessages = [
  { id: 'm1', workspaceId: 'ws_prod_01', campaignId: 'camp_01', createdAt: '2026-11-10T10:00:00Z', pricing: { billable: true, category: 'marketing' } },
  { id: 'm2', workspaceId: 'ws_prod_01', campaignId: 'camp_01', createdAt: '2026-11-10T11:00:00Z', pricing: { billable: true, category: 'marketing' } },
  { id: 'm3', workspaceId: 'ws_prod_01', campaignId: 'camp_02', createdAt: '2026-11-10T12:00:00Z', pricing: { billable: true, category: 'utility' } },
  { id: 'm4', workspaceId: 'ws_prod_01', createdAt: '2026-11-11T09:00:00Z', pricing: { billable: true, category: 'service' } },
  { id: 'm5', workspaceId: 'ws_prod_02', createdAt: '2026-11-11T10:00:00Z', pricing: { billable: true, category: 'marketing' } },
];

const aggByWorkspace = PricingService.aggregateCosts(sampleAggMessages, {
  groupBy: 'workspace',
  rateCard: customRateCard,
});

assert(
  Math.abs(aggByWorkspace['ws_prod_01'].totalCost - 0.125) < 0.0001 &&
  aggByWorkspace['ws_prod_01'].messageCount === 4 &&
  aggByWorkspace['ws_prod_01'].byCategory.marketing.count === 2,
  'Cost aggregation by workspace accurately computes spend and category counts from custom rate card'
);

const aggByCampaign = PricingService.aggregateCosts(sampleAggMessages, {
  groupBy: 'campaign',
  rateCard: customRateCard,
});

assert(
  Math.abs(aggByCampaign['camp_01'].totalCost - 0.10) < 0.0001 &&
  Math.abs(aggByCampaign['camp_02'].totalCost - 0.015) < 0.0001,
  'Cost aggregation by campaign accurately computes attributable marketing and utility spend'
);

const aggByDay = PricingService.aggregateCosts(sampleAggMessages, {
  groupBy: 'day',
  rateCard: customRateCard,
});

assert(
  Math.abs(aggByDay['2026-11-10'].totalCost - 0.115) < 0.0001 &&
  Math.abs(aggByDay['2026-11-11'].totalCost - 0.06) < 0.0001,
  'Cost aggregation by day accurately groups historical message expenditures'
);

// ============================================================================
// Group 20: Free-Allowance Scope Logic (Per Number vs. Per WABA)
// ============================================================================
console.log('\n--- Test Group 20: Free-Allowance Scope (Per Number vs. Per WABA) ---');

// Case A: Scope = 'waba' (Pool shared across all numbers in WABA)
const wabaScopeConfig = {
  freeServiceMessagesMonthly: 1000,
  allowanceScope: 'waba', // // VERIFY
};

const trackerWaba = PricingService.createUsageTracker(wabaScopeConfig);
// Simulate 1,000 free service messages across two numbers under same WABA
for (let i = 0; i < 600; i++) {
  trackerWaba.recordMessage({ category: 'service', phoneNumberId: 'phone_A', wabaId: 'waba_01' });
}
for (let i = 0; i < 400; i++) {
  trackerWaba.recordMessage({ category: 'service', phoneNumberId: 'phone_B', wabaId: 'waba_01' });
}

// 1,001st service message under same WABA should NOT be free
const wabaResult1001 = PricingService.calculateMessageCost(
  { pricing: { billable: true, category: 'service' }, phoneNumberId: 'phone_A', wabaId: 'waba_01' },
  customRateCard,
  trackerWaba
);

assert(
  wabaResult1001.isFreeTier === false &&
  Math.abs(wabaResult1001.cost - 0.01) < 0.0001,
  'WABA-scoped free allowance is exhausted across shared phone numbers (1001st message billed)'
);

// Case B: Scope = 'phone_number' (Independent pool for each registered number)
const phoneScopeConfig = {
  freeServiceMessagesMonthly: 1000,
  allowanceScope: 'phone_number', // // VERIFY
};

const trackerPhone = PricingService.createUsageTracker(phoneScopeConfig);
for (let i = 0; i < 1000; i++) {
  trackerPhone.recordMessage({ category: 'service', phoneNumberId: 'phone_A', wabaId: 'waba_01' });
}

// Phone A 1001st is billed
const phoneAResult = PricingService.calculateMessageCost(
  { pricing: { billable: true, category: 'service' }, phoneNumberId: 'phone_A', wabaId: 'waba_01' },
  customRateCard,
  trackerPhone
);

// Phone B 1st message is STILL FREE under phone_number scope
const phoneBResult = PricingService.calculateMessageCost(
  { pricing: { billable: true, category: 'service' }, phoneNumberId: 'phone_B', wabaId: 'waba_01' },
  customRateCard,
  trackerPhone
);

assert(
  phoneAResult.isFreeTier === false &&
  phoneBResult.isFreeTier === true &&
  phoneBResult.cost === 0,
  'Phone-number-scoped free allowance gives independent 1,000 allowance to each registered number'
);

// ============================================================================
// Group 21: Automatic Keyword Opt-Out & Ledger Derivation
// ============================================================================
console.log('\n--- Test Group 21: Automatic Keyword Opt-Out & Ledger Derivation ---');

const complianceLedger = [];

// Customer replies STOP
const stopResult = ComplianceService.processInboundKeyword({
  text: 'STOP',
  workspaceId: 'ws_prod_01',
  contactId: 'cnt_marcus',
  phoneNumber: '+14155552671',
}, complianceLedger);

assert(
  stopResult.optOutRecorded === true &&
  stopResult.currentStatus === 'opted_out' &&
  complianceLedger.length === 1 &&
  complianceLedger[0].status === 'opted_out' &&
  complianceLedger[0].source === 'keyword_stop',
  'Replying "STOP" automatically records opt-out ledger entry with evidence note'
);

// Derived status reflects latest ledger entry
assert(
  ComplianceService.resolveContactStatus('cnt_marcus', complianceLedger) === 'opted_out',
  'Contact status is dynamically derived from immutable compliance ledger'
);

// Customer subsequently replies START
const startResult = ComplianceService.processInboundKeyword({
  text: 'START',
  workspaceId: 'ws_prod_01',
  contactId: 'cnt_marcus',
  phoneNumber: '+14155552671',
}, complianceLedger);

assert(
  startResult.optInRecorded === true &&
  ComplianceService.resolveContactStatus('cnt_marcus', complianceLedger) === 'opted_in',
  'Replying "START" records new opt-in ledger entry, updating derived status to opted_in'
);

// Case-insensitive unsubscribe
const unsubResult = ComplianceService.processInboundKeyword({
  text: '  unsubscribe  ',
  workspaceId: 'ws_prod_01',
  contactId: 'cnt_clara',
  phoneNumber: '+447911123456',
}, complianceLedger);

assert(
  unsubResult.optOutRecorded === true &&
  ComplianceService.resolveContactStatus('cnt_clara', complianceLedger) === 'opted_out',
  'Case-insensitive and whitespace-trimmed "unsubscribe" properly triggers opt-out'
);

// ============================================================================
// Group 22: Pre-Send Campaign Compliance Inspection
// ============================================================================
console.log('\n--- Test Group 22: Pre-Send Campaign Compliance Inspection ---');

const sampleAudience = [
  { id: 'c1', name: 'User 1', phoneNumber: '+1001' },
  { id: 'c2', name: 'User 2', phoneNumber: '+1002' },
  { id: 'c3', name: 'User 3', phoneNumber: '+1003' },
  { id: 'c4', name: 'User 4', phoneNumber: '+1004' },
];

const mockLedger = [
  { contactId: 'c1', status: 'opted_in', source: 'web_form', timestamp: '2026-10-01T00:00:00Z' },
  { contactId: 'c2', status: 'opted_in', source: 'checkout_checkbox', timestamp: '2026-10-02T00:00:00Z' },
  { contactId: 'c3', status: 'opted_out', source: 'keyword_stop', timestamp: '2026-10-03T00:00:00Z' },
  // c4 has no ledger entries -> status unknown
];

const audit = ComplianceService.validateCampaignRecipients(sampleAudience, mockLedger);

assert(
  audit.total === 4 &&
  audit.optedInCount === 2 &&
  audit.optedOutCount === 1 &&
  audit.unknownCount === 1 &&
  audit.flaggedCount === 2, // c3 (opted_out) + c4 (unknown)
  'Pre-send campaign audit correctly identifies contacts lacking explicit opt-in'
);

assert(
  audit.warnings.length > 0 &&
  audit.warnings[0].includes('opt-in'),
  'Pre-send compliance warning generated for non-opted-in contacts'
);

const safeList = audit.filterCompliantRecipients(true);
assert(
  safeList.length === 2 &&
  safeList.map(c => c.id).sort().join(',') === 'c1,c2',
  'Filter helper cleanly isolates only verified opted-in recipients'
);

// ============================================================================
// Group 23: Phone Quality & Messaging Limit Webhooks with Degradation Alerting
// ============================================================================
console.log('\n--- Test Group 23: Phone Quality & Limit Webhooks with Degradation Alerting ---');

const qualityAlerts = [];

const qualityPayload = {
  display_phone_number: '+1 (555) 019-2834',
  event: 'ON_FLAGGED',
  current_limit: 'TIER_10K',
  quality_rating: 'YELLOW', // Dropped from GREEN
};

const qualityResult = QualityMonitoringService.processQualityUpdate(
  qualityPayload,
  'ws_prod_01',
  qualityAlerts,
  'GREEN' // Previous rating
);

assert(
  qualityResult.degraded === true &&
  qualityResult.newRating === 'YELLOW' &&
  qualityAlerts.length === 1 &&
  qualityAlerts[0].level === 'warning' &&
  qualityAlerts[0].title.includes('Degraded'),
  'Quality rating degradation (GREEN -> YELLOW) records quality log and triggers in-app alert'
);

// Severe drop to RED
QualityMonitoringService.processQualityUpdate(
  { ...qualityPayload, quality_rating: 'RED', event: 'ON_FLAGGED' },
  'ws_prod_01',
  qualityAlerts,
  'YELLOW'
);

assert(
  qualityAlerts.length === 2 &&
  qualityAlerts[1].level === 'danger' &&
  qualityAlerts[1].message.includes('RED'),
  'Quality drop to RED creates urgent critical danger alert'
);

// Messaging limit downgrade
const limitDowngradeResult = QualityMonitoringService.processQualityUpdate(
  { ...qualityPayload, quality_rating: 'RED', current_limit: 'TIER_1K', event: 'ON_LIMIT_CHANGED' },
  'ws_prod_01',
  qualityAlerts,
  'RED',
  'TIER_10K' // Previous limit
);

assert(
  limitDowngradeResult.limitDegraded === true &&
  qualityAlerts.length === 3 &&
  qualityAlerts[2].title.includes('Messaging Limit'),
  'Messaging limit downgrade triggers dedicated tier reduction alert'
);

// ============================================================================
// Group 24: Canned Replies Matching & Variable Interpolation
// ============================================================================
console.log('\n--- Test Group 24: Canned Replies Matching & Variable Interpolation ---');

const sampleCanned = [
  { id: 'cr_1', workspaceId: 'ws_prod_01', shortcut: 'refund', title: 'Refund Policy', content: 'Hi {{contact_name}}, our refund takes 3-5 business days. Best, {{agent_name}}.' },
  { id: 'cr_2', workspaceId: 'ws_prod_01', shortcut: 'hours', title: 'Opening Hours', content: 'Hi {{contact_name}}, our team is available Mon-Fri 9am-6pm.' },
];

// 24.1 Search by slash command shortcut
const matchedCanned = CannedReplyService.search(sampleCanned, '/ref');
assert(
  matchedCanned.length === 1 && matchedCanned[0].shortcut === 'refund',
  'Canned reply successfully matched by slash command "/ref"'
);

// 24.2 Variable interpolation
const interpolated = CannedReplyService.interpolate(matchedCanned[0].content, {
  contact_name: 'Elena Rostova',
  agent_name: 'Alex Rivera',
});
assert(
  interpolated === 'Hi Elena Rostova, our refund takes 3-5 business days. Best, Alex Rivera.',
  'Placeholders {{contact_name}} and {{agent_name}} accurately interpolated'
);

// ============================================================================
// Group 25: Auto-Assignment Engine (Round-Robin & Least-Loaded with Availability)
// ============================================================================
console.log('\n--- Test Group 25: Auto-Assignment Engine & Availability ---');

const agentList = [
  { id: 'agent_1', fullName: 'Sarah', isOnline: true },
  { id: 'agent_2', fullName: 'Alex', isOnline: false }, // OFFLINE
  { id: 'agent_3', fullName: 'Elena', isOnline: true },
];

const openConvs = [
  { id: 'c1', assignedTo: 'agent_1' },
  { id: 'c2', assignedTo: 'agent_1' },
  { id: 'c3', assignedTo: 'agent_3' },
];

// 25.1 Round-Robin mode: skips offline agent_2, cycles agent_1 -> agent_3 -> agent_1
const rrState = { lastIndex: -1 };
const assigned1 = AssignmentService.assignRoundRobin(agentList, rrState);
const assigned2 = AssignmentService.assignRoundRobin(agentList, rrState);
const assigned3 = AssignmentService.assignRoundRobin(agentList, rrState);
assert(
  assigned1?.id === 'agent_1' && assigned2?.id === 'agent_3' && assigned3?.id === 'agent_1',
  'Round-robin auto-assignment cycles through online agents only, skipping offline agents'
);

// 25.2 Least-Loaded mode: agent_3 has 1 open chat, agent_1 has 2 open chats -> agent_3 gets the chat
const leastLoaded = AssignmentService.assignLeastLoaded(agentList, openConvs);
assert(
  leastLoaded?.id === 'agent_3',
  'Least-loaded auto-assignment selects the online agent with the fewest active conversations'
);

// 25.3 When all agents offline: returns null / unassigned
const allOffline = agentList.map((a) => ({ ...a, isOnline: false }));
assert(
  AssignmentService.assignRoundRobin(allOffline, rrState) === null &&
  AssignmentService.assignLeastLoaded(allOffline, openConvs) === null,
  'Auto-assignment returns null safely when no agents are online'
);

// ============================================================================
// Group 26: Business Hours & Duplicate Auto-Reply Suppression
// ============================================================================
console.log('\n--- Test Group 26: Business Hours & Duplicate Auto-Reply Suppression ---');

const businessHoursConfig = {
  enabled: true,
  timezone: 'UTC',
  schedule: {
    // Mon-Fri 09:00 - 18:00 (1=Mon, 5=Fri)
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '18:00' },
    5: { open: '09:00', close: '18:00' },
  },
  autoReplyMessage: 'Thank you for reaching out. We are currently closed.',
};

// 26.1 Check during open hours (Wednesday 14:00 UTC)
const wednesdayOpenTime = new Date('2026-11-11T14:00:00Z');
assert(
  BusinessHoursService.isWithinBusinessHours(wednesdayOpenTime, businessHoursConfig) === true,
  'BusinessHoursService confirms time is within open business hours'
);

// 26.2 Check during closed hours (Sunday 14:00 UTC)
const sundayClosedTime = new Date('2026-11-15T14:00:00Z');
assert(
  BusinessHoursService.isWithinBusinessHours(sundayClosedTime, businessHoursConfig) === false,
  'BusinessHoursService confirms Sunday is outside business hours'
);

// 26.3 Rate/cost safeguard: send auto-reply at most once per closed period per conversation
const testConvClosed = {
  id: 'conv_closed_01',
  lastAfterHoursReplyAt: '2026-11-15T10:00:00Z', // Already sent once this Sunday closed period
};

const shouldSend1 = BusinessHoursService.shouldSendAfterHoursAutoReply(
  testConvClosed,
  sundayClosedTime,
  businessHoursConfig
);
assert(
  shouldSend1 === false,
  'Auto-reply suppressed: already sent once during current closed period (preventing billable loops)'
);

// 26.4 Fresh conversation without prior after-hours reply -> permitted
const testConvFresh = {
  id: 'conv_closed_02',
  lastAfterHoursReplyAt: undefined,
};
const shouldSend2 = BusinessHoursService.shouldSendAfterHoursAutoReply(
  testConvFresh,
  sundayClosedTime,
  businessHoursConfig
);
assert(
  shouldSend2 === true,
  'First after-hours message in closed period triggers auto-reply'
);

// ============================================================================
// Group 27: Conversation Snooze & Auto-Reopen on Inbound Message
// ============================================================================
console.log('\n--- Test Group 27: Conversation Snooze & Auto-Reopen ---');

const futureSnooze = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const pastSnooze = new Date(Date.now() - 5 * 60 * 1000).toISOString();

// 27.1 Active snooze check
assert(
  SnoozeService.isSnoozed({ snoozedUntil: futureSnooze }) === true,
  'Conversation with future snoozedUntil is actively snoozed'
);
assert(
  SnoozeService.isSnoozed({ snoozedUntil: pastSnooze }) === false,
  'Conversation with past snoozedUntil is no longer snoozed (expired)'
);

// 27.2 Inbound message auto-reopens snoozed conversation
const snoozedConv = {
  id: 'conv_snoozed_01',
  status: 'pending',
  snoozedUntil: futureSnooze,
};

const reopenedConv = SnoozeService.handleInboundMessage(snoozedConv);
assert(
  reopenedConv.snoozedUntil === null && reopenedConv.status === 'open',
  'Inbound message automatically unsnoozes conversation and resets status to open'
);

// ============================================================================
// Group 28: Private Note @Mentions & Agent Notification Generation
// ============================================================================
console.log('\n--- Test Group 28: Private Note @Mentions & Agent Notifications ---');

const allOrgMembers = [
  { id: 'mem_sarah', fullName: 'Sarah Jenkins' },
  { id: 'mem_alex', fullName: 'Alex Rivera' },
];

const noteWithMention = 'Hey @Alex Rivera, please take a look at the contract SLA for this client.';
const extracted = MentionService.extractMentions(noteWithMention, allOrgMembers);

assert(
  extracted.length === 1 && extracted[0].id === 'mem_alex',
  '@mention successfully parsed and mapped to member Alex Rivera'
);

// 28.2 Notification object generation
const notification = MentionService.createMentionNotification({
  workspaceId: 'ws_prod_01',
  conversationId: 'conv_01',
  senderName: 'Sarah Jenkins',
  mentionedMember: extracted[0],
  noteContent: noteWithMention,
});

assert(
  notification.memberId === 'mem_alex' &&
  notification.title.includes('Sarah Jenkins') &&
  notification.isRead === false,
  'In-app mention notification created with recipient, author, and preview'
);

// ============================================================================
// Group 29: Workspace API Key Generation, Hashing at Rest & Verification
// ============================================================================
console.log('\n--- Test Group 29: Workspace API Key Hashing at Rest & Verification ---');

// 29.1 API Key generation: plaintext token starts with 'wp_live_', hash is 64 hex chars
const generatedKey = ApiKeyService.generateApiKey('ws_prod_01', 'Zapier Automation Key');
assert(
  generatedKey.secretKey.startsWith('wp_live_') &&
  generatedKey.secretKey.length >= 40 &&
  generatedKey.keyRecord.keyHash.length === 64 &&
  generatedKey.keyRecord.keyPrefix.startsWith('wp_live_') &&
  !('secretKey' in generatedKey.keyRecord),
  'API key generated with wp_live_ prefix, hashed at rest (SHA-256), plaintext never stored in DB record'
);

// 29.2 Verification of plaintext key against stored hash
const isKeyValid = ApiKeyService.verifyApiKey(generatedKey.secretKey, generatedKey.keyRecord.keyHash);
const isTamperedInvalid = ApiKeyService.verifyApiKey(generatedKey.secretKey + '_tampered', generatedKey.keyRecord.keyHash);
assert(
  isKeyValid === true && isTamperedInvalid === false,
  'Constant-time verification accurately accepts matching secret key and rejects tampered keys'
);

// 29.3 Bearer token authentication
const authSuccess = ApiKeyService.authenticateRequest(`Bearer ${generatedKey.secretKey}`, [generatedKey.keyRecord]);
const authFail = ApiKeyService.authenticateRequest('Bearer wp_live_invalidkey1234567890', [generatedKey.keyRecord]);
assert(
  authSuccess?.id === generatedKey.keyRecord.id && authFail === null,
  'API request bearer token properly resolved against stored workspace API keys'
);

// ============================================================================
// Group 30: Outbound Webhook Signing (HMAC-SHA256), Replay Tolerance & Retries
// ============================================================================
console.log('\n--- Test Group 30: Outbound Webhook Signing & Replay Protection ---');

const webhookSecret = 'whsec_test_secret_998877665544332211';
const outboundPayload = {
  event: 'message.received',
  workspaceId: 'ws_prod_01',
  timestamp: new Date().toISOString(),
  data: {
    messageId: 'wamid.HBgLTEST999',
    from: '+14155552671',
    body: 'Interested in enterprise pricing',
  },
};

const nowSec = Math.floor(Date.now() / 1000);
const signedWebhook = OutboundWebhookService.signPayload(outboundPayload, webhookSecret, nowSec);

// 30.1 Correct signature calculation
assert(
  typeof signedWebhook.signature === 'string' &&
  signedWebhook.signature.length === 64 &&
  signedWebhook.timestamp === nowSec,
  'Outbound webhook payload accurately signed with HMAC-SHA256 digest'
);

// 30.2 Signature verification with replay window check
const isSigValid = OutboundWebhookService.verifyOutboundSignature(
  outboundPayload,
  signedWebhook.signature,
  signedWebhook.timestamp,
  webhookSecret,
  300 // 5 min tolerance
);
assert(isSigValid === true, 'Outbound webhook signature validated successfully within tolerance window');

// 30.3 Replay attack prevention: old timestamp rejected
const staleTimestamp = nowSec - 600; // 10 minutes ago (> 5 min tolerance)
const staleSignature = OutboundWebhookService.signPayload(outboundPayload, webhookSecret, staleTimestamp).signature;
const isStaleRejected = OutboundWebhookService.verifyOutboundSignature(
  outboundPayload,
  staleSignature,
  staleTimestamp,
  webhookSecret,
  300
);
assert(isStaleRejected === false, 'Replayed webhook with timestamp older than tolerance window is strictly rejected');

// 30.4 Tampered payload detection
const tamperedOutboundPayload = { ...outboundPayload, data: { ...outboundPayload.data, body: 'Tampered content' } };
const isTamperedSigRejected = OutboundWebhookService.verifyOutboundSignature(
  tamperedOutboundPayload,
  signedWebhook.signature,
  signedWebhook.timestamp,
  webhookSecret,
  300
);
assert(isTamperedSigRejected === false, 'Webhook with tampered payload is rejected by HMAC signature verification');

// ============================================================================
// Group 31: Strict is_demo Flag Isolation & Safe Purging
// ============================================================================
console.log('\n--- Test Group 31: Strict is_demo Flag Isolation & Safe Purging ---');

const mixedConversations = [
  { id: 'real_conv_01', isDemo: false, contact: { name: 'Acme Corp Real Customer' } },
  { id: 'demo_conv_01', isDemo: true, contact: { name: 'Sample Marcus Vance' } },
  { id: 'demo_conv_02', isDemo: true, contact: { name: 'Sample Elena Rostova' } },
];

// 31.1 Production filter ensures sample chats never leak into production exports
const prodOnly = DemoIsolationService.filterProductionOnly(mixedConversations);
assert(
  prodOnly.length === 1 && prodOnly[0].id === 'real_conv_01',
  'filterProductionOnly cleanly isolates production records and strips all isDemo: true rows'
);

// 31.2 Clear Sample Data safely purges ONLY demo records without touching real customer data
const purgeResult = DemoIsolationService.purgeDemoData(mixedConversations);
assert(
  purgeResult.remaining.length === 1 &&
  purgeResult.remaining[0].id === 'real_conv_01' &&
  purgeResult.purgedCount === 2,
  'Clear Sample Data operation safely purges only isDemo: true records and completely preserves real data'
);

// ============================================================================
// Group 32: Realtime Agent Collision Detection & Claim-on-Reply Routing
// ============================================================================
console.log('\n--- Test Group 32: Collision Detection & Claim-on-Reply ---');

const activeViewers = [
  { memberId: 'mem_sarah', fullName: 'Sarah Jenkins', isTyping: true },
  { memberId: 'mem_alex', fullName: 'Alex Rivera', isTyping: false },
];

// 32.1 Collision check: Alex is viewing while Sarah is typing
const collisionForAlex = PresenceService.detectCollision(activeViewers, 'mem_alex');
assert(
  collisionForAlex.isCollision === true &&
  collisionForAlex.collidingMembers[0] === 'Sarah Jenkins' &&
  collisionForAlex.isAnyoneTyping === true,
  'Agent collision accurately detected when another teammate is viewing or typing in the same chat'
);

// 32.2 Claim-on-reply: when Alex sends a reply to an unassigned chat, it automatically assigns to Alex
const unassignedChat = {
  id: 'conv_open_01',
  assignedTo: undefined,
  assignedAgent: undefined,
};
const claimedChat = PresenceService.claimOnReply(unassignedChat, {
  id: 'mem_alex',
  fullName: 'Alex Rivera',
});
assert(
  claimedChat.assignedTo === 'mem_alex' &&
  claimedChat.assignedAgent?.fullName === 'Alex Rivera',
  'Claim-on-reply automatically assigns the conversation to the replying agent to prevent duplicate responses'
);

// ============================================================================
// Final Summary
// ============================================================================
console.log(`\n======================================================`);
console.log(`Test Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
if (passedTests === totalTests) {
  console.log(`Phase 3B Extensibility, Security & Collision Verification Completed Successfully! 🚀`);
} else {
  console.error(`❌ Some tests failed in Phase 3B verification.`);
  process.exitCode = 1;
}
console.log(`======================================================\n`);
