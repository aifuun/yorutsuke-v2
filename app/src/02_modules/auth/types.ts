// Auth Module Types
// Pillar A: Branded Types for IDs
// Pillar D: FSM States

import type { UserId } from '../../00_kernel/types';

// User tier levels
export type UserTier = 'guest' | 'free' | 'basic' | 'pro';

// Auth state FSM (Pillar D)
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

// User entity
export interface User {
  id: UserId;
  email: string;
  tier: UserTier;
}

// Token set from Cognito
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

// Auth state for UI
export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

// API Response types
export interface RegisterResponse {
  success: boolean;
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  error?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  userId: string;
  email: string;
  tier: UserTier;
  deviceBound?: boolean;
  dataClaimed?: number;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
}

// Storage keys
export const AUTH_STORAGE_KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  idToken: 'auth_id_token',
  user: 'auth_user',
  deviceId: 'device_id',
} as const;
