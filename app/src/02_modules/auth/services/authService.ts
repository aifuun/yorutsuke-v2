// Auth Service
// Pillar L: Pure TS functions, no React dependencies
// Wraps auth adapters to enforce 4-layer architecture

import type { User } from '../types';
import * as authApi from '../adapters';
import * as tokenStorage from '../adapters';

/**
 * Register a new user account
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  return authApi.register(email, password);
}

/**
 * Verify email with verification code
 */
export async function verifyUserEmail(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  return authApi.verify(email, code);
}

/**
 * Login user with email and password
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{
  ok: boolean;
  error?: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    userId: string;
    email: string;
    tier: 'guest' | 'free' | 'basic' | 'pro';
    deviceBound?: boolean;
    dataClaimed?: number;
  };
}> {
  const deviceId = await tokenStorage.getDeviceId();
  return authApi.login(email, password, deviceId);
}

/**
 * Logout user and clear stored tokens
 */
export async function logoutUser(): Promise<void> {
  // Clear all stored auth data (tokens + user)
  await tokenStorage.clearAuthData();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<{
  ok: boolean;
  error?: string;
  data?: {
    accessToken: string;
    refreshToken?: string;
    idToken: string;
  };
}> {
  const tokens = await tokenStorage.loadTokens();
  if (!tokens?.refreshToken) {
    return { ok: false, error: 'No refresh token available' };
  }
  return authApi.refreshToken(tokens.refreshToken);
}

/**
 * Load user session from storage
 */
export async function loadUserSession(): Promise<{
  tokens?: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
  };
  user?: User;
}> {
  const [tokens, user] = await Promise.all([
    tokenStorage.loadTokens(),
    tokenStorage.loadUser(),
  ]);
  return {
    tokens: tokens ?? undefined,
    user: user ?? undefined,
  };
}

/**
 * Save user tokens
 */
export async function saveUserTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}): Promise<void> {
  return tokenStorage.saveTokens(tokens);
}

/**
 * Save user profile
 */
export async function saveUserProfile(user: User): Promise<void> {
  return tokenStorage.saveUser(user);
}

/**
 * Get persistent guest device ID
 */
export async function getGuestDeviceId(): Promise<string> {
  return tokenStorage.getDeviceId();
}

/**
 * Get guest ID from storage
 */
export async function getStoredGuestId(): Promise<string> {
  return tokenStorage.getGuestId();
}

/**
 * Clear stored tokens
 */
export async function clearStoredTokens(): Promise<void> {
  return tokenStorage.clearAuthData();
}
