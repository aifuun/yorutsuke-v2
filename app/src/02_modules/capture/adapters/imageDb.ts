// Image Database Adapter
// Pillar B: Airlock - validate data at boundary
// Pillar I: Adapter layer isolates SQLite from business logic

import { select, execute, type ImageRow } from '../../../00_kernel/storage';
import { ImageId, type ImageId as ImageIdType, type TraceId, type IntentId } from '../../../00_kernel/types';
import { logger } from '../../../00_kernel/telemetry';

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
  logger.debug('[ImageDb] Finding image by MD5', { md5, traceId });

  const rows = await select<Array<{ id: string }>>(
    'SELECT id FROM images WHERE md5 = ? LIMIT 1',
    [md5],
  );

  if (rows.length > 0) {
    logger.info('[ImageDb] Duplicate found', { md5, existingId: rows[0].id, traceId });
    return ImageId(rows[0].id);
  }

  logger.debug('[ImageDb] No duplicate found', { md5, traceId });
  return null;
}

/**
 * Save image metadata to database
 * Pillar N: traceId for observability
 * Pillar Q: intentId for idempotency
 */
export async function saveImage(
  id: ImageIdType,
  traceId: TraceId,
  intentId: IntentId,
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
  logger.debug('[ImageDb] Saving image', { id, traceId, intentId, status: data.status });

  await execute(
    `INSERT INTO images (
      id, trace_id, intent_id, original_path, compressed_path, original_size, compressed_size,
      width, height, md5, status, s3_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(id),
      String(traceId),
      String(intentId),
      data.originalPath,
      data.compressedPath,
      data.originalSize,
      data.compressedSize,
      data.width,
      data.height,
      data.md5,
      data.status,
      data.s3Key,
    ],
  );

  logger.info('[ImageDb] Image saved', { id, traceId, intentId });
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
  logger.debug('[ImageDb] Updating image status', { id, status, traceId });

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
  logger.info('[ImageDb] Image status updated', { id, status, traceId });
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
 * Load unfinished images for queue restoration on app restart
 * Returns images that need to be re-processed or re-uploaded
 *
 * Status handling:
 * - 'pending': Compression was interrupted, need to re-compress
 * - 'compressed': Ready to upload
 * - 'uploading': Upload was interrupted, reset to 'compressed' and re-upload
 */
export async function loadUnfinishedImages(): Promise<ImageRow[]> {
  logger.info('[ImageDb] Loading unfinished images for queue restoration');

  const rows = await select<ImageRow[]>(
    `SELECT * FROM images
     WHERE status IN ('pending', 'compressed', 'uploading')
     ORDER BY created_at ASC`,
    [],
  );

  logger.info('[ImageDb] Found unfinished images', { count: rows.length });
  return rows;
}

/**
 * Reset interrupted upload status back to compressed
 * Called during queue restoration
 */
export async function resetInterruptedUploads(traceId: TraceId): Promise<void> {
  logger.info('[ImageDb] Resetting interrupted uploads', { traceId });

  await execute(
    `UPDATE images SET status = 'compressed' WHERE status = 'uploading'`,
    [],
  );

  logger.info('[ImageDb] Reset interrupted uploads complete', { traceId });
}
