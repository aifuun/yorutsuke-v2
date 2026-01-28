/**
 * Auth State Service Unit Tests
 * Tests for authentication service with mocked adapters
 *
 * Issue #168: Complete Auth Module 4-Layer Architecture
 * Test Strategy: Mock ALL dependencies (adapters, eventBus), test service logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authStateService } from './authStateService';
import { authStore } from '../stores/authStore';
import { UserId } from '../../../00_kernel/types';
import type { User } from '../types';

// Mock all adapters
vi.mock('./authService', () => ({
  registerUser: vi.fn(),
  verifyUserEmail: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  refreshAccessToken: vi.fn(),
  loadUserSession: vi.fn(),
  saveUserTokens: vi.fn(),
  saveUserProfile: vi.fn(),
}));

vi.mock('../../capture', () => ({
  updateImagesUserId: vi.fn(),
}));

vi.mock('../../../00_kernel/eventBus', () => ({
  emit: vi.fn(),
}));

vi.mock('../../../00_kernel/telemetry', () => ({
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

import * as authService from './authService';
import { emit } from '../../../00_kernel/eventBus';
import { updateImagesUserId } from '../../capture';

describe('authStateService', () => {
  beforeEach(() => {
    // Reset store
    authStore.setState({ status: 'loading', user: null, error: null });
    // Reset service (for testing only)
    authStateService.destroy();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init()', () => {
    it('should load stored session and transition to authenticated', async () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      vi.mocked(authService.loadUserSession).mockResolvedValue({
        tokens: {
          accessToken: 'token123',
          refreshToken: 'refresh123',
          idToken: 'id123',
        },
        user: mockUser,
      });

      await authStateService.init();

      const state = authStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
    });

    it('should transition to idle when no stored session', async () => {
      vi.mocked(authService.loadUserSession).mockResolvedValue({
        tokens: null,
        user: null,
      });

      await authStateService.init();

      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
    });

    it('should transition to idle on error', async () => {
      vi.mocked(authService.loadUserSession).mockRejectedValue(new Error('Storage error'));

      await authStateService.init();

      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
    });

    it('should prevent duplicate initialization', async () => {
      vi.mocked(authService.loadUserSession).mockResolvedValue({
        tokens: null,
        user: null,
      });

      await authStateService.init();
      await authStateService.init(); // Second call

      // Should only call loadUserSession once
      expect(authService.loadUserSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('register()', () => {
    it('should transition to idle on successful registration', async () => {
      vi.mocked(authService.registerUser).mockResolvedValue({
        success: true,
      });

      const result = await authStateService.register('test@example.com', 'password123');

      expect(result.success).toBe(true);
      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
    });

    it('should transition to error on failed registration', async () => {
      vi.mocked(authService.registerUser).mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      const result = await authStateService.register('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
      const state = authStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Email already exists');
    });

    it('should show loading state during registration', async () => {
      vi.mocked(authService.registerUser).mockImplementation(
        () =>
          new Promise((resolve) => {
            // Check state during async operation
            const state = authStore.getState();
            expect(state.status).toBe('loading');
            resolve({ success: true });
          })
      );

      await authStateService.register('test@example.com', 'password123');
    });
  });

  describe('login()', () => {
    it('should transition to authenticated on successful login', async () => {
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

      const result = await authStateService.login('test@example.com', 'password123');

      expect(result.success).toBe(true);
      const state = authStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user?.email).toBe('test@example.com');
    });

    it('should handle guest data claim on login', async () => {
      vi.mocked(authService.loginUser).mockResolvedValue({
        ok: true,
        data: {
          accessToken: 'token123',
          refreshToken: 'refresh123',
          idToken: 'id123',
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'free',
          dataClaimed: 5, // Guest had 5 images
        },
      });

      vi.mocked(authService.saveUserTokens).mockResolvedValue();
      vi.mocked(authService.saveUserProfile).mockResolvedValue();
      vi.mocked(updateImagesUserId).mockResolvedValue();

      await authStateService.login('test@example.com', 'password123');

      // Should update images userId
      expect(updateImagesUserId).toHaveBeenCalled();
      // Should emit event
      expect(emit).toHaveBeenCalledWith('auth:dataClaimed', expect.objectContaining({
        count: 5,
      }));
    });

    it('should transition to error on failed login', async () => {
      vi.mocked(authService.loginUser).mockResolvedValue({
        ok: false,
        error: 'Invalid credentials',
      });

      const result = await authStateService.login('test@example.com', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      const state = authStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Invalid credentials');
    });
  });

  describe('logout()', () => {
    it('should transition to idle on logout', async () => {
      // Start authenticated
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };
      authStore.setState({ status: 'authenticated', user: mockUser, error: null });

      vi.mocked(authService.logoutUser).mockResolvedValue();

      await authStateService.logout();

      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
    });
  });

  describe('refreshToken()', () => {
    it('should return true on successful refresh', async () => {
      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        ok: true,
        data: {
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
          idToken: 'new-id',
        },
      });

      vi.mocked(authService.saveUserTokens).mockResolvedValue();

      const result = await authStateService.refreshToken();

      expect(result).toBe(true);
      expect(authService.saveUserTokens).toHaveBeenCalled();
    });

    it('should logout on failed refresh', async () => {
      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        ok: false,
        error: 'Token expired',
      });

      vi.mocked(authService.logoutUser).mockResolvedValue();

      const result = await authStateService.refreshToken();

      expect(result).toBe(false);
      expect(authService.logoutUser).toHaveBeenCalled();
      const state = authStore.getState();
      expect(state.status).toBe('idle');
    });
  });

  describe('clearError()', () => {
    it('should clear error and return to authenticated if user exists', () => {
      const mockUser: User = {
        id: UserId('user-123'),
        email: 'test@example.com',
        tier: 'free',
      };

      authStore.setState({ status: 'error', user: mockUser, error: 'Some error' });

      authStateService.clearError();

      const state = authStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.error).toBeNull();
    });

    it('should clear error and return to idle if no user', () => {
      authStore.setState({ status: 'error', user: null, error: 'Some error' });

      authStateService.clearError();

      const state = authStore.getState();
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });
  });
});
