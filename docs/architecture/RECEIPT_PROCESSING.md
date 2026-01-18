# Receipt Processing Pipeline

> Complete flow from upload to parsing with dynamic model selection

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Receipt Upload → AI Parsing Flow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🖥️  FRONTEND (Tauri + React)          ☁️  BACKEND (AWS Lambda + Bedrock) │
│  ─────────────────────────────────      ────────────────────────────────  │
│  1. Capture                              4. Process (Model Selection)      │
│  2. Compress & Dedupe                    5. AI Parse                       │
│  3. Upload to S3                         6. Multi-Model Compare (Optional) │
│                                          7. Save to DynamoDB              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Frontend Flow

### 1️⃣ Capture & Compress

```
User drops receipt image
      ↓
captureService.handleDrop(file)
├─ Create ReceiptImage { id, traceId, userId, localPath }
├─ Save to SQLite (imageId, status='pending')
├─ Update captureStore → UI re-renders
│
└─ Start polling: processPendingImages() [1s intervals]
   │
   ├─ fileService.processFile(image)
   │  ├─ Tauri IPC: invoke('compress_image')
   │  │  Returns: { outputPath, md5, sizes }
   │  │
   │  ├─ Check duplicate: findImageByMd5(md5)
   │  │  ├─ If duplicate → status='skipped' ❌
   │  │  └─ If new → status='compressed' ✅
   │  │
   │  └─ Save to SQLite: md5, compressed_path, sizes
   │
   └─ Update captureStore { status='compressed', thumbnailPath }
```

**Files:**
- Frontend: `captureService.ts`, `fileService.ts`
- Store: `captureStore.ts`
- Adapter: `imageDb.ts`, `imageIpc.ts`

---

### 2️⃣ Auto-Enqueue for Upload

```
captureStore state change
      ↓
Auto-trigger: enqueueCompressedImages()
├─ Find all images with status='compressed'
├─ Skip already-queued
│
└─ For each new image:
   uploadService.enqueue(id, filePath, traceId)
   └─ uploadStore { status='idle' → ready for polling }
```

**Files:**
- `captureService.ts:256-283` (enqueueCompressedImages)
- `uploadService.ts:79` (enqueue function)

---

### 3️⃣ Upload to S3 with Rate Limiting

```
uploadService.startPolling() [1s intervals]
      ├─ Pre-conditions: online, quotaOK, noCurrentUpload
      │
      ├─ fetchQuota(userId) → AWS Lambda
      │  └─ Returns: { used, limit, remaining }
      │
      ├─ canUpload(used, limit, lastTime)
      │  ├─ Check quota: used >= limit → pause('quota')
      │  ├─ Check rate: within 2 seconds → wait
      │  └─ Else → allowed
      │
      └─ uploadService.processTask(id, filePath, traceId)
         ├─ uploadStore.startUpload() → status='uploading'
         │
         ├─ getPresignedUrl(userId, fileName, traceId)
         │  └─ AWS Lambda presign handler
         │     └─ Returns: { url, key, traceId }
         │
         ├─ Read file: readFile(filePath) [Tauri fs]
         │
         ├─ uploadToS3(presignedUrl, blob) [60s timeout]
         │
         ├─ On SUCCESS:
         │  ├─ fileService.updateStatus(id, 'uploaded') → SQLite
         │  ├─ uploadStore.uploadSuccess() → UI refresh
         │  └─ Emit 'upload:complete', 'data:refresh' events
         │
         └─ On FAILURE:
            ├─ Classify error: network/server/quota/unknown
            ├─ uploadStore.uploadFailure()
            └─ Schedule retry [1s, 2s, 4s backoff]
```

**Rate Limit Logic** (Domain: `receipt/index.ts`):
- Daily quota: 50 images/day (per user)
- Upload interval: 2 seconds minimum between uploads
- Backoff: exponential on network/server errors

**Files:**
- `uploadService.ts:90-238` (processQueue, processTask)
- `uploadStore.ts:107-200` (FSM states)
- `uploadApi.ts` (presign, S3 upload)
- `quotaApi.ts` (fetch quota)

---

## Part 2: Backend Flow (Lambda + Bedrock)

### 4️⃣ Model Selection & Configuration

