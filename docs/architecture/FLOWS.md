# Data Flows

> System data flow diagrams

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Device                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Yorutsuke Desktop App                              │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  React (View)   │  UI Components only                               │  │
│  │  │  - Render UI    │  Subscribe to Zustand Store (state)               │  │
│  │  │  - User gestures│  Subscribe to EventBus (notifications)            │  │
│  │  └────────┬────────┘                                                   │  │
│  │           │ call                                                       │  │
│  │           ▼                                                            │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  Services       │  Business orchestration                           │  │
│  │  │  - captureService│ Init at app startup                              │  │
│  │  │  - uploadService │ Listen to Tauri events                           │  │
│  │  └────────┬────────┘                                                   │  │
│  │           │ call                                                       │  │
│  │           ▼                                                            │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  Adapters       │  External capability abstraction                  │  │
│  │  │  - tauriAdapter │  IPC wrapper                                      │  │
│  │  │  - awsAdapter   │  AWS API wrapper                                  │  │
│  │  └────────┬────────┘                                                   │  │
│  │           │                                                            │  │
│  │           ├──────────────────────────────┐                             │  │
│  │           ▼                              │                             │  │
│  │  ┌─────────────────┐                     │                             │  │
│  │  │  Tauri (Rust)   │                     │                             │  │
│  │  │  - Compression  │                     │ HTTPS                       │  │
│  │  │  - File I/O     │                     │                             │  │
│  │  │  - SQLite       │                     │                             │  │
│  │  └─────────────────┘                     │                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Cognito   │  │   Lambda    │  │     S3      │  │     DynamoDB        │ │
│  │   (Auth)    │  │  (Presign)  │  │  (Images)   │  │   (Transactions)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                  ▲                ▲              │
│                          │ 02:00 JST        │                │              │
│                          ▼                  │ Presigned PUT  │              │
│                   ┌─────────────┐           │ (from Tauri)   │              │
│                   │   Lambda    │───────────┴────────────────┘              │
│                   │   (Batch)   │                                            │
│                   │  + Bedrock  │                                            │
│                   │  Nova Lite  │                                            │
│                   └─────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Receipt Capture

User drops image → compress → dedupe → queue for upload.

```
React: User drops image
      │
      │ call captureService.handleDrop(file)
      ▼
┌─────────────────┐
│ Service:        │  Orchestration
│ - Generate IDs  │  imageId, traceId, intentId
│ - Check quota   │  from Zustand store
│ - Update store  │  captureStore.setState()
└─────────────────┘
      │
      │ call tauriAdapter.compress()
      ▼
┌─────────────────┐
│ Tauri: Compress │  WebP, < 100KB
│ + Calculate MD5 │
└─────────────────┘
      │
      │ return result to Service
      ▼
┌─────────────────┐
│ Service:        │
│ - Check MD5 dup │  via sqliteAdapter
│ - Save to DB    │  status = 'compressed'
│ - Update store  │  captureStore.setState()
└─────────────────┘
      │
      │ call awsAdapter.getPresignedUrl()
      ▼
┌─────────────────┐
│ Lambda: Presign │  Get S3 upload URL
└─────────────────┘
      │
      │ call tauriAdapter.streamUpload()
      ▼
┌─────────────────┐
│ Tauri → S3      │  Streaming PUT
│ emit progress   │
└─────────────────┘
      │
      │ Service listens, updates store
      ▼
┌─────────────────┐
│ Service:        │
│ - Update store  │  status = 'uploaded'
│ - Emit event    │  'upload:complete'
└─────────────────┘
      │
      │ React subscribes to store
      ▼
┌─────────────────┐
│ React: Display  │  Progress bar, status
└─────────────────┘
```

---

## Flow 2: Nightly Batch (02:00 JST)

Scheduled AI processing of uploaded receipts.

```
EventBridge trigger
      │
      ▼
┌─────────────────┐
│ Lambda: Batch   │
│ - Check limits  │  ¥1,000/day, 50/user
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Scan S3 bucket  │  Today's uploads
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Bedrock: OCR    │  Nova Lite Vision
│ ~¥0.015/image   │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ DynamoDB: Write │  transactions table
└─────────────────┘
```

> Note: Batch flow runs entirely in AWS, no client Service layer involved.

---

## Flow 3: Morning Report

App fetches AI-processed transactions for display.

```
React: App launch / Navigate to Report
      │
      │ call reportService.loadReport(date)
      ▼
┌─────────────────┐
│ Service:        │  Orchestration
│ - Check cache   │  from Zustand store
└─────────────────┘
      │ cache miss
      │ call sqliteAdapter.getCache()
      ▼
┌─────────────────┐
│ SQLite: Check   │  transactions_cache
└─────────────────┘
      │ DB miss
      │ call awsAdapter.fetchReport()
      ▼
┌─────────────────┐
│ Lambda → Dynamo │  Fetch transactions
└─────────────────┘
      │
      │ return to Service
      ▼
┌─────────────────┐
│ Service:        │
│ - Cache in DB   │  via sqliteAdapter
│ - Update store  │  reportStore.setState()
└─────────────────┘
      │
      │ React subscribes to store
      ▼
┌─────────────────┐
│ React: Render   │  ReportView
└─────────────────┘
```

---

## Flow 4: S3 Large File Upload (Detail)

```
1. React (Trigger):
   User clicks UploadButton → call uploadService.startUpload(file)

2. Service (Decide):
   - Check local task queue (from Zustand store)
   - Get Presigned URL via awsAdapter
   - Call tauriAdapter to start native upload

3. Tauri (Execute):
   Rust spawns tokio thread for streaming upload
   → emit("upload_progress") every second

4. Service (Listen & Update State):
   Service listens to upload_progress (registered at init)
   → Calculate global progress
   → uploadStore.setState({ progress: 50 })  ← Zustand

5. React (Display):
   useStore(uploadStore) automatically re-renders
   → User sees progress bar moving

6. Service (Complete):
   Upload finished
   → uploadStore.setState({ status: 'success' })  ← Zustand
   → eventBus.emit('upload:complete', { id })     ← EventBus
```

---

## Data Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Lifecycle                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Receipt Image:                                                             │
│    拖入 → 压缩 → 本地永久保存 → 上传S3 → AI处理 → 交易数据                    │
│                    │                      │                                 │
│                    ▼                      ▼                                 │
│              本地: 永久保留          S3: 30天后删除                           │
│                                                                             │
│  Transaction Data:                                                          │
│    AI生成 → DynamoDB → 同步本地SQLite → 用户确认                             │
│                              │                                              │
│                              ▼                                              │
│                        本地: 永久保留                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Strategy

### Image Retention

| Aspect | Local | Cloud (S3) |
|--------|-------|------------|
| Purpose | Offline viewing, verification | AI processing, backup |
| Retention | **Permanent** | Tier-based |
| Location | `$APPLOCALDATA/yorutsuke-v2/images/` | `s3://yorutsuke-images-{env}/` |
| Size | ~50-100KB/image | Same |

### S3 Retention by Tier

| Tier | Subscription | S3 Retention |
|------|--------------|--------------|
| Guest/Free | 未注册/未缴费 | **30 days** |
| Basic/Pro | 注册期内 | **Permanent** |

---

## Related

- [LAYERS.md](./LAYERS.md) - System structure
- [PATTERNS.md](./PATTERNS.md) - State patterns
- [SCHEMA.md](./SCHEMA.md) - Data model
- [README.md](./README.md) - Architecture index

---

*Extracted from ARCHITECTURE.md per #94*
