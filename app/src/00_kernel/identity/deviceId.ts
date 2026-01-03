// Device ID for guest user identification
// Generated once on first launch, persisted in SQLite

import { getSetting, setSetting } from '../storage/db';
import { logger } from '../telemetry';
import type { UserId as UserIdType } from '../types';
import { UserId } from '../types';

const DEVICE_ID_KEY = 'device_id';

/**
 * Get or create a unique Device ID for this installation
 * Used to identify guest users who haven't logged in
 *
 * - Generated once on first launch
 * - Persisted in SQLite settings table
 * - Format: "device-{uuid}" to distinguish from account IDs
 *
 * @returns Device ID as a branded UserId type
 */
export async function getDeviceId(): Promise<UserIdType> {
  try {
    // Try to get existing device ID
    let deviceId = await getSetting(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate new UUID
      deviceId = `device-${crypto.randomUUID()}`;
      await setSetting(DEVICE_ID_KEY, deviceId);
      logger.info('[Identity] Generated new Device ID', { deviceId });
    } else {
      logger.debug('[Identity] Loaded existing Device ID', { deviceId });
    }

    return UserId(deviceId);
  } catch (error) {
    // Fallback: generate ephemeral ID (won't persist across restarts)
    logger.warn('[Identity] Failed to persist Device ID, using ephemeral', {
      error: String(error),
    });
    return UserId(`ephemeral-${crypto.randomUUID()}`);
  }
}

/**
 * Check if a user ID is a device ID (guest) or account ID
 */
export function isDeviceId(userId: UserIdType): boolean {
  return userId.startsWith('device-') || userId.startsWith('ephemeral-');
}

/**
 * Check if a user ID is ephemeral (non-persistent)
 */
export function isEphemeralId(userId: UserIdType): boolean {
  return userId.startsWith('ephemeral-');
}
