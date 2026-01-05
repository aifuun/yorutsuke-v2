// Auth API Adapter
// Pillar B: Airlock - validate all API responses with Zod
// Pillar I: Adapter layer isolates Cognito API from business logic

import { z } from 'zod';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import type {
  RegisterResponse,
  VerifyResponse,
} from '../types';

// Zod schemas for auth response validation
const UserTierSchema = z.enum(['guest', 'free', 'basic', 'pro']);

const LoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  idToken: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  tier: UserTierSchema,
  deviceBound: z.boolean().optional(),
  dataClaimed: z.number().int().nonnegative().optional(),
});

const RefreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  idToken: z.string().min(1),
});

// Export types derived from schemas
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

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
    logger.warn(EVENTS.API_NOT_CONFIGURED, { context: 'authFetch' });
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
      logger.warn(EVENTS.API_REQUEST_FAILED, { endpoint, status: response.status, error });
      return { ok: false, error };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error(EVENTS.API_REQUEST_FAILED, { endpoint, error });
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
  logger.info(EVENTS.AUTH_REGISTER_STARTED, { email });

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
  logger.info(EVENTS.AUTH_VERIFY_STARTED, { email });

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
  logger.info(EVENTS.AUTH_LOGIN_STARTED, { email, deviceId: deviceId.substring(0, 8) + '...' });

  const result = await authFetch<unknown>('/login', {
    email,
    password,
    device_id: deviceId,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Pillar B: Validate response with Zod schema
  const parsed = LoginResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn(EVENTS.API_PARSE_FAILED, { context: 'login', error: parsed.error.message });
    return { ok: false, error: 'Invalid login response' };
  }

  // Log device binding info
  if (parsed.data.deviceBound !== undefined) {
    logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
      bound: parsed.data.deviceBound,
      claimed: parsed.data.dataClaimed || 0,
    });
  }

  return { ok: true, data: parsed.data };
}

/**
 * Refresh access token
 */
export async function refreshToken(
  currentRefreshToken: string
): Promise<{ ok: true; data: RefreshResponse } | { ok: false; error: string }> {
  logger.debug(EVENTS.AUTH_TOKEN_REFRESHED, { phase: 'start' });

  const result = await authFetch<unknown>('/refresh', {
    refreshToken: currentRefreshToken,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Pillar B: Validate response with Zod schema
  const parsed = RefreshResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn(EVENTS.API_PARSE_FAILED, { context: 'refresh', error: parsed.error.message });
    return { ok: false, error: 'Invalid refresh response' };
  }

  return { ok: true, data: parsed.data };
}
