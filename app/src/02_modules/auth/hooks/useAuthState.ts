/**
 * Auth State Hooks
 * Hook Bridge Layer (Layer 1.5) per ADR-020
 *
 * Issue #168: Updated to use external authStore (ADR-001)
 *
 * Three Identities:
 * 1. Connector: Bridge Vanilla Zustand → React (useStore)
 * 2. Selector: Extract primitives (ADR-012 compliance)
 * 3. Orchestrator: Coordinate services, UI-specific logic
 */

import { useStore } from 'zustand';
import { useMemo } from 'react';
import { authStore, authSelectors } from '../stores/authStore';
import { authStateService } from '../services/authStateService';
import type { User } from '../types';

// ============================================================================
// Identity 1 & 2: Connector + Selector (Primitive Returns)
// ============================================================================

/**
 * Get current auth status
 * @returns Auth status: 'idle' | 'loading' | 'authenticated' | 'error'
 */
export function useAuthStatus(): 'idle' | 'loading' | 'authenticated' | 'error' {
  return useStore(authStore, authSelectors.status);
}

/**
 * Get current user
 * @returns User object if authenticated, null otherwise
 */
export function useUser(): User | null {
  return useStore(authStore, authSelectors.user);
}

/**
 * Get auth error message
 * @returns Error message if status is 'error', null otherwise
 */
export function useAuthError(): string | null {
  return useStore(authStore, authSelectors.error);
}

/**
 * Check if user is authenticated
 * @returns True if authenticated, false otherwise
 */
export function useIsAuthenticated(): boolean {
  return useStore(authStore, authSelectors.isAuthenticated);
}

/**
 * Check if auth is loading
 * @returns True if loading, false otherwise
 */
export function useIsAuthLoading(): boolean {
  return useStore(authStore, authSelectors.isLoading);
}

// ============================================================================
// Identity 3: Orchestrator (Coordinates Services)
// ============================================================================

/**
 * Auth actions for UI components
 * Orchestrates auth services with user-provided context
 */
export interface AuthActions {
  /**
   * Register new user
   * @param email - User email
   * @param password - User password
   */
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Verify user email with code
   * @param email - User email
   * @param code - Verification code
   */
  verify: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Login user
   * @param email - User email
   * @param password - User password
   */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Logout user
   */
  logout: () => Promise<void>;

  /**
   * Refresh access token
   */
  refreshToken: () => Promise<void>;
}

/**
 * Hook for auth actions (Orchestrator identity)
 * Provides UI-triggered auth operations
 *
 * @returns Auth action functions
 */
export function useAuthActions(): AuthActions {
  return useMemo(() => ({
    register: (email: string, password: string) => authStateService.register(email, password),
    verify: (email: string, code: string) => authStateService.verify(email, code),
    login: (email: string, password: string) => authStateService.login(email, password),
    logout: () => authStateService.logout(),
    refreshToken: async () => { await authStateService.refreshToken(); },
  }), []);
}