```
S3 ObjectCreated event
      ↓
instant-processor Lambda handler
      ├─ Parse S3 event: extract bucket, key, userId
      │
      ├─ 🔑 LOAD CONFIG (DynamoDB CONTROL_TABLE)
      │  └─ GetItem { key: 'batch_config' }
      │     ├─ primaryModelId (default: 'us.amazon.nova-lite-v1:0')
      │     ├─ enableComparison (true/false)
      │     ├─ comparisonModels: ['textract', 'nova_mini', 'nova_pro', 'azure_di']
      │     ├─ azureConfig: { secretArn, endpoint }
      │     └─ mode: 'instant' | 'batch' | 'hybrid'
      │
      ├─ 🔐 RECOVER TRACE_ID (Pillar N)
      │  └─ S3 HeadObject → read metadata['trace-id']
      │
      └─ Check mode: if mode !== 'instant', STOP
         (Batch/hybrid handled by different Lambda)
```

**Configuration Schema:**
```typescript
interface BatchConfig {
  key: 'batch_config';
  primaryModelId: string;           // 'azure_di' | 'us.amazon.nova-lite-v1:0' | ...
  enableComparison: boolean;
  comparisonModels?: string[];      // Optional comparison models
  azureConfig?: {
    secretArn: string;
    endpoint: string;
  };
  mode: 'instant' | 'batch' | 'hybrid';
  batchTime?: string;
  timezone?: string;
}
```

**Files:**
- `instant-processor/index.mjs:186-263` (config loading & model selection)
- `shared/schemas.mjs` (BatchConfigSchema validation)

---

### 5️⃣ Primary Model Processing

```
◀──────────────────────────────────────────────────────────────▶
│  Branch A: Azure DI              Branch B: Bedrock (Nova)    │
├─────────────────────────────────────────────────────────────┤

If primaryModelId === 'azure_di':  Else (Bedrock):
  │                                  │
  ├─ Load Azure Credentials         ├─ modelId = primaryModelId
  │  from Secrets Manager           │  (e.g., 'us.amazon.nova-lite-v1:0')
  │                                  │
  ├─ analyzer.analyzeAzureDI(      ├─ Build OCR prompt:
  │   imageBase64,                 │  ├─ JSON schema instructions
  │   azureCredentials              │  ├─ Category list
  │ )                               │  ├─ Merchant list context
  │ Returns: ModelResult           │  └─ Language: Japanese + English
  │  ├─ amount                     │
  │  ├─ merchant                   ├─ bedrock.InvokeModelCommand({
  │  ├─ category                   │   modelId,
  │  ├─ date                        │   contentType: 'application/json',
  │  ├─ description                │   body: JSON.stringify(payload)
  │  ├─ confidence (0-100)         │ })
  │  └─ vendor: 'azure_di'         │ Returns: response.body text
  │                                 │
  └─ primaryModelId = 'azure_di'    ├─ Parse JSON response:
     primaryConfidence = 85          │  ├─ Parse JSON.parse(text)
                                    │  ├─ Strip markdown code blocks
                                    │  └─ Extract fields
                                    │
                                    └─ primaryModelId = modelId
                                       primaryConfidence = undefined
                                       (Nova doesn't return confidence)
```

**Model Details:**

| Model | Provider | Confidence | Cost | Speed |
|-------|----------|-----------|------|-------|
| **nova-lite** | AWS Bedrock | ❌ None | Base | Fast |
| **nova-mini** | AWS Bedrock | ❌ None | ~0.5x | Faster |
| **nova-pro** | AWS Bedrock | ❌ None | ~2x | Slower |
| **textract** | AWS Textract | ❌ None | ~1x | Medium |
| **azure_di** | Microsoft Azure | ✅ 0-100 | ~1x | Medium |

**Files:**
- `instant-processor/index.mjs:269-349` (primary model execution)
- `shared/model-analyzer.mjs` (MultiModelAnalyzer)
  - `analyzeAzureDI()` - Azure Document Intelligence
  - `analyzeBedrock()` - Bedrock Nova models
  - `convertModelResultToOcrResult()` - Format conversion

---

### 6️⃣ Validation (Airlock - Pillar B)

```
Primary model output
      ↓
Parse JSON response (strip markdown)
      ↓
OcrResultSchema.parse(json)
├─ amount: number
├─ type: 'income' | 'expense'
├─ date: YYYY-MM-DD
├─ merchant: string
├─ category: enum
├─ description: string
│
└─ On validation failure:
   ├─ Log AIRLOCK_BREACH event
   └─ Skip this record, continue next
```

**Files:**
- `shared/schemas.mjs` (OcrResultSchema)
- `instant-processor/index.mjs:341-349` (validation)

---

### 7️⃣ Multi-Model Comparison (Optional - Pillar R)

