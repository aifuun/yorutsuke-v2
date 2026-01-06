# Program Paths

> Code flow traces for test scenarios.
> Use this to understand and debug the capture pipeline.

## Architecture Note

> **MVP0 Complete: Service Pattern Implemented**
>
> The capture module has been migrated from React headless hooks to the **Service pattern**.
> This fixes #82 (StrictMode race condition causes duplicate listeners).
>
> | Old (headless/) | New (services/) | New (stores/) |
> |-----------------|-----------------|---------------|
> | `useDragDrop.ts` | `captureService.ts` | `captureStore.ts` |
> | `useCaptureLogic.ts` | `fileService.ts` | (uses captureStore) |
> | `useUploadQueue.ts` | `uploadService.ts` | `uploadStore.ts` |
>
> **Key Changes**:
> - Tauri event listeners in `captureService.init()` (called once in `main.tsx`)
> - State management in Zustand vanilla stores (outside React lifecycle)
> - React components use thin hooks (`useStore()`) for state access
> - React hooks bridge (`hooks/`) connects stores to React components
>
> **New Directory Structure**:
> ```
> app/src/02_modules/capture/
> ├── services/           # Business logic (no React)
> │   ├── captureService.ts  # Entry point, Tauri listeners
> │   ├── fileService.ts     # Compression, duplicate check
> │   └── uploadService.ts   # Upload queue, retry
> ├── stores/             # Zustand vanilla stores
> │   ├── captureStore.ts
> │   └── uploadStore.ts
> ├── hooks/              # React bridge
> │   ├── useCaptureState.ts
> │   ├── useUploadState.ts
> │   ├── useDragState.ts
> │   └── useCaptureActions.ts
> ├── headless/           # Legacy (useQuota still here)
> └── views/              # React components
> ```
>
> **Note**: The traces below may reference old hook names. The flow is the same,
> but entry points have moved from React hooks to Service methods.

---

## Quick Reference

| Phase | Module | Entry Point | Key Functions |
|-------|--------|-------------|---------------|
| Drop | `tauriDragDrop.ts` | `setupTauriDragListeners()` | `filterByExtension()`, `pathsToDroppedItems()` |
| Queue | `useDragDrop.ts` | `onDrop` callback | `emit('image:pending')` |
| Compress | `useCaptureLogic.ts` | compression `useEffect` | `processImage()`, `compressImage()` |
| Duplicate | `useCaptureLogic.ts` | inside `processImage()` | `findImageByMd5()` |
| Upload | `useUploadQueue.ts` | upload `useEffect` | `processTask()`, `uploadToS3()` |
| Sync | `useCaptureLogic.ts` | sync `useEffect` | `dbUpdateStatus()` |
| Restore | `useCaptureLogic.ts` | restore `useEffect` | `loadUnfinishedImages()`, `resetInterruptedUploads()` |

---

## 1. Happy Path: Single Image Drop (SC-001)

```
User Action: Drop receipt.jpg
```

### Phase 1: Drop Event

```
tauriDragDrop.ts
├── listen('tauri://drag-drop')
│   └── @trigger: Tauri native event
├── filterByExtension(paths, ALLOWED_EXTENSIONS)
│   └── Filter: jpg, jpeg, png, webp
└── pathsToDroppedItems(accepted)
    ├── Creates: imageId = ImageId(crypto.randomUUID())
    └── Creates: traceId = createTraceId()

Output: DroppedItem[] → calls onDrop callback
```

### Phase 2: Queue Addition

```
useDragDrop.ts → onDrop callback
├── emit('image:pending', { id, traceId })
└── calls onDropRef.current(items)

CaptureView.tsx → onDrop callback
├── Creates: intentId = createIntentId()
└── addImage({ id, intentId, traceId, status: 'pending' })

useCaptureLogic.ts → addImage()
└── dispatch({ type: 'ADD_IMAGE' })
    └── State: queue = [...queue, newImage]
```

