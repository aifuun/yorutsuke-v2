// Auth Headless Hook
// Pillar L: Headless - No JSX, returns data + functions only
// Pillar D: FSM States - Uses AuthStatus union type
// @trigger auth:dataClaimed - When guest data is claimed on login

import { useReducer, useCallback, useEffect } from 'react';
import { UserId } from '../../../00_kernel/types';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { emit } from '../../../00_kernel/eventBus';
import type { AuthState, AuthStatus, User } from '../types';
import {
  registerUser,
  verifyUserEmail,
  loginUser,
  logoutUser,
  refreshAccessToken,
  loadUserSession,
  saveUserTokens,
  saveUserProfile,
} from '../services/authService';
import { updateImagesUserId } from '../../capture';

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
      const session = await loadUserSession();

      if (session.tokens && session.user) {
        logger.info(EVENTS.AUTH_SESSION_RESTORED, { userId: session.user.id });
        dispatch({ type: 'LOADED', user: session.user });
      } else {
        dispatch({ type: 'LOGGED_OUT' });
      }
    } catch (e) {
      logger.error(EVENTS.AUTH_LOAD_FAILED, { error: String(e) });
      dispatch({ type: 'LOGGED_OUT' });
    }
  };

  const register = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      dispatch({ type: 'LOADING' });

      const result = await registerUser(email, password);

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

      const result = await verifyUserEmail(email, code);

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

      const result = await loginUser(email, password);

      if (!result.ok) {
        const error = result.error || 'Login failed';
        dispatch({ type: 'ERROR', error });
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

      dispatch({ type: 'LOADED', user });
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
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutUser();
    dispatch({ type: 'LOGGED_OUT' });
    logger.info(EVENTS.AUTH_LOGOUT, {});
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const result = await refreshAccessToken();

    if (!result.ok) {
      // Refresh failed, logout user
      await logout();
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
