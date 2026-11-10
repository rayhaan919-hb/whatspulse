# WhatsPulse CRM — External REST API & Outbound Webhooks Guide

WhatsPulse CRM exposes an enterprise-grade REST API and an outbound HMAC-signed webhook notification system for seamless integration with external CRMs (HubSpot, Salesforce, Zoho), custom backend microservices, and automation platforms (Make, Zapier, n8n).

The complete, interactive OpenAPI 3.1 specification is available at [docs/openapi.yaml](./openapi.yaml).

---

## 1. Authentication

All requests to the `/api/v1/` routes must be authenticated using a **Workspace API Key**.

### Generating an API Key
1. Go to **Settings > WABA & Integration**.
2. Scroll to **Workspace API Keys** and click **Generate API Key**.
3. Copy the plaintext key immediately (format: `wp_live_...`). Plaintext keys are never stored; WhatsPulse only stores a SHA-256 hash at rest.

### Using the API Key
Pass your API key in the `Authorization` header as a Bearer token:
```http
Authorization: Bearer wp_live_9f83a0e1c2d3e4f5...
```

---

## 2. Core API Endpoints

### 2.1 Send a WhatsApp Message
`POST /api/v1/messages`

Send an outbound message to a customer. Respects the 24-hour Customer Care Window automatically.

#### Request Body (Text):
```json
{
  "to": "+14155552671",
  "type": "text",
  "text": {
    "body": "Hello! Your invoice #1042 has been generated."
  }
}
```

#### Request Body (Pre-Approved Template outside 24h window):
```json
{
  "to": "+14155552671",
  "type": "template",
  "template": {
    "name": "order_status_update",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Marcus" },
          { "type": "text", "text": "ORD-9281" }
        ]
      }
    ]
  }
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "messageId": "msg_8923a1f9e2b0",
  "status": "sent",
  "recipient": "+14155552671",
  "timestamp": "2026-11-11T04:30:00.000Z"
}
```

---

### 2.2 List Workspace Contacts
`GET /api/v1/contacts`

Retrieve contacts associated with your workspace.

#### Query Parameters:
- `limit` (optional, default: `50`, max: `100`)
- `search` (optional, searches name, email, or phone number)

#### Response (200 OK):
```json
{
  "contacts": [
    {
      "id": "cnt_01",
      "phoneNumber": "+14155552671",
      "name": "Marcus Vance",
      "email": "marcus@vancetech.io",
      "optStatus": "opted_in",
      "tags": ["Enterprise", "VIP Client"]
    }
  ],
  "total": 1
}
```

---

### 2.3 List Conversations
`GET /api/v1/conversations`

#### Query Parameters:
- `status` (optional: `open`, `resolved`, `snoozed`)
- `limit` (optional, default: `50`)

#### Response (200 OK):
```json
{
  "conversations": [
    {
      "id": "conv_01",
      "contactId": "cnt_01",
      "status": "open",
      "unreadCount": 0,
      "lastMessagePreview": "Sounds great, will review shortly.",
      "lastInteractionAt": "2026-11-11T04:20:00.000Z",
      "careWindowRemainingMinutes": 1340
    }
  ]
}
```

---

## 3. Outbound Webhooks & Event Subscriptions

WhatsPulse can forward CRM events to your external webhooks in real time.

### Subscribable Events:
- `message.received`: Incoming customer WhatsApp message.
- `message.delivered`: Delivery receipt from Meta Cloud API.
- `message.read`: Read receipt from customer.
- `message.failed`: Delivery error (e.g. invalid phone number, window closed).
- `contact.created`: New contact created or first interaction received.
- `conversation.status_changed`: Status updated (open, resolved, snoozed).

---

### Webhook Signature & Replay Verification
Every outbound HTTP POST request contains the header:
```http
X-WhatsPulse-Signature-256: t=1731299400,v1=9a2b3c4d5e...
```

#### How to Verify the Signature (Node.js Example):
```javascript
import crypto from 'crypto';

function verifyWhatsPulseWebhook(rawBody, signatureHeader, secretKey) {
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const signature = parts.find(p => p.startsWith('v1='))?.slice(3);

  if (!timestamp || !signature) return false;

  // 1. Replay attack protection (reject payloads older than 5 minutes)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  // 2. Compute expected HMAC-SHA256 signature
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // 3. Constant-time equality check
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```
