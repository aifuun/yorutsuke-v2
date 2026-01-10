# SCHEMA.md

> Data model - Local and Cloud storage

## Overview

- **Architecture**: Local-First + Cloud-Sync
- **Local**: SQLite (Tauri plugin-sql)
- **Cloud**: DynamoDB + S3
- **Last Updated**: 2026-01-05

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
│  │  {uuid}.webp    │         │  transactionId (SK) │                       │
│  │                 │         │  s3_key             │                       │
│  │  30-day TTL     │         │  ai_result          │                       │
│  └─────────────────┘         └─────────────────────┘                       │
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │    Cognito      │         │    DynamoDB         │                       │
│  │   User Pool     │────────▶│      users          │                       │
│  │                 │  userId │                     │                       │
│  │  Email/Password │         │  userId (PK)        │                       │
│  └─────────────────┘         │  tier               │                       │
│                              │  quota_used         │                       │
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
  compressed_path TEXT,             -- WebP output path
  s3_key TEXT,                      -- uploads/{userId}/{uuid}.webp

  -- Image metadata
  original_size INTEGER,            -- bytes (before compression)
  compressed_size INTEGER,          -- bytes (after compression)
  width INTEGER,                    -- pixels
  height INTEGER,                   -- pixels
  md5 TEXT,                         -- MD5 hash for duplicate detection

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  uploaded_at TEXT,                 -- ISO 8601 (when uploaded to S3)

  -- Observability (Pillar N, Q)
  trace_id TEXT,                    -- Request correlation (v2)
  intent_id TEXT,                   -- Idempotency key (v2)

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
  date TEXT NOT NULL,               -- 'YYYY-MM-DD' (invoice date)
  created_at TEXT NOT NULL,         -- ISO 8601 (processing time)
  updated_at TEXT NOT NULL,         -- ISO 8601 (last modification)
  confirmed_at TEXT,                -- ISO 8601 (null = unconfirmed)
  confidence REAL,                  -- 0.0-1.0 (AI confidence)
  raw_text TEXT,                    -- OCR result
  status TEXT DEFAULT 'unconfirmed',-- v6: 'unconfirmed'|'confirmed'|'deleted'
  version INTEGER DEFAULT 1,        -- v6: Optimistic locking
  dirty_sync INTEGER DEFAULT 0      -- v8: 1=needs cloud sync, 0=synced
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

### morning_reports / settings

See index for caching and user preferences.

---

## Cloud Tables (DynamoDB)

### transactions

```typescript
interface CloudTransaction {
  userId: string;           // PK - from Cognito
  transactionId: string;    // SK - UUID
  s3Key: string;            // S3 image path
  amount: number | null;
  merchant: string | null;
  category: string | null;
  receiptDate: string | null;
  aiConfidence: number | null;
  aiResult: object | null;  // Full AI response
  status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'skipped';
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}
```

### users

```typescript
interface CloudUser {
  userId: string;           // PK - from Cognito sub
  email: string;
  tier: 'free' | 'basic' | 'pro';
  quotaUsedToday: number;   // Images uploaded today
  quotaResetAt: string;     // ISO 8601 (JST midnight)
  createdAt: string;
  updatedAt: string;
}
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

## References

- [MODELS.md](./MODELS.md) - Record transformations (snake vs camel)
- [STORES.md](./STORES.md) - Runtime state with Zustand
- [STORAGE.md](./STORAGE.md) - Disk structure and retention
