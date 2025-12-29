// Token Storage Adapter
// Pillar I: Adapter layer isolates storage from business logic

import { getSetting, setSetting } from '../../../00_kernel/storage';
import { UserId } from '../../../00_kernel/types';
import { logger } from '../../../00_kernel/telemetry';
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
  logger.debug('[TokenStorage] Tokens saved');
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
  logger.debug('[TokenStorage] User saved', { userId: user.id });
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
    logger.warn('[TokenStorage] Failed to parse user JSON', { error: String(e) });
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
  logger.info('[TokenStorage] Auth data cleared');
}

/**
 * Get or create device ID for device binding
 */
export async function getDeviceId(): Promise<string> {
  let deviceId = await getSetting(AUTH_STORAGE_KEYS.deviceId);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await setSetting(AUTH_STORAGE_KEYS.deviceId, deviceId);
    logger.info('[TokenStorage] New device ID created', { deviceId });
  }

  return deviceId;
}
