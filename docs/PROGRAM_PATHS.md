# Program Paths

> Detailed code flow traces for test scenarios.
> Use this to understand and debug the capture pipeline.

## Quick Reference

| Phase | Files | Key Functions |
|-------|-------|---------------|
| Drop | `tauriDragDrop.ts` | `setupTauriDragListeners`, `pathsToDroppedItems` |
| Queue | `useDragDrop.ts`, `CaptureView.tsx` | `onDrop`, `addImage` |
| Compress | `useCaptureLogic.ts`, `imageIpc.ts` | `processImage`, `compressImage` |
| Duplicate | `useCaptureLogic.ts`, `imageDb.ts` | `findImageByMd5` |
| Upload | `useUploadQueue.ts`, `uploadApi.ts` | `enqueue`, `processTask`, `uploadToS3` |
| Sync | `useCaptureLogic.ts`, `imageDb.ts` | `useEffect` sync, `updateImageStatus` |
| Restore | `useCaptureLogic.ts`, `imageDb.ts` | `loadUnfinishedImages`, `resetInterruptedUploads` |

---

## 1. Happy Path: Single Image Drop (SC-001)

```
User Action: Drop receipt.jpg
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 1: Drop Event
───────────────────
1. Tauri → tauri://drag-drop event
2. tauriDragDrop.ts:87 → listen('tauri://drag-drop')
3. tauriDragDrop.ts:30 → filterByExtension(paths, ALLOWED_EXTENSIONS)
4. tauriDragDrop.ts:53 → pathsToDroppedItems(accepted)
   ├─ Creates: imageId = ImageId(crypto.randomUUID())
   └─ Creates: traceId = createTraceId()
5. tauriDragDrop.ts:105 → listeners.onDrop(items, rejected)

Phase 2: Queue Addition
───────────────────────
6. useDragDrop.ts:71 → onDrop callback
7. useDragDrop.ts:82 → emit('image:pending', {...})
8. useDragDrop.ts:94 → onDropRef.current(items)
9. CaptureView.tsx:46 → onDrop callback
10. CaptureView.tsx:52 → intentId = createIntentId()
11. CaptureView.tsx:49 → addImage({id, intentId, traceId, status:'pending'})
12. useCaptureLogic.ts:214 → dispatch({ type: 'ADD_IMAGE' })
13. Reducer:42-46 → queue = [...queue, image]

Phase 3: Auto-Compression
─────────────────────────
14. useCaptureLogic.ts:292-320 → useEffect triggers
    └─ Guard: state.status === 'idle' ✓
15. useCaptureLogic.ts:304 → image = pendingImages[0]
16. useCaptureLogic.ts:315 → processImage(id, localPath, traceId, intentId)
17. useCaptureLogic.ts:218 → dispatch({ type: 'START_PROCESS' })
    └─ state.status → 'processing'
18. imageIpc.ts:81-92 → compressImage(inputPath, imageId)
    └─ Rust IPC: invoke('compress_image', {...})
19. Rust → WebP compression + MD5 calculation
20. useCaptureLogic.ts:230 → findImageByMd5(result.md5, traceId)
21. imageDb.ts:21 → SELECT id FROM images WHERE md5 = ?
    └─ Returns: null (no duplicate)
22. useCaptureLogic.ts:247 → saveImage(id, traceId, intentId, {...})
23. imageDb.ts:58 → INSERT INTO images (...)
24. useCaptureLogic.ts:260 → emit('image:compressed', {...})
25. useCaptureLogic.ts:270 → dispatch({ type: 'PROCESS_SUCCESS' })
    └─ state.status → 'idle', image.status → 'compressed'

Phase 4: Auto-Upload
────────────────────
26. useCaptureLogic.ts:325-349 → useEffect triggers
    └─ Finds compressed images not in upload queue
27. useCaptureLogic.ts:344 → uploadQueue.enqueue(id, path, intentId, traceId)
28. useUploadQueue.ts:312 → dispatch({ type: 'ENQUEUE' })
29. useCaptureLogic.ts:347 → dispatch({ type: 'START_UPLOAD' })
    └─ image.status → 'uploading'
30. useUploadQueue.ts:228-239 → useEffect triggers
    └─ Guard: isOnline && state.status === 'idle' ✓
31. useUploadQueue.ts:241 → processTask(task)
32. useUploadQueue.ts:249 → canUpload(uploadedToday, dailyLimit)
33. useUploadQueue.ts:257 → dispatch({ type: 'START_UPLOAD' })
    └─ queue.status → 'processing'
34. useUploadQueue.ts:261 → getPresignedUrl(userId, filename, intentId)
35. useUploadQueue.ts:264 → fetch(`file://${task.filePath}`)
36. useUploadQueue.ts:270 → uploadToS3(url, blob)
37. useUploadQueue.ts:274 → dispatch({ type: 'UPLOAD_SUCCESS' })
    └─ queue.status → 'idle', task.status → 'success'
