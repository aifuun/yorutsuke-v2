/**
 * Auth State Service
 * Manages authentication state and operations
 *
 * Migrated from auth/headless/useAuth.ts (Issue #141)
 * Pillar D: FSM - explicit state machine
 * Pillar J: Locality - state near usage
 */

import { createStore } from 'zustand/vanilla';
import { UserId } from '../../../00_kernel/types';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { emit } from '../../../00_kernel/eventBus';
import type { User } from '../types';
import {
  registerUser,
  verifyUserEmail,
  loginUser,
  logoutUser,
  refreshAccessToken,
  loadUserSession,
  saveUserTokens,
  saveUserProfile,
} from './authService';
import { updateImagesUserId } from '../../capture';

// FSM State
type AuthState =
  | { status: 'idle'; user: null; error: null }
  | { status: 'loading'; user: User | null; error: null }
  | { status: 'authenticated'; user: User; error: null }
  | { status: 'error'; user: User | null; error: string };

class AuthStateService {
  // Zustand vanilla store
  store = createStore<AuthState>(() => ({
    status: 'loading', // Start with loading to check stored auth
    user: null,
    error: null,
  }));

  /**
   * Initialize service - load stored auth session
   * Called once at app startup
   */
  async init(): Promise<void> {
    try {
      const session = await loadUserSession();

      if (session.tokens && session.user) {
        logger.info(EVENTS.AUTH_SESSION_RESTORED, { userId: session.user.id });
        this.store.setState({ status: 'authenticated', user: session.user, error: null });
      } else {
        this.store.setState({ status: 'idle', user: null, error: null });
      }
    } catch (e) {
      logger.error(EVENTS.AUTH_LOAD_FAILED, { error: String(e) });
      this.store.setState({ status: 'idle', user: null, error: null });
    }
  }

  /**
   * Register new user
   */
  async register(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    this.store.setState({ status: 'loading', user: null, error: null });

    const result = await registerUser(email, password);

    if (!result.success) {
      this.store.setState({
        status: 'error',
        user: null,
        error: result.error || 'Registration failed',
      });
      return { success: false, error: result.error };
    }

    // Stay in idle state - user needs to verify email
    this.store.setState({ status: 'idle', user: null, error: null });
    return { success: true };
  }

  /**
   * Verify user email
   */
  async verify(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    this.store.setState({ status: 'loading', user: null, error: null });

    const result = await verifyUserEmail(email, code);

    if (!result.success) {
      this.store.setState({
        status: 'error',
        user: null,
        error: result.error || 'Verification failed',
      });
      return { success: false, error: result.error };
    }

    // Stay logged out - user needs to login after verification
    this.store.setState({ status: 'idle', user: null, error: null });
    return { success: true };
  }

  /**
   * Login user
   * Handles guest data claim when applicable
   */
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    this.store.setState({ status: 'loading', user: null, error: null });

    const result = await loginUser(email, password);

    if (!result.ok) {
      const error = result.error || 'Login failed';
      this.store.setState({ status: 'error', user: null, error });
      return { success: false, error };
    }

    const data = result.data!;

    // Save tokens
    await saveUserTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      idToken: data.idToken,
    });

    // Create user object
    const user: User = {
      id: UserId(data.userId || email),
      email: data.email || email,
      tier: data.tier || 'free',
    };
    await saveUserProfile(user);

    this.store.setState({ status: 'authenticated', user, error: null });
    logger.info(EVENTS.AUTH_LOGIN_SUCCESS, { userId: user.id });

    // Handle guest data claim (#50)
    // When a guest registers and logs in, backend claims their device data
    if (data.dataClaimed && data.dataClaimed > 0) {
      const oldUserId = UserId(data.userId); // device-{machineId} format
      const newUserId = user.id;

      logger.info(EVENTS.AUTH_GUEST_DATA_CLAIMED, {
        count: data.dataClaimed,
        oldUserId,
        newUserId,
      });

      // Update local SQLite records with new userId
      await updateImagesUserId(oldUserId, newUserId);

      // Notify capture module to clear stale queue
      // @trigger auth:dataClaimed
      emit('auth:dataClaimed', {
        count: data.dataClaimed,
        oldUserId: String(oldUserId),
        newUserId: String(newUserId),
      });
    }

    return { success: true };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await logoutUser();
    this.store.setState({ status: 'idle', user: null, error: null });
    logger.info(EVENTS.AUTH_LOGOUT, {});
  }

  /**
   * Refresh access token
   * Returns true if refresh succeeded, false otherwise
   */
  async refreshToken(): Promise<boolean> {
    const result = await refreshAccessToken();

    if (!result.ok) {
      // Refresh failed, logout user
      await this.logout();
      return false;
    }

    const data = result.data!;

    // Update tokens
    await saveUserTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || '',
      idToken: data.idToken,
    });

    logger.debug(EVENTS.AUTH_TOKEN_REFRESHED, {});
    return true;
  }

  /**
   * Clear error state
   */
  clearError(): void {
    const state = this.store.getState();

    if (state.user) {
      this.store.setState({ status: 'authenticated', user: state.user, error: null });
    } else {
      this.store.setState({ status: 'idle', user: null, error: null });
    }
  }
}

export const authStateService = new AuthStateService();