### Phase 3: Auto-Compression

```
useCaptureLogic.ts → compression useEffect
├── @trigger: queue changes, status changes
├── Guard: state.status === 'idle' && pendingImages.length > 0
│
├── processImage(id, localPath, traceId, intentId)
│   ├── dispatch({ type: 'START_PROCESS' })
│   │   └── State: status = 'processing'
│   │
│   ├── imageIpc.compressImage(inputPath, imageId)
│   │   └── Rust IPC: invoke('compress_image')
│   │   └── Returns: { md5, compressedSize, outputPath }
│   │
│   ├── imageDb.findImageByMd5(md5)
│   │   └── SQL: SELECT id FROM images WHERE md5 = ?
│   │   └── Returns: existingId | null
│   │
│   ├── [if duplicate] → dispatch({ type: 'DUPLICATE_DETECTED' })
│   │   └── State: remove from queue, status = 'idle'
│   │   └── Event: emit('image:duplicate')
│   │   └── Return early
│   │
│   ├── imageDb.saveImage(...)
│   │   └── SQL: INSERT INTO images (...)
│   │
│   └── dispatch({ type: 'PROCESS_SUCCESS' })
│       └── State: image.status = 'compressed', status = 'idle'
│       └── Event: emit('image:compressed')
```

### Phase 4: Auto-Upload

```
useCaptureLogic.ts → upload trigger useEffect
├── @trigger: queue changes
├── Guard: has compressed images not in upload queue
└── uploadQueue.enqueue(id, path, intentId, traceId)
    └── dispatch({ type: 'START_UPLOAD' })
        └── State: image.status = 'uploading'

useUploadQueue.ts → upload useEffect
├── @trigger: tasks changes, isOnline changes
├── Guard: isOnline && state.status === 'idle' && hasPendingTasks
│
└── processTask(task)
    ├── canUpload(uploadedToday, dailyLimit)
    │   └── [if exceeded] → dispatch({ type: 'PAUSE', reason: 'quota' })
    │
    ├── dispatch({ type: 'START_UPLOAD' })
    │   └── State: queue.status = 'processing'
    │
    ├── uploadApi.getPresignedUrl(userId, filename, intentId)
    │   └── POST /presign → { url, key }
    │
    ├── fetch(`file://${task.filePath}`) → blob
    │
    ├── uploadApi.uploadToS3(url, blob)
    │   └── PUT to S3 presigned URL
    │
    └── dispatch({ type: 'UPLOAD_SUCCESS' })
        └── State: task.status = 'success', queue.status = 'idle'
        └── Event: emit('upload:complete', { id, s3Key })
```

### Phase 5: State Sync

```
useCaptureLogic.ts → sync useEffect
├── @trigger: uploadQueue.completedIds changes
├── @listen: upload:complete event
│
├── dispatch({ type: 'UPLOAD_SUCCESS', id })
│   └── State: image.status = 'uploaded'
│
└── imageDb.updateImageStatus(id, 'uploaded')
    └── SQL: UPDATE images SET status = 'uploaded', uploaded_at = ?
```

### Final State

```
image.status = 'uploaded'
Database: status = 'uploaded', uploaded_at = now()
S3: {userId}/{date}/{imageId}.webp uploaded
```

---

## 2. Multiple Images Drop (SC-002)

```
User Action: Drop A.jpg, B.jpg, C.jpg (3 files at once)
```

### Parallel ID Generation

```
tauriDragDrop.ts → pathsToDroppedItems()
├── A: { id: 'img-aaa', traceId: 'trace-111' }
├── B: { id: 'img-bbb', traceId: 'trace-222' }
└── C: { id: 'img-ccc', traceId: 'trace-333' }
```

### Sequential Processing (FSM Guards)

```
Queue state: [A:pending, B:pending, C:pending]

useEffect run #1:
├── Guard: status === 'idle' ✓
├── Process A → status = 'processing'
└── B, C wait