38. useUploadQueue.ts:277 → emit('upload:complete', {...})

Phase 5: State Sync
───────────────────
39. useCaptureLogic.ts:354-375 → useEffect triggers
40. useCaptureLogic.ts:362 → dispatch({ type: 'UPLOAD_SUCCESS' })
    └─ image.status → 'uploaded'
41. useCaptureLogic.ts:365 → dbUpdateStatus(id, 'uploaded', traceId)
42. imageDb.ts:93 → UPDATE images SET status = 'uploaded'

Final State:
  - image.status = 'uploaded'
  - Database: status = 'uploaded', uploaded_at = now()
  - S3: {imageId}.webp uploaded
```

---

## 2. Multiple Images Drop (SC-002)

```
User Action: Drop A.jpg, B.jpg, C.jpg (3 files at once)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 1: Drop Event (Parallel ID Generation)
────────────────────────────────────────────
1. tauriDragDrop.ts:87 → event.payload.paths = [A.jpg, B.jpg, C.jpg]
2. tauriDragDrop.ts:53 → pathsToDroppedItems() creates 3 DroppedItems
   ├─ A: { id: 'img-aaa', traceId: 'trace-111', ... }
   ├─ B: { id: 'img-bbb', traceId: 'trace-222', ... }
   └─ C: { id: 'img-ccc', traceId: 'trace-333', ... }

Phase 2: Queue Addition (For Loop)
──────────────────────────────────
3. useDragDrop.ts:79-90 → for (const item of items)
   └─ emit('image:pending') × 3
4. CaptureView.tsx:48-64 → for (const item of items)
   ├─ A: intentId = 'intent-xxx', addImage(A)
   ├─ B: intentId = 'intent-yyy', addImage(B)
   └─ C: intentId = 'intent-zzz', addImage(C)
5. Queue state: [A:pending, B:pending, C:pending]

Phase 3: Sequential Processing (FSM Guards)
───────────────────────────────────────────
6. useEffect:292 → state.status === 'idle' ✓
   └─ pendingImages = [A, B, C]
7. Process A: image = pendingImages[0]
8. dispatch({ type: 'START_PROCESS' }) → state.status = 'processing'

9. useEffect:292 re-runs
   └─ state.status !== 'idle' → SKIP (B, C wait)

10. A completes → state.status = 'idle'
11. useEffect:292 re-runs
    └─ pendingImages = [B, C] → Process B

12. B completes → Process C
13. C completes → All done

Processing Order:
  A.jpg: compress → upload → ✓
  B.jpg: compress → upload → ✓  (waits for A)
  C.jpg: compress → upload → ✓  (waits for B)
```

---

## 3. Duplicate Detection (SC-020/021)

```
User Action: Drop A.jpg, then same file again
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

First Image: A.jpg
──────────────────
1. Drop → compress → MD5 = "abc123def456..."
2. findImageByMd5("abc123...") → null
3. saveImage() → INSERT (md5 = "abc123...")
4. Upload → status = 'uploaded'

Second Image: A.jpg (or B.jpg copy)
───────────────────────────────────
5. Drop → compress → MD5 = "abc123def456..." (same)
6. useCaptureLogic.ts:230 → findImageByMd5("abc123...")
7. imageDb.ts:21-32:
   SELECT id FROM images WHERE md5 = 'abc123...' LIMIT 1
   └─ Returns: 'img-aaa' (existing ID)

8. useCaptureLogic.ts:231-243:
   if (existingId) {
     emit('image:duplicate', {
       id: currentId,
       traceId,
       duplicateWith: existingId,
       reason: 'database',
     });
     dispatch({ type: 'DUPLICATE_DETECTED', id, duplicateWith });
     return;  // ← Skip save & upload
   }

9. Reducer:75-80:
   case 'DUPLICATE_DETECTED':
     return {
       status: 'idle',
       queue: state.queue.filter(img => img.id !== action.id),
     };
   └─ Duplicate removed from queue

Note: MD5 is calculated on WebP output, not original file.
      Detection happens AFTER compression, not at drop time.
