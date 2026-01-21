/**
 * Permit SQLite Adapter (Issue #154)
 *
 * Implements CRUD operations for permits in SQLite.
 * Acts as boundary layer between LocalQuota domain and storage layer.
 *
 * Patterns:
 * - Pillar B (Airlock): Convert SQLite rows to domain types
 * - Branded Types: No primitive strings used for IDs
 * - Error handling: Log failures, let caller handle recovery
 */

import { select, execute } from '../../00_kernel/storage/db';
import { logger } from '../../00_kernel/telemetry/logger';
import type { UserId } from '../../00_kernel/types';
import type { PermitRow } from '../../00_kernel/storage/types';
import type { UploadPermit } from './LocalQuota';

/**
 * Load permit for user from SQLite
 *
 * Returns null if:
 * - Permit not found for user
 * - Permit expired (caller should fetch new one)
 *
 * @throws Database error (should be caught by caller)
 */
export async function loadPermit(userId: UserId): Promise<UploadPermit | null> {
  try {
    const rows = await select<PermitRow[]>(
      'SELECT * FROM permits WHERE user_id = ? LIMIT 1',
      [String(userId)]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      userId: row.user_id,
      totalLimit: row.total_limit,
      dailyRate: row.daily_rate,
      expiresAt: row.expires_at,
      issuedAt: row.issued_at,
      signature: row.signature,
      tier: row.tier as 'guest' | 'free' | 'basic' | 'pro',
    };
  } catch (error) {
    logger.error('permit_load_failed', { userId: String(userId), error: String(error) });
    throw error;
  }
}

/**
 * Save permit to SQLite (upsert)
 *
 * Automatically replaces existing permit for user.
 * Resets created_at to current time on save.
 *
 * @throws Database error (should be caught by caller)
 */
export async function savePermit(permit: UploadPermit): Promise<void> {
  try {
    await execute(
      `INSERT OR REPLACE INTO permits
       (user_id, total_limit, daily_rate, expires_at, issued_at, signature, tier, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        permit.userId,
        permit.totalLimit,
        permit.dailyRate,
        permit.expiresAt,
        permit.issuedAt,
        permit.signature,
        permit.tier,
      ]
    );

    logger.info('permit_saved', {
      userId: permit.userId,
      tier: permit.tier,
      expiresAt: permit.expiresAt,
    });
  } catch (error) {
    logger.error('permit_save_failed', {
      userId: permit.userId,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Delete permit from SQLite
 *
 * Called when:
 * - User logs out
 * - Mock mode is switched
 * - Permit validation fails
 *
 * Safe to call even if permit doesn't exist (no-op).
 *
 * @throws Database error (should be caught by caller)
 */
export async function deletePermit(userId: UserId): Promise<void> {
  try {
    const result = await execute(
      'DELETE FROM permits WHERE user_id = ?',
      [String(userId)]
    );

    logger.info('permit_deleted', {
      userId: String(userId),
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    logger.error('permit_delete_failed', {
      userId: String(userId),
      error: String(error),
    });
    throw error;
  }
}

/**
 * Clean up expired permits (background maintenance task)
 *
 * Called periodically or on app startup.
 * Removes permits where expires_at <= now.
 *
 * Returns count of deleted rows.
 *
 * @throws Database error (should be caught by caller)
 */
export async function cleanupExpiredPermits(): Promise<number> {
  try {
    const result = await execute(
      'DELETE FROM permits WHERE expires_at <= datetime("now")',
      []
    );

    if (result.rowsAffected > 0) {
      logger.info('permits_cleanup_completed', { rowsAffected: result.rowsAffected });
    }

    return result.rowsAffected;
  } catch (error) {
    logger.error('permits_cleanup_failed', { error: String(error) });
    throw error;
  }
}
