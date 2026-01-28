/**
 * Auth Store Unit Tests
 * Tests for vanilla Zustand store
 *
 * Issue #168: Complete Auth Module 4-Layer Architecture
 * Test Strategy: Verify store initializes correctly and state transitions are valid
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { authStore, authSelectors } from './authStore';
import { UserId } from '../../../00_kernel/types';
import type { User } from '../types';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    authStore.setState({ status: 'loading', user: null, error: null });
  });

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      const state = authStore.getState();
      expect(state.status).toBe('loading');
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('FSM State Transitions', () => {
    it('should transition from loading to idle', () => {
      authStore.setState({ status: 'idle', user: null, error: null });
      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should transition from idle to loading', () => {
      authStore.setState({ status: 'idle', user: null, error: null });
      authStore.setState({ status: 'loading', user: null, error: null });
      const state = authStore.getState();
      expect(state.status).toBe('loading');
    });

    it('should transition from loading to authenticated with user', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'authenticated', user: mockUser, error: null });
      const state = authStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
    });

    it('should transition from loading to error with message', () => {
      authStore.setState({ status: 'error', user: null, error: 'Login failed' });
      const state = authStore.getState();
      expect(state.status).toBe('error');
      expect(state.user).toBeNull();
      expect(state.error).toBe('Login failed');
    });

    it('should transition from authenticated to idle on logout', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'authenticated', user: mockUser, error: null });
      authStore.setState({ status: 'idle', user: null, error: null });
      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
    });

    it('should allow error state with user (failed operation while authenticated)', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'error', user: mockUser, error: 'Token refresh failed' });
      const state = authStore.getState();
      expect(state.status).toBe('error');
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBe('Token refresh failed');
    });
  });

  describe('authSelectors', () => {
    it('status selector should return current status', () => {
      authStore.setState({ status: 'idle', user: null, error: null });
      const status = authSelectors.status(authStore.getState());
      expect(status).toBe('idle');
    });

    it('user selector should return current user', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'pro',
      };

      authStore.setState({ status: 'authenticated', user: mockUser, error: null });
      const user = authSelectors.user(authStore.getState());
      expect(user).toEqual(mockUser);
    });

    it('error selector should return error message', () => {
      authStore.setState({ status: 'error', user: null, error: 'Network error' });
      const error = authSelectors.error(authStore.getState());
      expect(error).toBe('Network error');
    });

    it('isAuthenticated selector should return true when authenticated', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'authenticated', user: mockUser, error: null });
      const isAuthenticated = authSelectors.isAuthenticated(authStore.getState());
      expect(isAuthenticated).toBe(true);
    });

    it('isAuthenticated selector should return false when not authenticated', () => {
      authStore.setState({ status: 'idle', user: null, error: null });
      const isAuthenticated = authSelectors.isAuthenticated(authStore.getState());
      expect(isAuthenticated).toBe(false);
    });

    it('isLoading selector should return true when loading', () => {
      authStore.setState({ status: 'loading', user: null, error: null });
      const isLoading = authSelectors.isLoading(authStore.getState());
      expect(isLoading).toBe(true);
    });

    it('isLoading selector should return false when not loading', () => {
      authStore.setState({ status: 'idle', user: null, error: null });
      const isLoading = authSelectors.isLoading(authStore.getState());
      expect(isLoading).toBe(false);
    });
  });

  describe('Selector Stability (ADR-012)', () => {
    it('selectors should return primitives, not objects', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'authenticated', user: mockUser, error: null });

      // All selectors return primitives (string, boolean, or null/User object)
      const status = authSelectors.status(authStore.getState());
      const user = authSelectors.user(authStore.getState());
      const error = authSelectors.error(authStore.getState());
      const isAuthenticated = authSelectors.isAuthenticated(authStore.getState());
      const isLoading = authSelectors.isLoading(authStore.getState());

      // Primitives
      expect(typeof status).toBe('string');
      expect(typeof isAuthenticated).toBe('boolean');
      expect(typeof isLoading).toBe('boolean');
      expect(error).toBeNull(); // null is primitive

      // User object is a reference, but it's the same reference from state
      expect(user).toBe(authStore.getState().user);
    });
  });

  describe('Store Subscription', () => {
    it('should notify subscribers on state change', () => {
      let callCount = 0;
      const unsubscribe = authStore.subscribe(() => {
        callCount++;
      });

      authStore.setState({ status: 'idle', user: null, error: null });
      expect(callCount).toBe(1);

      authStore.setState({ status: 'loading', user: null, error: null });
      expect(callCount).toBe(2);

      unsubscribe();

      authStore.setState({ status: 'idle', user: null, error: null });
      expect(callCount).toBe(2); // Should not increment after unsubscribe
    });
  });
});