```

---

## 4. Corrupted Image Error (SC-012) ❌ BUG #45

```
User Action: Drop fake.jpg (text file with .jpg extension)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Drop → filterByExtension() → ✓ (extension is .jpg)
2. Queue: [{id: 'img-fake', status: 'pending'}]
3. useEffect:292 → processImage() called
4. imageIpc.ts:85 → invoke('compress_image', {...})
5. Rust image crate → Error: "Failed to open image: unsupported format"
6. Error thrown back to TypeScript

7. useCaptureLogic.ts:279-282:
   catch (e) {
     dispatch({ type: 'FAILURE', id, error: String(e) });
   }

8. Reducer:99-104:
   case 'FAILURE':
     return {
       status: 'error',        // ← PROBLEM: FSM stuck in 'error'
       queue: updateImageStatus(state.queue, action.id, 'failed'),
       error: action.error,
     };

9. useEffect:292-294:
   if (state.status !== 'idle') return;  // ← Always skips now!

╔═══════════════════════════════════════════════════════════════════════════╗
║ BUG #45: FAILURE blocks all subsequent processing                         ║
║                                                                           ║
║ Once FSM enters 'error' state, it never returns to 'idle'.               ║
║ All pending images after the failed one will never be processed.          ║
║                                                                           ║
║ Fix: FAILURE should set status back to 'idle' after handling error.      ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 5. Network Disconnect During Upload (SC-320) ❌ BUG #47

```
User Action: Start upload, then disconnect network
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Timeline:
─────────
T0: processTask() starts, state.status = 'processing'
T1: uploadToS3() in progress...
T2: Network disconnects
T3: useNetworkStatus → isOnline = false

T4: useEffect:219-225 runs:
    if (!isOnline && state.status !== 'paused') {
      dispatch({ type: 'PAUSE', reason: 'offline' });
    }
    └─ state.status → 'paused'

T5: uploadToS3() fails with network error
T6: catch block runs:
    dispatch({ type: 'UPLOAD_FAILURE', id, error, errorType: 'network' });

T7: Reducer:76-90:
    case 'UPLOAD_FAILURE':
      return {
        status: 'idle',  // ← OVERWRITES 'paused'!
        tasks: updateTask(...),
      };

T8: Now state.status = 'idle', but isOnline = false
T9: useEffect:219-225 runs again → PAUSE again
T10: State oscillates...

╔═══════════════════════════════════════════════════════════════════════════╗
║ BUG #47: UPLOAD_FAILURE overwrites PAUSED state                           ║
║                                                                           ║
║ When upload fails due to network error while queue is PAUSED,             ║
║ the FAILURE action incorrectly sets status back to 'idle'.               ║
║                                                                           ║
║ Fix: Check current status in UPLOAD_FAILURE reducer.                      ║
║      If paused, keep it paused.                                          ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 6. Quota Persistence (SC-130/131) ❌ BUG #46

```
User Action: Upload 10 images, restart app, upload more
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Implementation:
───────────────────────
1. useUploadQueue.ts:248:
   const uploadedToday = state.tasks.filter(t => t.status === 'success').length;

2. state.tasks is useReducer memory state
3. App restart → useReducer reinitializes
   └─ state = { status: 'idle', tasks: [] }

4. uploadedToday = 0  // ← Wrong! Should be 10

╔═══════════════════════════════════════════════════════════════════════════╗
║ BUG #46: Quota not persisted across restart                               ║
║                                                                           ║
║ Quota count is calculated from in-memory task list.                       ║
║ Restarting app loses all history.                                        ║
║                                                                           ║
║ Missing Implementation:                                                   ║
║ - imageDb: countTodayUploads(userId, date)                               ║
║ - useQuota: Load from DB on mount                                        ║
║                                                                           ║
║ Fix Query:                                                                ║
║   SELECT COUNT(*) FROM images                                             ║
║   WHERE user_id = ? AND status = 'uploaded'                              ║
║   AND DATE(uploaded_at) = DATE('now', 'localtime')                       ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 7. Queue Restoration on Startup (SC-502/503)

```
App restart after crash with pending/uploading images
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

useCaptureLogic.ts:169-211 → useEffect (queue restoration)
──────────────────────────────────────────────────────────

1. Guard: userId && !restoredRef.current
   └─ Prevents double execution in StrictMode

2. resetInterruptedUploads(traceId):
   imageDb.ts:148-157:
     UPDATE images SET status = 'compressed'
     WHERE status = 'uploading'
   └─ Reset interrupted uploads to try again

3. loadUnfinishedImages():
   imageDb.ts:130-142:
     SELECT * FROM images
     WHERE status IN ('pending', 'compressed', 'uploading')
     ORDER BY created_at ASC
   └─ Get all unfinished work

4. rowToReceiptImage(row, userId):
   useCaptureLogic.ts:125-147:
     // Reset 'uploading' to 'compressed'
     const status = row.status === 'uploading' ? 'compressed' : row.status;
   └─ Map DB row to ReceiptImage

5. dispatch({ type: 'RESTORE_QUEUE', images })
   Reducer:48-56:
     return {
       ...state,
       queue: [
         ...state.queue,
         ...action.images.filter(img => !state.queue.some(q => q.id === img.id)),
       ],
     };
   └─ Merge without duplicates

6. Auto-processing useEffect triggers:
   - pending images → re-compress
   - compressed images → upload

⚠️ Warning: If original file was deleted, compression will fail.
   This is expected behavior - user must re-add the file.
```

