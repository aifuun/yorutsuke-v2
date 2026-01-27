/**
 * Auth Store
 * Vanilla Zustand store for authentication state
 *
 * Pillar D: FSM with discriminated unions
 * Pillar J: Locality - state near usage
 * ADR-001: Service Pattern - services own vanilla stores
 */

import { createStore } from 'zustand/vanilla';
import type { User } from '../types';

// FSM State (Pillar D: Discriminated Union)
export type AuthState =
  | { status: 'idle'; user: null; error: null }
  | { status: 'loading'; user: User | null; error: null }
  | { status: 'authenticated'; user: User; error: null }
  | { status: 'error'; user: User | null; error: string };

/**
 * Vanilla Zustand store for auth state
 * Initialized with 'loading' to check for stored session
 */
export const authStore = createStore<AuthState>(() => ({
  status: 'loading',
  user: null,
  error: null,
}));

/**
 * Primitive selectors for Hook Bridge (ADR-012, ADR-020)
 * Each selector returns a primitive value to prevent infinite loops
 */
export const authSelectors = {
  /**
   * Get current auth status
   * @returns Auth FSM status
   */
  status: (state: AuthState): AuthState['status'] => state.status,

  /**
   * Get current user
   * @returns User object if authenticated, null otherwise
   */
  user: (state: AuthState): User | null => state.user,

  /**
   * Get auth error message
   * @returns Error string if status is 'error', null otherwise
   */
  error: (state: AuthState): string | null => state.error,

  /**
   * Check if user is authenticated
   * @returns True if status is 'authenticated'
   */
  isAuthenticated: (state: AuthState): boolean => state.status === 'authenticated',

  /**
   * Check if auth is loading
   * @returns True if status is 'loading'
   */
  isLoading: (state: AuthState): boolean => state.status === 'loading',
};
