# INTERFACES.md

> Interface definitions - IPC commands and Cloud APIs

## Overview

**IPC**: Tauri commands (Rust ↔ TypeScript)
**Cloud API**: Lambda Function URLs
**Last Updated**: 2025-12-28

---

## IPC Commands (Tauri)

### Image Processing

#### compress_image

Compress image to WebP format.

```typescript
// Request
invoke('compress_image', {
  inputPath: string,   // Original image path
  outputPath: string,  // Target WebP path
})

// Response
interface CompressResult {
  success: boolean;
  outputPath: string;
  originalSize: number;   // bytes
  compressedSize: number; // bytes
  width: number;
  height: number;
}
```

#### get_image_hash

Calculate MD5 hash for deduplication.

```typescript
// Request
invoke('get_image_hash', {
  path: string,  // Image file path
})

// Response
string  // MD5 hash
```

#### delete_file

Delete local file.

```typescript
// Request
invoke('delete_file', {
  path: string,  // File path to delete
})

// Response
void
```

### Database

SQLite operations via `@tauri-apps/plugin-sql`.

```typescript
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:yorutsuke.db');

// Select
const rows = await db.select<T[]>(query, params);

// Execute
await db.execute(query, params);
```

### Logging

#### log_message

Write to log file.

```typescript
// Request
invoke('log_message', {
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context: object,
})

// Response
void
```

Log file: `/tmp/yorutsuke-frontend.log`

---

## Cloud APIs (Lambda)

### Base URLs

```typescript
const PRESIGN_URL = import.meta.env.VITE_LAMBDA_PRESIGN_URL;
const CONFIG_URL = import.meta.env.VITE_LAMBDA_CONFIG_URL;
const BATCH_URL = import.meta.env.VITE_LAMBDA_BATCH_SUBMIT_URL;
```

### Authentication

All authenticated endpoints require Cognito JWT token:

```typescript
headers: {
  'Authorization': `Bearer ${idToken}`,
  'Content-Type': 'application/json',
}
```

---

### POST /presign

Get S3 presigned URL for image upload.

**Request**:
```typescript
interface PresignRequest {
  userId: string;
  fileName: string;
  contentType: string;  // 'image/webp'
}
```

**Response**:
```typescript
interface PresignResponse {
  url: string;    // S3 presigned PUT URL
  key: string;    // S3 object key
  expiresIn: 300; // seconds
}
```

**Errors**:
| Code | Meaning |
|------|---------|
| 400 | Missing required fields |
| 403 | Quota exceeded |
| 500 | Internal error |

---

### POST /report

Get morning report for a date.

**Request**:
```typescript
interface ReportRequest {
  userId: string;
  date: string;  // 'YYYY-MM-DD'
}
```

**Response**:
```typescript
interface ReportResponse {
  date: string;
  summary: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    transactionCount: number;
    byCategory: Record<Category, number>;
  };
  transactions: Transaction[];
  generatedAt: string;  // ISO 8601
}
```

---

### POST /report/history

Get recent report history.

**Request**:
```typescript
interface HistoryRequest {
  userId: string;
  limit: number;  // default: 7
}
```

**Response**:
```typescript
interface HistoryResponse {
  reports: ReportResponse[];
}
```

---

### POST /transactions

Query transactions.

**Request**:
```typescript
interface TransactionsRequest {
  userId: string;
  startDate?: string;  // 'YYYY-MM-DD'
  endDate?: string;    // 'YYYY-MM-DD'
  status?: 'all' | 'confirmed' | 'unconfirmed';
  limit?: number;      // default: 100
  cursor?: string;     // pagination
}
```

**Response**:
```typescript
interface TransactionsResponse {
  transactions: Transaction[];
  nextCursor: string | null;
}
```

---

### PUT /transactions/{id}

Update transaction.

**Request**:
```typescript
interface UpdateRequest {
  amount?: number;
  category?: Category;
  description?: string;
  merchant?: string;
  date?: string;
  confirmedAt?: string;  // ISO 8601 to confirm
}
```

**Response**:
```typescript
interface UpdateResponse {
  transaction: Transaction;
}
```

---

### DELETE /transactions/{id}

Delete transaction.

**Response**:
```typescript
interface DeleteResponse {
  success: boolean;
}
```

---

### GET /config

Get app configuration.

**Response**:
```typescript
interface ConfigResponse {
  quotaLimit: number;        // 50
  uploadIntervalMs: number;  // 10000
  batchTime: string;         // '02:00'
  maintenanceMode: boolean;
  version: {
    minimum: string;
    latest: string;
  };
}
```

---

### POST /quota

Check user quota.

**Request**:
```typescript
interface QuotaRequest {
  userId: string;
}
```

**Response**:
```typescript
interface QuotaResponse {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;  // ISO 8601
}
```

---

## S3 Operations

### Upload Image

```typescript
// 1. Get presigned URL
const { url, key } = await getPresignedUrl(userId, fileName);

// 2. Upload directly to S3
await fetch(url, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/webp' },
  body: blob,
});

// 3. Store key in local DB
await saveImageS3Key(imageId, key);
```

### Download Image (if needed)

```typescript
// Get presigned GET URL
const { url } = await getPresignedDownloadUrl(s3Key);

// Fetch image
const response = await fetch(url);
const blob = await response.blob();
```

---

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  error: string;       // Error code
  message: string;     // Human-readable message
  details?: object;    // Additional info
}
```

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Invalid/expired token |
| `FORBIDDEN` | 403 | No permission |
| `QUOTA_EXCEEDED` | 403 | Daily limit reached |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `MAINTENANCE` | 503 | System under maintenance |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Validation (Pillar B)

All API responses must be validated at boundary:

```typescript
// Good: Validate response
const data = await response.json();
if (!data.url || !data.key) {
  throw new Error('Invalid presign response');
}

// Bad: Trust raw response
const { url, key } = await response.json();
```

---

## References

- Schema: `./SCHEMA.md`
- Architecture: `./ARCHITECTURE.md`
- Adapters: `app/src/02_modules/*/adapters/`
