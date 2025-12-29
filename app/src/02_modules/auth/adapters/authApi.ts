// Auth API Adapter
// Pillar B: Airlock - validate all API responses
// Pillar I: Adapter layer isolates Cognito API from business logic

import { logger } from '../../../00_kernel/telemetry';
import type {
  RegisterResponse,
  VerifyResponse,
  LoginResponse,
  RefreshResponse,
} from '../types';

// API endpoints from environment
const API_BASE = import.meta.env.VITE_AUTH_API_URL || '';

// Timeout for auth requests (10 seconds)
const AUTH_TIMEOUT_MS = 10_000;

/**
 * Wrap a promise with timeout protection
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Make an authenticated API request
 */
async function authFetch<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!API_BASE) {
    logger.warn('[AuthApi] API not configured');
    return { ok: false, error: 'Auth API not configured' };
  }

  try {
    const fetchPromise = fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const response = await withTimeout(
      fetchPromise,
      AUTH_TIMEOUT_MS,
      'Auth request timeout (10s)'
    );

    const data = await response.json();

    if (!response.ok) {
      const error = data.error || data.message || `Request failed: ${response.status}`;
      logger.warn('[AuthApi] Request failed', { endpoint, status: response.status, error });
      return { ok: false, error };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error('[AuthApi] Request error', { endpoint, error });
    return { ok: false, error };
  }
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string
): Promise<RegisterResponse> {
  logger.info('[AuthApi] Register', { email });

  const result = await authFetch<{ message?: string; error?: string }>('/register', {
    email,
    password,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * Verify email with confirmation code
 */
export async function verify(
  email: string,
  code: string
): Promise<VerifyResponse> {
  logger.info('[AuthApi] Verify', { email });

  const result = await authFetch<{ message?: string; error?: string }>('/verify', {
    email,
    code,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * Login with email and password
 * Includes device_id for device binding
 */
export async function login(
  email: string,
  password: string,
  deviceId: string
): Promise<{ ok: true; data: LoginResponse } | { ok: false; error: string }> {
  logger.info('[AuthApi] Login', { email, deviceId: deviceId.substring(0, 8) + '...' });

  const result = await authFetch<LoginResponse>('/login', {
    email,
    password,
    device_id: deviceId,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Pillar B: Validate response shape
  const data = result.data;
  if (
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.idToken !== 'string'
  ) {
    return { ok: false, error: 'Invalid login response' };
  }

  // Log device binding info
  if (data.deviceBound !== undefined) {
    logger.info('[AuthApi] Device binding', {
      bound: data.deviceBound,
      claimed: data.dataClaimed || 0,
    });
  }

  return { ok: true, data };
}

/**
 * Refresh access token
 */
export async function refreshToken(
  currentRefreshToken: string
): Promise<{ ok: true; data: RefreshResponse } | { ok: false; error: string }> {
  logger.debug('[AuthApi] Refresh token');

  const result = await authFetch<RefreshResponse>('/refresh', {
    refreshToken: currentRefreshToken,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Pillar B: Validate response shape
  const data = result.data;
  if (
    typeof data.accessToken !== 'string' ||
    typeof data.idToken !== 'string'
  ) {
    return { ok: false, error: 'Invalid refresh response' };
  }

  return { ok: true, data };
}
