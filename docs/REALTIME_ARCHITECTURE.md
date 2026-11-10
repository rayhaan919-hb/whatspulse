# Realtime Architecture Evaluation: postgres_changes vs. Supabase Broadcast

**Document:** `docs/REALTIME_ARCHITECTURE.md`  
**Phase:** 1C (Reliability, Architecture & Hardening)  
**Author:** WhatsPulse Core Engineering  
**Status:** Approved for Phased Rollout  

---

## 1. Executive Summary

WhatsPulse CRM relies on real-time event distribution to keep team inboxes synchronized across human agents, automated bots, and supervisor dashboards. 

Historically, prototypes have leveraged Supabase's `postgres_changes` listener. While simple to scaffold, architectural analysis proves that `postgres_changes` encounters severe scalability and performance bottlenecks under high-volume WhatsApp Cloud API throughput (80–250+ MPS). 

This document evaluates the transition from PostgreSQL logical decoding (`postgres_changes`) to **Supabase Realtime Broadcast with Channel Authorization Policies**, detailing the performance gains, security boundaries, and phased migration blueprint.

---

## 2. In-Depth Comparative Analysis

| Dimension | `postgres_changes` (CDC / Logical Replication) | Supabase Realtime `Broadcast` + Channel Auth |
| :--- | :--- | :--- |
| **Data Flow** | DB Write $\rightarrow$ WAL log $\rightarrow$ Logical Replication Slot $\rightarrow$ Realtime Server $\rightarrow$ Client | API Route / Webhook Receiver $\rightarrow$ Realtime Cluster $\rightarrow$ Client (Decoupled from WAL) |
| **PostgreSQL WAL Load** | **High**: Every inserted/updated message forces `wal2json`/`pgoutput` parsing and replication processing. | **Zero**: Dispatches bypass the Postgres logical replication slot completely. |
| **Database Connection Overhead** | Sustained replication slot overhead. Can exhaust max replication connections on smaller instances. | Client WebSockets connect directly to Supabase Realtime Elixir cluster. Zero persistent DB connections. |
| **Row-Level Security (RLS) Cost** | **Linear to Connections**: RLS policies are evaluated *per connected client* for every single row emitted. | **Constant O(1) Connection Time**: Evaluates channel join permissions *once* during WebSocket handshake/refresh. |
| **Payload Enrichment** | **Raw Row Only**: Only outputs fields of the single table row; requires client-side joins for contact data, tags, or media URLs. | **Enriched View Models**: Server emits fully assembled payloads (message + contact avatar + signed media URL + window countdown). |
| **Sub-50ms Latency SLA** | Subject to WAL write flushes and replication lag (typically 80–350ms). | Immediate dispatch from memory (typically 12–35ms globally). |

---

## 3. High-Volume Webhook Bottleneck Analysis

When an inbound broadcast campaign generates 2,000 inbound replies within 60 seconds:
1. **`postgres_changes` Pitfall:**
   - 2,000 writes generate 2,000 WAL entries.
   - If 15 agents are online across an agency workspace, the Supabase Realtime daemon executes $2,000 \times 15 = 30,000$ RLS evaluation checks against the database.
   - Result: High Postgres CPU utilization (80–100%), connection queue contention, and delayed UI rendering.
2. **Broadcast Solution:**
   - The webhook receiver persists the event asynchronously to Postgres and simultaneously emits a single `Broadcast` event to `workspace:{workspace_id}:inbox`.
   - The Realtime cluster fans out the message to all 15 authorized WebSocket sockets with **zero** database query overhead.

---

## 4. Channel Architecture & Security Specification

### 4.1 Topic Naming Convention
Channels are strictly partitioned per workspace to guarantee multi-tenant boundary isolation:
```
workspace:{workspace_id}:inbox
workspace:{workspace_id}:conversation:{conversation_id}
```

### 4.2 Events Emitted
- `message:new`: Dispatched when an inbound customer message or outbound agent message is created.
- `message:status`: Dispatched when delivery receipts (`sent`, `delivered`, `read`, `failed`) arrive.
- `conversation:update`: Dispatched when conversation priority, status (`open`, `resolved`), or assigned agent changes.
- `care_window:status`: Dispatched when the 24-hour customer service window status updates.

### 4.3 Channel Authorization Policies (Private Channels)
Authorization is enforced using Supabase Realtime Channel Authorization. Clients authenticate via their JWT; the WebSocket connection verifies that `auth.uid()` belongs to the workspace:

```sql
-- Ensure Realtime Channel Authorization validates workspace membership
CREATE POLICY "Allow workspace members to listen to workspace broadcast"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);
```

---

## 5. Phased Rollout Blueprint

### Phase 1 (Completed in Phase 1C):
- Maintain DB indexes on `conversations(workspace_id, last_message_at DESC)` and `messages(conversation_id, created_at ASC)` to ensure sub-5ms queries for initial inbox hydration.
- Abstract Realtime event structures in TypeScript to support both transport layers.

### Phase 2 (Phase 2 & Phase 3 Rollout):
- Implement server-side Broadcast emitter in `/api/webhooks/whatsapp` and `/api/messages/send`.
- Introduce `useWorkspaceBroadcast` hook in React frontend with fallback to REST polling if WebSocket disconnects.
- Enable Private Channel RLS policies.

### Phase 3 (Postgres Replication Slot Deprecation):
- Remove `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;` and `public.conversations;`.
- Completely eliminate WAL decoding overhead on the production PostgreSQL database.
