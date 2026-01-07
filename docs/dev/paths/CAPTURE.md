# Program Paths - CAPTURE

> Detailed code flow traces for the capture pipeline.

## 1. Happy Path: Single Image Drop (SC-001)

```
User Action: Drop receipt.jpg
```

### Phase 1: Drop Event
`tauriDragDrop.ts`
1. `listen('tauri://drag-drop')`
2. `filterByExtension(paths)`
3. `pathsToDroppedItems(accepted)` -> Creates `imageId`, `traceId`

### Phase 2: Queue Addition
`captureService.ts` -> `handleDrop(items)`
1. Creates `intentId`
2. `imageDb.savePendingImage()` -> INSERT INTO images (status='pending')
3. `captureStore.addImage(image)`
4. `emit('image:pending')`

### Phase 3: Auto-Compression
`captureService.ts` -> `processPendingImages()` (via 1s polling)
1. Calls `fileService.processFile(id, ...)`
2. `imageIpc.compressImage()` -> WebP output
3. `imageDb.findImageByMd5()` -> Deduplication
4. `imageDb.saveImage()` -> Update to status='compressed'
5. `captureStore.processSuccess()`
6. `emit('image:compressed')`

### Phase 4: Auto-Upload
`captureService.ts` -> `enqueueCompressedImages()` (via store subscriber)
1. Calls `uploadService.enqueue(id, ...)`
2. Sets `image.status = 'uploading'` in `uploadStore`

### Phase 5: State Sync
`uploadService.ts` -> `processTask(task)`
1. `uploadApi.fetchPresignedUrl()`
2. `uploadApi.uploadToS3()`
3. `emit('upload:complete')`
4. `imageDb.updateImageStatus(id, 'uploaded')`

---

## 2. Multiple Images Drop (SC-002)

Processing is sequential thanks to FSM guards in `captureService`:
1. `Queue: [A, B, C]`
2. Poller triggers -> Process A (status = 'processing')
3. Poller triggers -> Skip (status !== 'idle')
4. A completes -> status = 'idle'
5. Poller triggers -> Process B...

---

## 3. Duplicate Detection (SC-020/021)

1. Drop Image B (contents identical to A)
2. `processFile` -> `compressImage` -> Calculate MD5
3. `findImageByMd5(md5)` -> Returns `imageId-A`
4. `deleteImageRecord(imageId-B)` -> Clean up pending record
5. `captureStore.duplicateDetected()` -> Remove from UI queue
6. `emit('image:duplicate')`

---

## 4. Corrupted Image Error (SC-012)

1. Drop `fake.jpg` (actually a text file)
2. `processFile` -> `compressImage` -> Rust returns error
3. `imageDb.updateImageStatus(id, 'failed', errorMsg)`
4. `captureStore.failure(id, errorMsg)`
5. Service remains `idle`, continues with next queue item.

---

## 5. Network Disconnect During Upload (SC-320)

1. `processTask()` starts -> `status = 'processing'`
2. Network goes offline -> `useNetworkStatus` triggers
3. `uploadStore.pause(reason='offline')`
4. Fetch/PUT fails -> `catch` block triggered
5. Reducer: If current status is `paused`, keep `paused`.
6. Task remains in `pending` state within `uploadStore` until `resume`.
