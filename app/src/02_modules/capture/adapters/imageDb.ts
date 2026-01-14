// Image Database Adapter
// Pillar B: Airlock - validate data at boundary
// Pillar I: Adapter layer isolates SQLite from business logic

import { select, execute, type ImageRow } from '../../../00_kernel/storage';
import { ImageId, type ImageId as ImageIdType, type TraceId, type UserId } from '../../../00_kernel/types';
import { logger, EVENTS } from '../../../00_kernel/telemetry';

/**
 * Find image by MD5 hash
 * Used for duplicate detection after compression
 *
 * @returns ImageId of existing image or null if not found
 */
export async function findImageByMd5(
  md5: string,
  traceId: TraceId,
): Promise<ImageIdType | null> {
  logger.debug(EVENTS.QUOTA_CHECKED, { md5, traceId, phase: 'md5_lookup' });

  const rows = await select<Array<{ id: string }>>(
    'SELECT id FROM images WHERE md5 = ? LIMIT 1',
    [md5],
  );

  if (rows.length > 0) {
    logger.info(EVENTS.IMAGE_DUPLICATE, { md5, existingId: rows[0].id, traceId });
    return ImageId(rows[0].id);
  }

  logger.debug(EVENTS.QUOTA_CHECKED, { md5, traceId, phase: 'no_duplicate' });
  return null;
}

/**
 * Save pending image immediately when dropped
 * This ensures queue survives app restart
 */
export async function savePendingImage(
  id: ImageIdType,
  userId: UserId,
  traceId: TraceId,
  originalPath: string,
  originalName: string | null,
): Promise<void> {
  logger.debug(EVENTS.IMAGE_SAVED, { imageId: id, userId, traceId, status: 'pending', phase: 'start' });

  await execute(
    `INSERT INTO images (
      id, user_id, trace_id, intent_id, original_path, original_name, status
    ) VALUES (?, ?, ?, NULL, ?, ?, 'pending')`,
    [String(id), String(userId), String(traceId), originalPath, originalName],
  );

  logger.info(EVENTS.IMAGE_SAVED, { imageId: id, userId, traceId, status: 'pending' });
}

/**
 * Update image after compression completes
 * Row was created by savePendingImage(), now we update with compression results
 * Pillar N: traceId for observability
 */
export async function saveImage(
  id: ImageIdType,
  userId: UserId,
  traceId: TraceId,
  data: {
    originalPath: string;
    compressedPath: string | null;
    originalSize: number;
    compressedSize: number | null;
    width: number | null;
    height: number | null;
    md5: string | null;
    status: string;
    s3Key: string | null;
  },
): Promise<void> {
  logger.debug(EVENTS.IMAGE_SAVED, { imageId: id, userId, traceId, status: data.status, phase: 'start' });

  await execute(
    `UPDATE images SET
      compressed_path = ?,
      original_size = ?,
      compressed_size = ?,
      width = ?,
      height = ?,
      md5 = ?,
      status = ?,
      s3_key = ?
    WHERE id = ?`,
    [
      data.compressedPath,
      data.originalSize,
      data.compressedSize,
      data.width,
      data.height,
      data.md5,
      data.status,
      data.s3Key,
      String(id),
    ],
  );

  logger.info(EVENTS.IMAGE_SAVED, { imageId: id, userId, traceId });
}

/**
 * Update image status in database
 */
export async function updateImageStatus(
  id: ImageIdType,
  status: string,
  traceId: TraceId,
  extraFields?: Record<string, unknown>,
): Promise<void> {
  logger.debug(EVENTS.STATE_TRANSITION, { entity: 'Image', entityId: id, to: status, traceId });

  let sql = 'UPDATE images SET status = ?';
  const params: unknown[] = [status];

  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      sql += `, ${key} = ?`;
      params.push(value);
    }
  }

  sql += ' WHERE id = ?';
  params.push(String(id));

  await execute(sql, params);
  logger.info(EVENTS.STATE_TRANSITION, { entity: 'Image', entityId: id, to: status, traceId, phase: 'complete' });
}

/**
 * Get image by ID
 */
export async function getImageById(id: ImageIdType): Promise<ImageRow | null> {
  const rows = await select<ImageRow[]>(
    'SELECT * FROM images WHERE id = ?',
    [String(id)],
  );
  return rows[0] || null;
}

/**
 * Delete image record from database
 * Used when duplicate detected - no need to keep the record
 */
export async function deleteImageRecord(
  id: ImageIdType,
  traceId: TraceId,
): Promise<void> {
  logger.debug(EVENTS.IMAGE_CLEANUP, { imageId: id, traceId, phase: 'db_delete' });
  await execute('DELETE FROM images WHERE id = ?', [String(id)]);
  logger.info(EVENTS.IMAGE_CLEANUP, { imageId: id, traceId, phase: 'db_deleted' });
}

/**
 * Load unfinished images for queue restoration on app restart
 * Returns images that need to be re-processed or re-uploaded
 * Filtered by user_id for multi-user isolation (#48)
 *
 * Status handling:
 * - 'pending': Compression was interrupted, need to re-compress
 * - 'compressed': Ready to upload
 * - 'uploading': Upload was interrupted, reset to 'compressed' and re-upload
 */
