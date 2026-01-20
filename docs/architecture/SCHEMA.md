# SCHEMA.md

> Data model - Local and Cloud storage

## Overview

- **Architecture**: Local-First + Cloud-Sync
- **Local**: SQLite (Tauri plugin-sql) + localStorage (quota permits) + settings table
- **Cloud**: DynamoDB + S3 + AWS Secrets Manager (permit signing)
- **Observability**: TraceId for distributed tracing (frontend → Lambda → S3 → DynamoDB)
- **Last Updated**: 2026-01-20 (Remove multi-model comparison + add transaction date extraction)

## Quick Index

| Topic | Document | Description |
|-------|----------|-------------|
| **Tables & Fields** | [SCHEMA.md](./SCHEMA.md) | This file: DB tables and cloud types |
| **Data Mapping** | [MODELS.md](./MODELS.md) | Row vs Domain (storage vs business logic) |
| **Runtime State** | [STORES.md](./STORES.md) | Zustand stores and in-memory management |
| **Disk Usage** | [STORAGE.md](./STORAGE.md) | Local file structure and disk retention |

---

## ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL (SQLite)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │     images      │────────▶│  transactions       │                       │
│  │                 │  1:1    │                     │                       │
│  │  id (PK)        │         │  id (PK)            │                       │
│  │  user_id        │         │  user_id            │                       │
│  │  status (FSM)   │         │  image_id (FK)      │                       │
│  │  s3_key         │         │  type               │                       │
│  │  local_path     │         │  category           │                       │
│  └─────────────────┘         │  amount             │                       │
│                              │  confirmed_at       │                       │
│  ┌─────────────────┐         └─────────────────────┘                       │
│  │    settings     │                                                        │
│  │                 │         ┌─────────────────────┐                       │
│  │  key (PK)       │         │  morning_reports    │                       │
│  │  value          │         │                     │                       │
│  └─────────────────┘         │  date (PK)          │                       │
│                              │  data (JSON)        │                       │
│                              │  synced_at          │                       │
│                              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD (AWS)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │   S3 Bucket     │         │    DynamoDB         │                       │
│  │                 │────────▶│   transactions      │                       │
│  │  uploads/       │  s3_key │                     │                       │
│  │  {user}/{date}/ │         │  userId (PK)        │                       │
│  │  {uuid}.jpg     │         │  transactionId (SK) │                       │
│  │                 │         │  s3_key             │                       │
│  │  30-day TTL     │         │  ai_result          │                       │
│  └─────────────────┘         └─────────────────────┘                       │
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │    Cognito      │         │  Secrets Manager    │                       │
│  │   User Pool     │         │                     │                       │
│  │                 │         │  permit-secret-key  │  HMAC-SHA256 key      │
│  │  Email/Password │         │  (rotatable)        │  for permit signing   │
│  └─────────────────┘         └─────────────────────┘                       │
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │ issue-permit Λ  │         │   presign Lambda    │                       │
│  │                 │         │                     │                       │
│  │ Issues signed   │         │ Verifies permit     │  Permit v2 system:    │
│  │ upload permits  │         │ signature before    │  Client-side quota    │
│  └─────────────────┘         │ generating S3 URL   │  with signed permits  │
│                              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Local Tables (SQLite)

### images

Receipt images with status FSM. Schema version: v5.

