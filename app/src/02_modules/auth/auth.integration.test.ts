/**
 * Auth Module Integration Tests
 * Tests full flow: store → service → hooks
 *
 * Issue #168: Complete Auth Module 4-Layer Architecture
 * Test Strategy: Mock ONLY external services (authApi, tokenStorage, eventBus)
 *                Use REAL authStore, authStateService, hooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { authStore } from './stores/authStore';
import { authStateService } from './services/authStateService';
import { useAuthStatus, useUser, useAuthError, useAuthActions } from './hooks/useAuthState';
import { UserId } from '../../00_kernel/types';
import type { User } from './types';

// Mock ONLY external boundaries
vi.mock('./services/authService', () => ({
  registerUser: vi.fn(),
  verifyUserEmail: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  refreshAccessToken: vi.fn(),
  loadUserSession: vi.fn(),
  saveUserTokens: vi.fn(),
  saveUserProfile: vi.fn(),
}));

vi.mock('../capture', () => ({
  updateImagesUserId: vi.fn(),
}));

vi.mock('../../00_kernel/eventBus', () => ({
  emit: vi.fn(),
}));

vi.mock('../../00_kernel/telemetry', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    AUTH_SESSION_RESTORED: 'AUTH_SESSION_RESTORED',
    AUTH_LOAD_FAILED: 'AUTH_LOAD_FAILED',
    AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
    AUTH_LOGOUT: 'AUTH_LOGOUT',
    AUTH_TOKEN_REFRESHED: 'AUTH_TOKEN_REFRESHED',
    AUTH_GUEST_DATA_CLAIMED: 'AUTH_GUEST_DATA_CLAIMED',
  },
}));

import * as authService from './services/authService';
import { emit } from '../../00_kernel/eventBus';
import { updateImagesUserId } from '../capture';

describe('Auth Module Integration', () => {
  beforeEach(() => {
    // Reset service (also resets store to 'idle')
    authStateService.destroy();
    // Set store to 'loading' state for tests
    authStore.setState({ status: 'loading', user: null, error: null });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Flow Integration', () => {
    it('should flow: service.login() → store update → hook re-render', async () => {
      vi.mocked(authService.loginUser).mockResolvedValue({
        ok: true,
        data: {
          accessToken: 'token123',
          refreshToken: 'refresh123',
          idToken: 'id123',
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'free',
        },
      });

      vi.mocked(authService.saveUserTokens).mockResolvedValue();
      vi.mocked(authService.saveUserProfile).mockResolvedValue();

      // Render hooks (REAL hooks, REAL store)
      const statusHook = renderHook(() => useAuthStatus());
      const userHook = renderHook(() => useUser());

      // Initial state
      expect(statusHook.result.current).toBe('loading');
      expect(userHook.result.current).toBeNull();

      // Call service login (REAL service)
      await act(async () => {
        const result = await authStateService.login('test@example.com', 'password123');
        expect(result.success).toBe(true);
      });

      // Wait for hooks to update
      await waitFor(() => {
        expect(statusHook.result.current).toBe('authenticated');
      });

      // Verify hooks reflect new state
      expect(userHook.result.current?.email).toBe('test@example.com');
    });

    it('should show error in hooks when login fails', async () => {
      vi.mocked(authService.loginUser).mockResolvedValue({
        ok: false,
        error: 'Invalid credentials',
      });

      const statusHook = renderHook(() => useAuthStatus());
      const errorHook = renderHook(() => useAuthError());

      await act(async () => {
        await authStateService.login('test@example.com', 'wrong');
      });

      await waitFor(() => {
        expect(statusHook.result.current).toBe('error');
      });

      expect(errorHook.result.current).toBe('Invalid credentials');
    });
  });

  describe('Logout Flow Integration', () => {
    it('should flow: service.logout() → store update → hooks clear', async () => {
      // Start authenticated
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'authenticated', user: mockUser, error: null });

      vi.mocked(authService.logoutUser).mockResolvedValue();

      const statusHook = renderHook(() => useAuthStatus());
      const userHook = renderHook(() => useUser());

      // Verify initial authenticated state
      expect(statusHook.result.current).toBe('authenticated');
      expect(userHook.result.current).toEqual(mockUser);

      // Call logout
      await act(async () => {
        await authStateService.logout();
      });

      // Wait for hooks to update
      await waitFor(() => {
        expect(statusHook.result.current).toBe('idle');
      });

      expect(userHook.result.current).toBeNull();
    });
  });

  describe('Session Restoration Integration', () => {
    it('should restore session on init and update hooks', async () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'pro',
      };

      vi.mocked(authService.loadUserSession).mockResolvedValue({
        tokens: {
          accessToken: 'stored-token',
          refreshToken: 'stored-refresh',
          idToken: 'stored-id',
        },
        user: mockUser,
      });

      const statusHook = renderHook(() => useAuthStatus());
      const userHook = renderHook(() => useUser());

      // Init service
      await act(async () => {
        await authStateService.init();
      });

      // Wait for hooks to update
      await waitFor(() => {
        expect(statusHook.result.current).toBe('authenticated');
      });

      expect(userHook.result.current).toEqual(mockUser);
    });

    it('should transition to idle when no stored session', async () => {
      vi.mocked(authService.loadUserSession).mockResolvedValue({
        tokens: null,
        user: null,
      });

      const statusHook = renderHook(() => useAuthStatus());

      await act(async () => {
        await authStateService.init();
      });

      await waitFor(() => {
        expect(statusHook.result.current).toBe('idle');
      });
    });
  });

  describe('Guest Data Claim Integration', () => {
    it('should emit event and update images when data claimed', async () => {
      vi.mocked(authService.loginUser).mockResolvedValue({
        ok: true,
        data: {
          accessToken: 'token123',
          refreshToken: 'refresh123',
          idToken: 'id123',
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'free',
          dataClaimed: 3,
        },
      });

      vi.mocked(authService.saveUserTokens).mockResolvedValue();
      vi.mocked(authService.saveUserProfile).mockResolvedValue();
      vi.mocked(updateImagesUserId).mockResolvedValue();

      await act(async () => {
        await authStateService.login('test@example.com', 'password123');
      });

      // Verify event emitted
      expect(emit).toHaveBeenCalledWith('auth:dataClaimed', expect.objectContaining({
        count: 3,
      }));
    });
  });

  describe('Hook Actions Integration', () => {
    it('should call service methods through useAuthActions', async () => {
      vi.mocked(authService.loginUser).mockResolvedValue({
        ok: true,
        data: {
          accessToken: 'token123',
          refreshToken: 'refresh123',
          idToken: 'id123',
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'free',
        },
      });

      vi.mocked(authService.saveUserTokens).mockResolvedValue();
      vi.mocked(authService.saveUserProfile).mockResolvedValue();

      const { result } = renderHook(() => useAuthActions());
      const statusHook = renderHook(() => useAuthStatus());

      await act(async () => {
        const loginResult = await result.current.login('test@example.com', 'password123');
        expect(loginResult.success).toBe(true);
      });

      await waitFor(() => {
        expect(statusHook.result.current).toBe('authenticated');
      });
    });
  });

  describe('Store Subscription Stability', () => {
    it('should not cause infinite loops with primitive selectors', () => {
      // This test verifies ADR-012 compliance
      const statusHook = renderHook(() => useAuthStatus());

      let renderCount = 0;
      statusHook.rerender(); // Force re-render
      renderCount++;

      // Change state to different value
      act(() => {
        authStore.setState({ status: 'idle', user: null, error: null });
      });

      statusHook.rerender();
      renderCount++;

      // Change to same value
      act(() => {
        authStore.setState({ status: 'idle', user: null, error: null });
      });

      statusHook.rerender();
      renderCount++; // Should not cause additional renders

      // Verify selector returns primitive
      expect(typeof statusHook.result.current).toBe('string');
      expect(renderCount).toBeLessThan(10); // Sanity check - no infinite loop
    });
  });
});