```
If enableComparison === true:
      ├─ Parallel execute enabled models:
      │  ├─ nova-lite
      │  ├─ nova-mini
      │  ├─ nova-pro
      │  └─ azure_di (if credentials available)
      │
      ├─ analyzer.analyzeReceipt({
      │   imageBase64,
      │   enabledModels,
      │   azureCredentials
      │ })
      │ Returns: ModelComparison {
      │   nova_mini: {...},
      │   nova_pro: {...},
      │   azure_di: {...},
      │   textract: {...}
      │ }
      │
      └─ Non-blocking: failures don't block primary result
         (continues with primary model result if comparison fails)
```

**Data Structure:**
```typescript
interface ModelComparison {
  [modelName: string]: {
    amount: number;
    merchant: string;
    category: string;
    date: string;
    confidence?: number;
    processingTime?: number;
    error?: string;
  }
}
```

**Files:**
- `instant-processor/index.mjs:351-373` (multi-model comparison)
- `shared/model-analyzer.mjs:analyzeReceipt()` (parallel execution)

---

### 8️⃣ Save to DynamoDB

```
Build Transaction object:
├─ From primary model result:
│  ├─ amount, merchant, category, date, description
│  └─ primaryModelId (e.g., 'azure_di')
│  └─ primaryConfidence (if Azure, else null)
│
├─ Metadata:
│  ├─ userId, imageId, transactionId
│  ├─ s3Key (moved from uploads/ → processed/)
│  ├─ status: 'unconfirmed' (user confirms later)
│  ├─ createdAt, updatedAt (ISO 8601 UTC)
│  └─ traceId (Pillar N: distributed tracing)
│
└─ Optional:
   └─ modelComparison (if enabled)

Put to DynamoDB:
├─ Table: TRANSACTIONS_TABLE_NAME
├─ Key: { userId, transactionId }
├─ TTL: 60 days (if guest user)
└─ Success: Transaction ready for sync

Move S3 image:
├─ CopyObject: uploads/{imageId} → processed/{imageId}
└─ (Optional: delete uploads/{imageId} after TTL)
```

**Transaction Record:**
```typescript
interface Transaction {
  userId: string;
  transactionId: string;
  imageId: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;           // YYYY-MM-DD
  merchant: string;
  category: string;
  description: string;
  status: 'unconfirmed' | 'confirmed' | 'deleted' | 'needs_review';

  // Model tracking
  primaryModelId: string;         // 'nova-lite', 'azure_di', etc.
  primaryConfidence?: number;     // 0-100 (if Azure)
  modelComparison?: ModelComparison;  // Optional

  // Metadata
  s3Key: string;                  // processed/{imageId}
  createdAt: string;              // ISO 8601 UTC
  updatedAt: string;
  confirmedAt?: string;
  traceId: string;                // Pillar N: log correlation
  version: number;
  ttl?: number;                   // Unix timestamp (guest only)
}
```

**Files:**
- `instant-processor/index.mjs:375-450` (transaction creation & DynamoDB put)
- `shared/schemas.mjs` (TransactionSchema)

---

## Part 3: Result Display

### 9️⃣ Fetch & Sync Results

```
User navigates to Transaction/Ledger View
      ↓
useTransactionLogic(userId) hook
├─ Listen to 'data:refresh' event (from upload complete)
│
├─ transactionService.loadTransactions(userId)
│  ├─ Priority 1: Local SQLite cache
│  ├─ Priority 2: Cloud Lambda (10s timeout)
│  │  └─ POST VITE_LAMBDA_SYNC_URL
│  │     Returns: { transactions: [...], cursor }
│  │     Validation: FetchTransactionsResponseSchema (Zod)
│  │
│  └─ Priority 3: Cache in SQLite for next load
│
└─ Transform: mapCloudToTransaction()
   └─ Add timestamps, process IDs
```

### 🔟 Display Transaction

```
React: TransactionView.tsx
├─ status === 'loading' → Show skeleton
├─ status === 'error' → Show error + retry
└─ status === 'idle' → Display table:
   ├─ Date
   ├─ Merchant (AI-extracted)
   ├─ Category (with icon)
   ├─ Amount (formatted)
   ├─ Status (unconfirmed/confirmed badge)
   └─ Confidence (if available, e.g., "92%" for Azure)
      └─ On hover: Show primaryModelId (e.g., "Processed by Azure DI")

User actions:
├─ Click row → Edit transaction
├─ Approve → status='confirmed' → Save to cloud
└─ Delete → status='deleted' → Sync on next uplink
```