useEffect run #2:
├── Guard: status !== 'idle' ✗
└── Skip (A still processing)

A completes → status = 'idle'

useEffect run #3:
├── Guard: status === 'idle' ✓
└── Process B → status = 'processing'

... continues until C completes
```

### Processing Order

```
A.jpg: pending → compressed → uploading → uploaded ✓
B.jpg: pending → (wait) → compressed → uploading → uploaded ✓
C.jpg: pending → (wait) → (wait) → compressed → uploading → uploaded ✓
```

---

## 3. Duplicate Detection (SC-020/021)

```
User Action: Drop A.jpg, then same file again
```

### First Image

```
Drop → compress → MD5 = "abc123..."
findImageByMd5("abc123...") → null (not found)
saveImage() → INSERT
Upload → status = 'uploaded'
```

### Second Image (Duplicate)

```
Drop → compress → MD5 = "abc123..." (same hash)

useCaptureLogic.ts → processImage()
├── findImageByMd5("abc123...")
│   └── Returns: 'img-aaa' (existing ID)
│
├── [duplicate detected]
│   ├── emit('image:duplicate', { id, duplicateWith: existingId })
│   ├── dispatch({ type: 'DUPLICATE_DETECTED' })
│   └── return (skip save & upload)
│
└── Reducer: DUPLICATE_DETECTED
    └── queue = queue.filter(img => img.id !== duplicateId)
    └── status = 'idle'
```

**Note**: MD5 is calculated on WebP output, not original file. Detection happens AFTER compression.

---

## 4. Corrupted Image Error (SC-012)

```
User Action: Drop fake.jpg (text file with .jpg extension)
```

### Flow

```
filterByExtension() → ✓ (extension is .jpg)
Queue: [{ id: 'img-fake', status: 'pending' }]

useCaptureLogic.ts → processImage()
├── imageIpc.compressImage()
│   └── Rust: Error "Failed to open image: unsupported format"
│
└── catch (error)
    └── dispatch({ type: 'FAILURE', id, error })

Reducer: FAILURE
├── image.status = 'failed'
└── status = 'idle'           ← Returns to idle, continues processing
```

> **Fixed (#45)**: FAILURE reducer now resets status to 'idle' after marking the image as failed, allowing subsequent images to be processed.

---

## 5. Network Disconnect During Upload (SC-320)

```
User Action: Start upload, then disconnect network
```

### Timeline

```
T0: processTask() starts
    └── state.status = 'processing'

T1: uploadToS3() in progress...

T2: Network disconnects
    └── useNetworkStatus → isOnline = false

T3: Offline useEffect runs
    └── dispatch({ type: 'PAUSE', reason: 'offline' })
    └── state.status = 'paused'

T4: uploadToS3() fails with network error

T5: catch block runs
    └── dispatch({ type: 'UPLOAD_FAILURE' })

T6: Reducer: UPLOAD_FAILURE
    └── [if status === 'paused'] → keep 'paused'
    └── [else] → status = 'idle'

T7: Queue stays paused, resumes when online
```

> **Fixed (#47)**: UPLOAD_FAILURE reducer now checks current status before transitioning. If paused, it remains paused.

---

## 6. Quota Persistence (SC-130/131)

```
User Action: Upload 10 images, restart app, upload more
```

### Flow

```
useUploadQueue.ts → restore useEffect
├── @trigger: mount
├── imageDb.getTodayUploadCount(userId)
│   └── SQL: SELECT COUNT(*) FROM images
│            WHERE user_id = ? AND status = 'uploaded'
│            AND DATE(uploaded_at) = DATE('now', 'localtime')
└── dispatch({ type: 'SET_UPLOADED_TODAY', count })