---

## 8. Guest Login Data Migration (SC-201/203) ❌ BUG #48/#50

```
Guest with images → Register → Login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current State:
──────────────
1. imageDb.ts:saveImage() inserts:
   INSERT INTO images (id, trace_id, intent_id, ...)
   └─ ❌ No user_id column!

2. Guest uploads 10 images:
   └─ All saved without user_id association

3. User registers and logs in:
   └─ userId changes from 'guest-xxx' to 'user-yyy'

4. Problem:
   └─ How to associate old images with new account?

╔═══════════════════════════════════════════════════════════════════════════╗
║ BUG #48: images table missing user_id column                              ║
║                                                                           ║
║ Current schema doesn't track which user owns which image.                 ║
║ Cannot migrate guest data to registered account.                          ║
║                                                                           ║
║ Fix:                                                                      ║
║ 1. Add migration: ALTER TABLE images ADD COLUMN user_id TEXT             ║
║ 2. Update saveImage() to include user_id                                 ║
║ 3. Add updateImageUserId(id, newUserId) for migration                    ║
║ 4. On login: UPDATE images SET user_id = ? WHERE user_id = 'guest-xxx'  ║
╚═══════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════╗
║ Feature #50: Implement guest data claim on registration                   ║
║                                                                           ║
║ After login, migrate guest data:                                          ║
║   UPDATE images SET user_id = :newUserId                                 ║
║   WHERE user_id = :guestId                                               ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## ID Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ID Creation Points                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ imageId   : tauriDragDrop.ts:56   → ImageId(crypto.randomUUID())           │
│ traceId   : tauriDragDrop.ts:55   → createTraceId()                        │
│ intentId  : CaptureView.tsx:52    → createIntentId()                       │
│ md5       : Rust compress_image   → calculated from WebP output            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ID Purposes                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ imageId   : Entity identity, primary key in DB, S3 key prefix              │
│ traceId   : Log correlation across drop → compress → upload                │
│ intentId  : Idempotency key for retries (prevent duplicate uploads)        │
│ md5       : Content-based deduplication (same image = same hash)           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ID Persistence                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ imageId   : ✓ DB (id column)                                               │
│ traceId   : ✓ DB (trace_id column)                                         │
│ intentId  : ✓ DB (intent_id column)                                        │
│ md5       : ✓ DB (md5 column, used for duplicate detection)                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FSM State Transitions

```
useCaptureLogic FSM:
────────────────────
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
                    ▼                                                  │
┌────────┐    START_PROCESS    ┌────────────┐                         │
│  idle  │ ─────────────────▶ │ processing │                         │
└────────┘                     └────────────┘                         │
    ▲                               │                                 │
    │                               │                                 │
    │   PROCESS_SUCCESS             │ FAILURE                         │
    │   DUPLICATE_DETECTED          │                                 │
    │   UPLOAD_SUCCESS              ▼                                 │
    │                          ┌─────────┐                            │
    └────────────────────────  │  error  │ ── (no recovery path) ────┘
                               └─────────┘        ❌ BUG #45


useUploadQueue FSM:
───────────────────
                        ┌────────────────────────────────────┐
                        │                                    │
                        ▼                                    │
┌────────┐      START_UPLOAD      ┌────────────┐            │
│  idle  │ ────────────────────▶ │ processing │            │
└────────┘                        └────────────┘            │
    ▲  ▲                               │                    │
    │  │                               │                    │
    │  │  UPLOAD_SUCCESS               │                    │
    │  │  UPLOAD_FAILURE ───┐          │                    │
    │  └────────────────────┼──────────┘                    │
    │                       │                               │
    │                       │ ❌ Overwrites!                │
    │                       ▼                               │
    │  RESUME          ┌────────┐                          │
    └─────────────────│ paused │◀──── PAUSE (offline/quota)│
                       └────────┘                          │
                                     BUG #47 ──────────────┘
```

---

*Last updated: 2026-01-03*
