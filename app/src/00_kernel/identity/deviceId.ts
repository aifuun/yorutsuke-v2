// Device ID for guest user identification
// Uses OS-level machine ID via Rust IPC for stability across app reinstalls

import { invoke } from '@tauri-apps/api/core';
import { logger, EVENTS } from '../telemetry';
import type { UserId as UserIdType } from '../types';
import { UserId } from '../types';

// Cache the device ID to avoid repeated IPC calls
let cachedDeviceId: UserIdType | null = null;

/**
 * Get the unique Device ID for this machine
 * Used to identify guest users who haven't logged in
 *
 * Uses OS-level machine ID (via machine-uid crate):
 * - macOS: IOPlatformUUID
 * - Linux: /etc/machine-id
 * - Windows: MachineGuid from registry
 *
 * Benefits:
 * - Persists across app reinstalls
 * - Persists across database resets
 * - Stable until OS reinstall
 *
 * @returns Device ID as a branded UserId type
 */
export async function getDeviceId(): Promise<UserIdType> {
  // Return cached value if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // Get machine ID from Rust backend
    const machineId = await invoke<string>('get_machine_id');
    const deviceId = `device-${machineId}`;

    cachedDeviceId = UserId(deviceId);
    logger.info(EVENTS.DEVICE_ID_LOADED, { deviceId: deviceId.slice(0, 20) + '...' });

    return cachedDeviceId;
  } catch (error) {
    // Fallback: generate ephemeral ID (won't persist across restarts)
    logger.warn('device_id_ipc_failed', { error: String(error) });
    const ephemeralId = UserId(`ephemeral-${crypto.randomUUID()}`);
    cachedDeviceId = ephemeralId;
    return ephemeralId;
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