```sql
CREATE TABLE images (
  -- Core fields
  id TEXT PRIMARY KEY,              -- ImageId (UUID)
  user_id TEXT,                     -- UserId (v3)
  status TEXT DEFAULT 'pending',    -- FSM state (see below)

  -- File paths
  original_path TEXT NOT NULL,      -- Source file path
  compressed_path TEXT,             -- JPEG output path
  s3_key TEXT,                      -- uploads/{userId}/{uuid}.jpg

  -- Image metadata
  original_size INTEGER,            -- bytes (before compression)
  compressed_size INTEGER,          -- bytes (after compression)
  width INTEGER,                    -- pixels
  height INTEGER,                   -- pixels
  md5 TEXT,                         -- MD5 hash for duplicate detection

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  uploaded_at TEXT,                 -- ISO 8601 (when uploaded to S3)

  -- Observability (Pillar N)
  trace_id TEXT,                    -- Distributed tracing ID (v2: trace-{uuid})
                                    -- Propagated: frontend → S3 metadata → Lambda recovery
                                    -- Used for: Log correlation, request tracking

  -- Error handling
  error TEXT,                       -- Error message for failed status (v4)

  -- Display
  original_name TEXT,               -- Original filename from drop/paste (v5)

  -- Reference counting (future use)
  ref_count INTEGER DEFAULT 1
);

-- Indexes
CREATE INDEX idx_images_status ON images(status);
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_md5 ON images(md5);
CREATE INDEX idx_images_trace_id ON images(trace_id);
CREATE INDEX idx_images_intent_id ON images(intent_id);
```

**Status FSM**:
```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
pending ──────► compressed ──────► uploading ──────► uploaded
    │               │                   │
    │               │                   │
    ▼               ▼                   ▼
  failed          skipped           (retry as compressed)
  (compression)   (duplicate)
```

### transactions

