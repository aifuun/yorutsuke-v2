// Auth Headless Hook
// Pillar L: Headless - No JSX, returns data + functions only
// Pillar D: FSM States - Uses AuthStatus union type
// @trigger auth:dataClaimed - When guest data is claimed on login

import { useReducer, useCallback, useEffect } from 'react';
import { UserId } from '../../../00_kernel/types';
import { logger } from '../../../00_kernel/telemetry';
import { emit } from '../../../00_kernel/eventBus';
import type { AuthState, AuthStatus, User } from '../types';
import * as authApi from '../adapters/authApi';
import * as tokenStorage from '../adapters/tokenStorage';
import { updateImagesUserId } from '../../capture/adapters/imageDb';

// Action types
type Action =
  | { type: 'LOADING' }
  | { type: 'LOADED'; user: User }
  | { type: 'LOGGED_OUT' }
  | { type: 'ERROR'; error: string }
  | { type: 'CLEAR_ERROR' };

// Reducer
function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', error: null };

    case 'LOADED':
      return {
        status: 'authenticated',
        user: action.user,
        error: null,
      };

    case 'LOGGED_OUT':
      return {
        status: 'idle',
        user: null,
        error: null,
      };

    case 'ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        status: state.user ? 'authenticated' : 'idle',
        error: null,
      };

    default:
      return state;
  }
}

const initialState: AuthState = {
  status: 'loading', // Start with loading to check stored auth
  user: null,
  error: null,
};

export interface UseAuthResult {
  // State
  state: AuthState;
  status: AuthStatus;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  verify: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Auth Hook - manages authentication state
 *
 * Pillar L: Returns data + actions only, no JSX
 * Pillar D: Uses FSM states (idle | loading | authenticated | error)
 *
 * @example
 * function LoginPage() {
 *   const { status, login, error } = useAuth();
 *
 *   if (status === 'loading') return <Spinner />;
 *   if (status === 'authenticated') return <Redirect to="/home" />;
 *
 *   return <LoginForm onSubmit={login} error={error} />;
 * }
 */
export function useAuth(): UseAuthResult {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [tokens, user] = await Promise.all([
        tokenStorage.loadTokens(),
        tokenStorage.loadUser(),
      ]);

      if (tokens && user) {
        logger.info('[useAuth] Restored session', { userId: user.id });
        dispatch({ type: 'LOADED', user });
      } else {
        dispatch({ type: 'LOGGED_OUT' });
      }
    } catch (e) {
      logger.error('[useAuth] Failed to load stored auth', { error: String(e) });
      dispatch({ type: 'LOGGED_OUT' });
    }
  };

  const register = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      dispatch({ type: 'LOADING' });

      const result = await authApi.register(email, password);

      if (!result.success) {
        dispatch({ type: 'ERROR', error: result.error || 'Registration failed' });
        return { success: false, error: result.error };
      }

      // Stay in loading state - user needs to verify email
      dispatch({ type: 'LOGGED_OUT' });
      return { success: true };
    },
    []
  );

  const verify = useCallback(
    async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
      dispatch({ type: 'LOADING' });

      const result = await authApi.verify(email, code);

      if (!result.success) {
        dispatch({ type: 'ERROR', error: result.error || 'Verification failed' });
        return { success: false, error: result.error };
      }

      // Stay logged out - user needs to login after verification
      dispatch({ type: 'LOGGED_OUT' });
      return { success: true };
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      dispatch({ type: 'LOADING' });

      // Get device ID for device binding
      const deviceId = await tokenStorage.getDeviceId();

      const result = await authApi.login(email, password, deviceId);

      if (!result.ok) {
        dispatch({ type: 'ERROR', error: result.error });
        return { success: false, error: result.error };
      }

      const data = result.data;

      // Save tokens
      await tokenStorage.saveTokens({
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
      await tokenStorage.saveUser(user);

      dispatch({ type: 'LOADED', user });
      logger.info('[useAuth] Login success', { userId: user.id });

      // Handle guest data claim (#50)
      // When a guest registers and logs in, backend claims their device data
      if (data.dataClaimed && data.dataClaimed > 0) {
        const oldUserId = UserId(`guest-${deviceId}`);
        const newUserId = user.id;

        logger.info('[useAuth] Guest data claimed', {
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
    },
    []
  );

  const logout = useCallback(async () => {
    await tokenStorage.clearAuthData();
    dispatch({ type: 'LOGGED_OUT' });
    logger.info('[useAuth] Logged out');
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const currentRefreshToken = await tokenStorage.getRefreshToken();
    if (!currentRefreshToken) {
      return false;
    }

    const result = await authApi.refreshToken(currentRefreshToken);

    if (!result.ok) {
      // Refresh failed, logout user
      await logout();
      return false;
    }

    const data = result.data;

    // Update tokens
    await tokenStorage.saveTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || currentRefreshToken,
      idToken: data.idToken,
    });

    logger.debug('[useAuth] Token refreshed');
    return true;
  }, [logout]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Derived values
  const isAuthenticated = state.status === 'authenticated';
  const isLoading = state.status === 'loading';

  return {
    // State
    state,
    status: state.status,
    user: state.user,
    isAuthenticated,
    isLoading,
    error: state.error,

    // Actions
    register,
    verify,
    login,
    logout,
    refreshToken,
    clearError,
  };
}