useUploadQueue.ts → canUpload()
├── uploadedToday = state.uploadedToday  ← From DB, not in-memory tasks
└── return uploadedToday < dailyLimit
```

> **Fixed (#46)**: Quota is now loaded from database on startup, persisting across app restarts.

---

## 7. Queue Restoration on Startup (SC-502/503)

```
App restart after crash with pending/uploading images
```

### Flow

```
useCaptureLogic.ts → restore useEffect
├── @trigger: userId changes (once on mount)
├── Guard: userId && !restoredRef.current

├── imageDb.resetInterruptedUploads()
│   └── SQL: UPDATE images SET status = 'compressed'
│            WHERE status = 'uploading'

├── imageDb.loadUnfinishedImages()
│   └── SQL: SELECT * FROM images
│            WHERE status IN ('pending', 'compressed', 'uploading')
│            ORDER BY created_at ASC

├── Map rows to ReceiptImage
│   └── Reset 'uploading' → 'compressed'

└── dispatch({ type: 'RESTORE_QUEUE', images })
    └── Merge without duplicates

Auto-processing useEffects trigger:
├── pending images → re-compress
└── compressed images → upload
```

**Warning**: If original file was deleted, compression will fail. User must re-add the file.

---

## 8. Guest Login Data Migration (SC-201/203)

```
Guest with images → Register → Login
```

### Flow

```
imageDb.saveImage()
└── INSERT INTO images (id, user_id, trace_id, intent_id, ...)
    └── user_id = current userId (guest or authenticated)

Guest uploads 10 images:
└── All saved with user_id = 'guest-xxx'

User registers and logs in:
└── userId changes: 'guest-xxx' → 'user-yyy'

authService.onLogin()
├── imageDb.migrateGuestData(guestId, newUserId)
│   └── SQL: UPDATE images SET user_id = :newUserId
│            WHERE user_id = :guestId
└── All guest images now belong to authenticated user
```

> **Fixed (#48, #50)**: Images table now has user_id column. Guest data is migrated to authenticated user on login.

---

## ID Flow Summary

| ID | Created At | Purpose | Persisted |
|----|------------|---------|-----------|
| `imageId` | `tauriDragDrop.pathsToDroppedItems()` | Entity identity, PK, S3 key prefix | ✓ DB |
| `traceId` | `tauriDragDrop.pathsToDroppedItems()` | Log correlation across pipeline | ✓ DB |
| `intentId` | `CaptureView.onDrop()` | Idempotency key for retries | ✓ DB |
| `md5` | Rust `compress_image` | Content-based deduplication | ✓ DB |

---

## FSM State Diagrams

### useCaptureLogic FSM

```
                         PROCESS_SUCCESS
                         DUPLICATE_DETECTED
                         FAILURE (fixed #45)
                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
┌────────┐    START_PROCESS    ┌────────────┐│
│  idle  │ ─────────────────▶ │ processing ││
└────────┘                     └────────────┘│
    ▲                                        │
    │                                        │
    └────────────────────────────────────────┘
```

### useUploadQueue FSM

```
                         UPLOAD_SUCCESS
                         UPLOAD_FAILURE (fixed #47)
                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
┌────────┐    START_UPLOAD   ┌────────────┐  │
│  idle  │ ────────────────▶│ processing │──┘
└────────┘                   └────────────┘
    ▲  ▲                          │
    │  │                          │ (respects paused)
    │  │                          ▼
    │  │  RESUME            ┌──────────┐
    │  └────────────────────│  paused  │
    │                       └──────────┘
    │                             ▲
    └─────────────────────────────┘
              PAUSE (offline/quota)
```

---

## Fixed Issues

| Issue | Scenario | Problem | Fix |
|-------|----------|---------|-----|
| #45 | SC-012 | FSM stuck in 'error' state | FAILURE resets to 'idle' |
| #46 | SC-130/131 | Quota not persisted | Load from DB on startup |
| #47 | SC-320 | FAILURE overwrites PAUSED | Check status before transition |
| #48 | SC-203 | images missing user_id | Added user_id column |
| #50 | SC-201/202 | Guest data migration | Migrate on login |

---

*Last updated: 2026-01-05*