Transaction records (cached from cloud). Schema version: v8.

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,              -- TransactionId (UUID)
  user_id TEXT NOT NULL,            -- UserId
  image_id TEXT,                    -- ImageId (nullable, soft reference since v7)
  type TEXT NOT NULL,               -- 'income'|'expense'
  category TEXT NOT NULL,           -- 'purchase'|'sale'|'shipping'|'fee'|'other'
  amount INTEGER NOT NULL,          -- JPY (always positive)
  currency TEXT DEFAULT 'JPY',      -- Currency code
  description TEXT NOT NULL,
  merchant TEXT,
  merchant_source TEXT,             -- 'list_match'|'ocr_fallback'|'unknown'|'user_edited' (track source)
  date TEXT NOT NULL,               -- 'YYYY-MM-DD' (transaction date from receipt, extracted via Azure DI TransactionDate)
  created_at TEXT NOT NULL,         -- ISO 8601 (processing time)
  updated_at TEXT NOT NULL,         -- ISO 8601 (last modification)
  confirmed_at TEXT,                -- ISO 8601 (null = unconfirmed)
  confidence REAL,                  -- 0.0-1.0 (AI confidence) [DEPRECATED: use primary_confidence]
  raw_text TEXT,                    -- OCR result
  status TEXT DEFAULT 'unconfirmed',-- v6: 'unconfirmed'|'confirmed'|'deleted'
  version INTEGER DEFAULT 1,        -- v6: Optimistic locking
  dirty_sync INTEGER DEFAULT 0,     -- v8: 1=needs cloud sync, 0=synced
  s3_key TEXT,                      -- v9: S3 object key for image sync optimization
  primary_model_id TEXT,            -- v10: Single model identifier (e.g., 'us.amazon.nova-lite-v1:0', 'azure_di')
  primary_confidence REAL,          -- v10: 0-100 confidence score from primary model
  trace_id TEXT                     -- v10: Distributed tracing ID from image processing
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_image_id ON transactions(image_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

**Schema Changes**:
- v6: Added `status` (for cloud sync), `version` (optimistic locking)
- v7: Removed FK constraint on `image_id` (soft reference for cloud sync)
- v8: Added `dirty_sync` (track local changes needing cloud sync)
- v9: Added `s3_key` (S3 object key for efficient image sync)
- v10: Added `primary_model_id`, `primary_confidence` (single model metadata), `trace_id` (distributed tracing)
- v11: Added `merchant_source` (track merchant matching source); `date` now extracts from receipt TransactionDate via Azure DI

### settings

System settings and user preferences stored in SQLite.

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**Stored Settings**:

| Key | Values | Purpose | Persistence |
|-----|--------|---------|-------------|
| `schema_version` | `"0"` to `"10"` | Database schema version (for migrations) | Always retained |
| `mock_mode` | `"off"` \| `"online"` \| `"offline"` | Debug: Mock API mode selection | Persisted in prod DB only |
| `slow_upload` | `"true"` \| `"false"` | Debug: Simulate slow S3 upload (SC-503) | Persisted in prod DB only |
| `theme` | `"light"` \| `"dark"` | User preference (future use) | Persisted |
| `language` | `"en"` \| `"ja"` \| `"zh"` | UI language (future use) | Persisted |

**Important Notes**:
- Settings are ALWAYS stored in production database, NEVER in mock database
- This ensures `schema_version` and `mock_mode` can be read during app initialization
- Mock mode can be switched at runtime via Debug panel without app restart

---

### localStorage (Browser)

Client-side data stored in browser localStorage, NOT in SQLite.

**Storage Keys**:

| Key | Type | Purpose | Structure |
|-----|------|---------|-----------|
| `yorutsuke:quota` | `LocalQuotaData` | Permit v2 quota management | See below |

**LocalQuotaData Structure**:

```typescript
interface LocalQuotaData {
  permit: {
    userId: string;
    totalLimit: number;        // Total upload quota (e.g., 500 for guest)
    dailyRate: number;         // Daily rate limit (0 = unlimited for Pro)
    expiresAt: string;         // ISO 8601 (permit expiration)
    issuedAt: string;          // ISO 8601 (when issued)
    signature: string;         // HMAC-SHA256 hex signature (64 chars)
    tier: 'guest' | 'free' | 'basic' | 'pro';
  };
  totalUsed: number;           // Cumulative uploads (incremented on success)
  dailyUsage: {                // { "2026-01-18": 25, "2026-01-19": 12 }
    "YYYY-MM-DD": number;
  };
}
```

**Lifecycle**:
1. **Init**: App startup → `quotaService.setUser(userId)` → calls `fetchPermit()` if needed
2. **Issue**: `fetchPermit()` calls issue-permit Lambda → stores in localStorage
3. **Use**: `uploadService.processTask()` retrieves permit → includes in presign request
4. **Validate**: `presignLambda.validatePermit()` verifies HMAC-SHA256 signature
5. **Increment**: On upload success → `quotaService` increments `totalUsed` + daily counter
6. **Expire**: On permit expiration or daily reset → `quotaService.refreshPermit()` fetches new permit

---

### morning_reports (Settings Cache)

Morning report cache for performance optimization. See STORES.md for details.

## Cloud Tables (DynamoDB)

### transactions

```typescript
interface CloudTransaction {
  userId: string;           // PK - from Cognito
  transactionId: string;    // SK - UUID
  s3Key: string;            // S3 image path
  amount: number | null;
  merchant: string | null;
  merchantSource?: string;  // 'list_match' | 'ocr_fallback' | 'unknown' | 'user_edited' (track merchant matching source)
  category: string | null;
  date: string | null;      // Transaction date (YYYY-MM-DD) extracted from receipt via Azure DI TransactionDate field
  aiConfidence: number | null;  // Deprecated: use primaryConfidence
  aiResult: object | null;  // Full AI response
  status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'skipped' | 'unconfirmed' | 'confirmed' | 'deleted';
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  confirmedAt: string | null;  // ISO 8601 (null = unconfirmed)

  // Single model metadata (v9+: Track which model processed this transaction)
  primaryModelId?: string;     // e.g., 'us.amazon.nova-lite-v1:0', 'azure_di'
  primaryConfidence?: number;  // 0-100 confidence score (if available)

  // Distributed tracing (v10: End-to-end observability)
  traceId?: string;            // Frontend-generated trace-{uuid} for tracking request flow

  // Optimistic locking
  version: number;          // For concurrency control

  // Guest user TTL
  isGuest?: boolean;
  ttl?: number;             // Unix timestamp for DynamoDB TTL (guest users only)
}
```

**Important Notes**:
- **Multi-model comparison removed** (2026-01-20): Previously had `modelComparison`, `comparisonStatus`, `comparisonTimestamp` fields for A/B testing multiple OCR models. Now simplified to single model processing with `primaryModelId` tracking.
- **Transaction date extraction**: The `date` field now extracts actual receipt date from Azure DI's `TransactionDate` field (not processing date).
- **Merchant source tracking**: Added `merchantSource` to track whether merchant name came from list matching, OCR fallback, or user editing.

### Quota Management (Permit v2)

**Architecture**: Client-side quota tracking with signed permits.

```typescript
// Issued by issue-permit Lambda
interface UploadPermit {
  userId: string;
  totalLimit: number;       // Total upload quota (e.g., 500 for guest)
  dailyRate: number;        // Daily rate limit (0 = unlimited for Pro)
  expiresAt: string;        // ISO 8601 (permit expiration, e.g., 30 days)
  issuedAt: string;         // ISO 8601 (issuance time)
  signature: string;        // HMAC-SHA256 signature (prevents tampering)
  tier: 'guest' | 'free' | 'basic' | 'pro';
}

// Stored in localStorage
interface LocalQuotaData {
  permit: UploadPermit;
  totalUsed: number;
  dailyUsage: Record<string, number>;  // { "2026-01-18": 25 }
}
```

**Tier Configuration**:

| Tier | Total Limit | Daily Rate | Valid Days |
|------|-------------|------------|------------|
| guest | 500 | 30 | 30 |
| free | 1000 | 50 | 30 |
| basic | 3000 | 100 | 30 |
| pro | 10000 | 0 (unlimited) | 30 |

**Storage**: `localStorage['yorutsuke:quota']`

**Validation Flow**:
1. Frontend checks `LocalQuota.checkCanUpload()` (instant)
2. Frontend includes permit in presign request
3. presign Lambda verifies HMAC-SHA256 signature
4. If valid → generate S3 URL, else reject (403)

**Migration Note**: Legacy quota system (DynamoDB quotas table) removed in v2. Old clients without permits fall back to basic quota checking (backward compatibility during transition).

---

## Distributed Tracing (TraceId Implementation - ADR-019)

### Overview

TraceId is used for **observability and log correlation**, NOT for idempotency (removed IntentId in v2).

**Format**: `trace-{uuid}` (64 chars including prefix)

**Scope**: Single upload request from frontend → Lambda → S3 → DynamoDB

### TraceId Propagation Path

```
Frontend                           Cloud
────────────────────────────────────────

1. generateTraceId()
   └─ trace-abc-123...

2. uploadService.enqueue(imageId, filePath, traceId)
   └─ Stored in SQLite: images.trace_id

3. uploadApi.getPresignedUrl(userId, fileName, traceId, permit)
   │
   ├─ Request header: X-Trace-Id: trace-abc-123...
   └─ Request body: { traceId, ... }

4. presignLambda.handler(event)
   │
   ├─ Reads: headers['X-Trace-Id'] or body.traceId
   ├─ Stores: S3 Metadata x-amz-meta-trace-id
   └─ Returns: { url, traceId } in response

5. uploadToS3(presignedUrl, blob)
   │
   └─ S3 PUT headers: x-amz-meta-trace-id (auto-converted to metadata)

6. instantProcessor.handler(s3Event)
   │
   ├─ Reads: S3 object metadata x-amz-meta-trace-id
   ├─ Recovers: traceId = metadata['trace-id']
   ├─ All logs: { traceId, ... }
   └─ Transaction: { traceId, ... }

7. Transaction.sync() → DynamoDB
   └─ Stored: transactions.traceId
```

### Key Implementation Details

**Frontend (uploadApi.ts)**:
```typescript
// Line 31-32: Include traceId in presign request
const requestBody: Record<string, unknown> = {
  userId, fileName, contentType, traceId,  // ← traceId included
};

// Line 78: Propagate traceId in header
headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId }
```

**Lambda (presign/index.mjs)**:
```javascript
// Line 231-232: Extract from headers or body
const headerTraceId = headers['x-trace-id'] || headers['X-Trace-Id'];
const bodyTraceId = body.traceId;
const explicitTraceId = headerTraceId || bodyTraceId;

// Line 364-365: Store in S3 metadata
Metadata: {
  'trace-id': ctx.traceId,
  'user-id': userId,
}

// Line 371: URL expires in 30 minutes
const signedUrl = await getSignedUrl(s3, command, { expiresIn: 1800 });
```

**Lambda (instant-processor/index.mjs)**:
```javascript
// Line 68-92: Recover traceId from S3 metadata
async function recoverTraceIdFromS3(s3Key) {
  const response = await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
  return response.Metadata?.['trace-id'] || generateTraceId();
}

// Line 454-461: Store in transaction
const transaction = {
  // ... other fields
  traceId: ctx.traceId,
  primaryModelId: 'us.amazon.nova-lite-v1:0',
  primaryConfidence: parsed.confidence || 0.5,
};
```

**Database (migrations.ts)**:
```typescript
// v10: Add trace_id to transactions table
await safeAddColumn(db, 'transactions', 'trace_id', 'TEXT');
await safeCreateIndex(db, 'idx_transactions_trace_id', 'transactions', 'trace_id');
```

### Log Query Examples

**By TraceId**:
```bash
# Frontend logs
cat ~/.yorutsuke/logs/2026-01-19.jsonl | jq 'select(.traceId == "trace-xyz")'

# Lambda logs (CloudWatch)
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-presign-us-dev \
  --filter-pattern '"trace-xyz"' --profile dev

# Transaction data (DynamoDB)
aws dynamodb query \
  --table-name yorutsuke-transactions-dev \
  --key-condition-expression 'userId = :uid' \
  --filter-expression 'traceId = :tid' \
  --expression-attribute-values '{":uid":{"S":"device-123"},...}' \
  --profile dev
```

---

## Type Definitions & Enums

### Branded Types (Pillar A)

```typescript
type UserId = string & { __brand: 'UserId' };
type ImageId = string & { __brand: 'ImageId' };
type TransactionId = string & { __brand: 'TransactionId' };
type ReportId = string & { __brand: 'ReportId' };
```

### Enums

| Enum | Values |
|------|--------|
| **ImageStatus** | pending, compressed, uploading, uploaded, failed, skipped |
| **TransactionType** | income, expense |
| **Category** | purchase, sale, shipping, fee, packaging, other |

---

## Storage Layer Hierarchy

```
                          User Data

  ┌─────────────────────────────────────────────┐
  │          Browser localStorage                │  (Async, volatile)
  │  - permit (Permit v2, expires in 30 days)   │
  │  - quota counters (totalUsed, dailyUsage)   │
  └────────────────────────────────────────────┘
                          ↓

  ┌─────────────────────────────────────────────┐
  │     SQLite (Tauri plugin-sql)                │  (Persistent, local)
  │  - images (receipt files, status FSM)       │
  │  - transactions (cache from cloud)          │
  │  - transactions_cache (temp)                │
  │  - settings (config, mock mode)             │
  └────────────────────────────────────────────┘
                          ↓

  ┌─────────────────────────────────────────────┐
  │      AWS DynamoDB + S3                       │  (Cloud, authoritative)
  │  - transactions (canonical records)         │
  │  - images in S3 (30-day TTL)                │
  │  - Sync via Lambda (instant-processor)      │
  └────────────────────────────────────────────┘
```

**Data Flow Direction**:
- **Down** (Write): Frontend → SQLite → Cloud (via Lambda)
- **Up** (Read): Cloud → SQLite (sync) → Frontend
- **Lateral** (Quota): localStorage ↔ presignLambda ↔ issue-permit Lambda

---

## References

- [MODELS.md](./MODELS.md) - Record transformations (snake vs camel)
- [STORES.md](./STORES.md) - Runtime state with Zustand
- [STORAGE.md](./STORAGE.md) - Disk structure and retention
- [ADR-019](./ADR/019-traceid-only-distributed-tracing.md) - TraceId implementation and intentId deprecation
- [ADR-017](./ADR/017-permit-quota-system.md) - Permit v2 quota system architecture