**Files:**
- `TransactionView.tsx` (UI component)
- `useTransactionLogic.ts` (headless hook)
- `transactionService.ts` (orchestration)
- `transactionApi.ts` (cloud fetch)

---

## State Machines

### Image Lifecycle (Pillar D: FSM)

```
pending
  ↓ (compression starts)
compressing
  ├─ (MD5 duplicate found) → skipped ❌
  └─ (new image) → compressed ✅
      ↓ (auto-enqueue)
      uploading
        ├─ (success) → uploaded ✅
        │   └─ (Lambda processes) → transaction created
        └─ (failure) → retrying
            ├─ (backoff expires) → idle → uploading (retry)
            └─ (max retries exceeded) → failed ❌
```

### Upload Queue FSM

```
idle ──→ processing ──→ paused (offline/quota)
  ↑                          ↓
  └── resume ────────────────┘

Task Status (per item):
idle → uploading → (success: idle) | (retry: retrying) | (failed: failed)
```

---

## Configuration Management

### Reading Config (At Lambda Start)

```
Lambda cold start
      ↓
Load merchant list (cached in memory)
      ↓
For each S3 record:
  ├─ Recover traceId from S3 metadata
  ├─ DynamoDB GetItem { key: 'batch_config' }
  └─ Apply config:
     ├─ Select primaryModelId
     ├─ Check enableComparison
     └─ Load Azure credentials if needed
```

### Admin Configuration (Frontend)

```
Admin Panel → Processing Settings
├─ Primary Model dropdown:
│  ├─ nova-lite (default, fastest, no confidence)
│  ├─ nova-mini
│  ├─ nova-pro
│  └─ azure_di (includes confidence score)
│
├─ Enable Model Comparison (checkbox)
│  └─ If enabled: select which models to compare
│
├─ Processing Mode (radio):
│  ├─ Instant (1 image → full price)
│  ├─ Batch (100+ images → 50% off)
│  └─ Hybrid (mixed)
│
├─ Batch Settings:
│  ├─ Image Threshold (100-500, default 100)
│  └─ Timeout Minutes (30-480)
│
└─ Save → Update DynamoDB batch_config

Effects:
├─ Instant processing uses new model immediately
├─ Batch processing applies to next batch job
└─ Comparison results appear in transaction.modelComparison
```

**Files:**
- Admin Panel component (to be created)
- `admin-config-save` Lambda (to be created)
- Admin authorization (via Cognito)

---

## Timeout Values & Error Handling

| Operation | Timeout | Error Type | Retry? |
|-----------|---------|-----------|--------|
| Compression (Tauri) | 15s | timeout | Max 3x |
| Presign URL | 10s | network | Exponential backoff |
| S3 upload | 60s | network/server | Exponential backoff |
| Transaction fetch | 10s | network | Fallback to cache |
| Bedrock API | SDK default | varies | Non-blocking on comparison |
| Azure DI | 30s | network | Fail entire record |

**Backoff Strategy (Upload Retry):**
```
Delay 1: 1000ms
Delay 2: 2000ms
Delay 3: 4000ms
Max retries: 3

Error Classification:
- network/timeout → RETRY
- server (5xx) → RETRY
- quota (429, 403) → NO RETRY
- unknown → NO RETRY
```

---

## Distributed Tracing (Pillar N)

```
Frontend creates traceId:
├─ `createTraceId()` at image drop
└─ Store in Image record

Frontend → S3 Upload:
├─ Include in presigned URL metadata
└─ S3 stores as `x-amz-meta-trace-id`

S3 → Lambda:
├─ Lambda recovers: `recoverTraceIdFromS3()`
├─ Uses for all subsequent logs
└─ All database records include traceId

Logging:
├─ Local SQLite: images.trace_id, transactions.traceId
├─ CloudWatch: all Lambda logs include traceId
└─ Query by traceId: trace complete request chain
```

**Files:**
- `instant-processor/index.mjs:68-92` (trace recovery)
- `shared/logger.mjs` (include traceId in all events)

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [FLOWS.md](./FLOWS.md) | High-level system flows |
| [SCHEMA.md](./SCHEMA.md) | Database & API schemas |
| [LAYERS.md](./LAYERS.md) | System architecture layers |
| [ADR-014](./ADR/ADR-014-three-tier-lambda-deployment.md) | Three-tier Lambda deployment |
| [INTERFACES.md](./INTERFACES.md) | IPC commands & API endpoints |

---

**Last Updated:** 2026-01-18
**Version:** 1.0
**Status:** Complete flow with dynamic model selection
