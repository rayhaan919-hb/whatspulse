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

console.log('🚀 Starting WhatsPulse CRM Phase 1C Automated Test Suite...\n');

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
let burstAllowed = true;
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
const mockOversizedFetch = async (url) => {
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
// Final Summary
// ============================================================================
console.log(`\n======================================================`);
console.log(`Test Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
if (passedTests === totalTests) {
  console.log(`Phase 1C Templates, Secrets & Media Verification Completed Successfully! 🚀`);
} else {
  console.error(`❌ Some tests failed in Phase 1C verification.`);
  process.exitCode = 1;
}
console.log(`======================================================\n`);
