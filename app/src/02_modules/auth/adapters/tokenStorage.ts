// Token Storage Adapter
// Pillar I: Adapter layer isolates storage from business logic

import { getSetting, setSetting } from '../../../00_kernel/storage';
import { UserId } from '../../../00_kernel/types';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import type { AuthTokens, User, UserTier } from '../types';
import { AUTH_STORAGE_KEYS } from '../types';

/**
 * Save all auth tokens to SQLite
 */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    setSetting(AUTH_STORAGE_KEYS.accessToken, tokens.accessToken),
    setSetting(AUTH_STORAGE_KEYS.refreshToken, tokens.refreshToken),
    setSetting(AUTH_STORAGE_KEYS.idToken, tokens.idToken),
  ]);
  logger.debug(EVENTS.TOKEN_SAVED, {});
}

/**
 * Load auth tokens from SQLite
 */
export async function loadTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken, idToken] = await Promise.all([
    getSetting(AUTH_STORAGE_KEYS.accessToken),
    getSetting(AUTH_STORAGE_KEYS.refreshToken),
    getSetting(AUTH_STORAGE_KEYS.idToken),
  ]);

  if (!accessToken || !refreshToken || !idToken) {
    return null;
  }

  return { accessToken, refreshToken, idToken };
}

/**
 * Get access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  return getSetting(AUTH_STORAGE_KEYS.accessToken);
}

/**
 * Get refresh token for token refresh
 */
export async function getRefreshToken(): Promise<string | null> {
  return getSetting(AUTH_STORAGE_KEYS.refreshToken);
}

/**
 * Save user info to SQLite
 */
export async function saveUser(user: User): Promise<void> {
  const userJson = JSON.stringify({
    id: String(user.id),
    email: user.email,
    tier: user.tier,
  });
  await setSetting(AUTH_STORAGE_KEYS.user, userJson);
  logger.debug(EVENTS.USER_SAVED, { userId: user.id });
}

/**
 * Load user info from SQLite
 */
export async function loadUser(): Promise<User | null> {
  const userJson = await getSetting(AUTH_STORAGE_KEYS.user);
  if (!userJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(userJson) as { id: string; email: string; tier: UserTier };
    return {
      id: UserId(parsed.id),
      email: parsed.email,
      tier: parsed.tier,
    };
  } catch (e) {
    logger.warn(EVENTS.API_PARSE_FAILED, { context: 'loadUser', error: String(e) });
    return null;
  }
}

/**
 * Clear all auth data (logout)
 */
export async function clearAuthData(): Promise<void> {
  await Promise.all([
    setSetting(AUTH_STORAGE_KEYS.accessToken, null),
    setSetting(AUTH_STORAGE_KEYS.refreshToken, null),
    setSetting(AUTH_STORAGE_KEYS.idToken, null),
    setSetting(AUTH_STORAGE_KEYS.user, null),
  ]);
  logger.info(EVENTS.AUTH_DATA_CLEARED, {});
}

// Re-export from kernel for backwards compatibility
// Device ID now uses machine-uid (stable across app reinstalls)
export { getDeviceId } from '../../../00_kernel/identity/deviceId';

/**
 * Get guest user ID for unauthenticated users
 * Format: "device-{machineId}" - stable across app reinstalls
 * Used when user hasn't logged in yet
 * @deprecated Use getDeviceId() directly - they return the same value
 */
export async function getGuestId(): Promise<string> {
  const { getDeviceId } = await import('../../../00_kernel/identity/deviceId');
  return getDeviceId();
}
