# Program Paths - SESSIONS & AUTH

> Logic for app lifecycle, data migration, and persistence.

## 1. Queue Restoration on Startup (SC-502/503)

1. `main.tsx` -> `captureService.init()`
2. `CaptureView.tsx` -> `useEffect` -> `captureService.setUser(id)`
3. `fileService.restoreQueue(userId)`
   - `resetInterruptedUploads()` -> UPDATE status='compressed' WHERE status='uploading'
   - `loadUnfinishedImages()` -> SELECT * FROM images WHERE status NOT IN ('uploaded')
   - Validate files: If WebP missing, mark as 'failed' (cleanup happened)
4. `captureStore.restoreQueue(images)`
5. `captureService.startProcessingPolling()` resumes any 'pending' tasks.

## 2. Quota Persistence (SC-130/131)

1. `main.tsx` -> `quotaService.init()`
2. `quotaService.setUser(id)`
3. `imageDb.getTodayUploadCount(userId)` -> Matches `uploaded_at` with local date
4. `quotaStore.setUsed(count)`
5. Limits are fetched from `quotaApi` (or mock).

## 3. Guest Login Data Migration (SC-201/203)

1. App starts in Guest mode -> `userId = 'guest-uuid'`
2. Images saved with guest ID.
3. User logs in -> `authService.onLogin(userId)`
4. `imageDb.migrateGuestData(guestId, newUserId)`
   - `UPDATE images SET user_id = :newUserId WHERE user_id = :guestId`
5. `captureService.setUser(newUserId)` triggers queue restore for new ID.
