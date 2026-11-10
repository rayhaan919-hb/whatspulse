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

console.log('🚀 Starting WhatsPulse CRM Phase 1A Automated Test Suite...\n');

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
// Final Summary
// ============================================================================
console.log(`\n======================================================`);
console.log(`Test Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
if (passedTests === totalTests) {
  console.log(`Phase 1A Webhook Verification Completed Successfully! 🚀`);
} else {
  console.error(`❌ Some tests failed in Phase 1A verification.`);
  process.exitCode = 1;
}
console.log(`======================================================\n`);