export async function loadUnfinishedImages(userId: UserId): Promise<ImageRow[]> {
  logger.debug(EVENTS.QUEUE_RESTORED, { userId, phase: 'load_start' });

  const rows = await select<ImageRow[]>(
    `SELECT * FROM images
     WHERE user_id = ?
     AND status IN ('pending', 'compressed', 'uploading')
     ORDER BY created_at ASC`,
    [String(userId)],
  );

  logger.info(EVENTS.QUEUE_RESTORED, { userId, count: rows.length, phase: 'load_complete' });
  return rows;
}

/**
 * Reset interrupted upload status back to compressed
 * Called during queue restoration
 * Filtered by user_id for multi-user isolation (#48)
 */
export async function resetInterruptedUploads(userId: UserId, traceId: TraceId): Promise<void> {
  logger.debug(EVENTS.QUEUE_RESTORED, { userId, traceId, phase: 'reset_interrupted' });

  await execute(
    `UPDATE images SET status = 'compressed' WHERE user_id = ? AND status = 'uploading'`,
    [String(userId)],
  );

  logger.info(EVENTS.QUEUE_RESTORED, { userId, traceId, phase: 'reset_complete' });
}

/**
 * Count uploads within rolling 24-hour window for quota calculation
 * Uses relative time to avoid timezone complexity
 * Fixes #46: Quota persistence across restart
 */
export async function countTodayUploads(userId: UserId): Promise<number> {
  // Rolling 24-hour window - no timezone issues
  const rows = await select<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM images
     WHERE user_id = ?
     AND status = 'uploaded'
     AND uploaded_at >= datetime('now', '-24 hours')`,
    [String(userId)],
  );

  const count = rows[0]?.count ?? 0;
  logger.debug(EVENTS.QUOTA_CHECKED, { userId, count, phase: 'rolling_24h_count' });
  return count;
}

/**
 * Update user_id for all images belonging to a guest user
 * Used when guest data is claimed on registration (#50)
 *
 * @param oldUserId - Guest user ID (device-{machineId})
 * @param newUserId - New registered user ID
 * @returns Number of images updated
 */
export async function updateImagesUserId(
  oldUserId: UserId,
  newUserId: UserId,
): Promise<number> {
  logger.info(EVENTS.DATA_MIGRATED, { entity: 'images', oldUserId, newUserId, phase: 'start' });

  // Get count before update
  const countRows = await select<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM images WHERE user_id = ?',
    [String(oldUserId)],
  );
  const count = countRows[0]?.count ?? 0;

  if (count === 0) {
    logger.info(EVENTS.DATA_MIGRATED, { entity: 'images', oldUserId, count: 0, phase: 'skip' });
    return 0;
  }

  // Update all images
  await execute(
    'UPDATE images SET user_id = ? WHERE user_id = ?',
    [String(newUserId), String(oldUserId)],
  );

  logger.info(EVENTS.DATA_MIGRATED, { entity: 'images', oldUserId, newUserId, count, phase: 'complete' });
  return count;
}

/**
 * Reset today's quota by backdating uploaded_at to yesterday
 * DEBUG ONLY: Used for testing quota limits
 *
 * @returns Number of images reset
 */
export async function resetTodayQuota(userId: UserId): Promise<number> {
  logger.warn(EVENTS.QUOTA_CHECKED, { userId, phase: 'reset_quota_start' });

  // Get count of uploads in last 24 hours
  const countRows = await select<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM images
     WHERE user_id = ?
     AND status = 'uploaded'
     AND uploaded_at >= datetime('now', '-24 hours')`,
    [String(userId)],
  );
  const count = countRows[0]?.count ?? 0;

  if (count === 0) {
    logger.info(EVENTS.QUOTA_CHECKED, { userId, count: 0, phase: 'reset_quota_skip' });
    return 0;
  }

  // Backdate uploaded_at to 25 hours ago (outside 24h window)
  await execute(
    `UPDATE images
     SET uploaded_at = datetime(uploaded_at, '-25 hours')
     WHERE user_id = ?
     AND status = 'uploaded'
     AND uploaded_at >= datetime('now', '-24 hours')`,
    [String(userId)],
  );

  logger.warn(EVENTS.QUOTA_CHECKED, { userId, count, phase: 'reset_quota_complete' });
  return count;
}

/**
 * Update S3 key for an existing image record
 * Used by imageSyncService when syncing cloud transactions
 * Pillar I: Adapter layer isolates DB operations
 *
 * @param imageId - Image identifier
 * @param s3Key - S3 object key (e.g., "processed/device-xxx/123.jpg")
 */
export async function updateImageS3Key(
  imageId: ImageIdType,
  s3Key: string,
): Promise<void> {
  await execute(
    'UPDATE images SET s3_key = ? WHERE id = ?',
    [s3Key, String(imageId)],
  );
}

/**
 * Create image record for cloud-synced transaction
 * Used by imageSyncService when transaction has image but no local record
 * Pillar I: Adapter layer isolates DB operations
 *
 * @param params - Image record parameters
 */
export async function createImageRecord(params: {
  id: ImageIdType;
  userId: UserId;
  traceId: TraceId;
  s3Key: string;
  createdAt: string;
}): Promise<void> {
  await execute(
    `INSERT INTO images (
      id, user_id, trace_id, original_path, s3_key, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(params.id),
      String(params.userId),
      String(params.traceId),
      `cloud:${params.s3Key}`, // Virtual path for cloud-sourced images
      params.s3Key,
      'uploaded', // Mark as uploaded since it exists in S3
      params.createdAt,
    ],
  );
}
