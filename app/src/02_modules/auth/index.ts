// Auth Module
// T2 (Logic) - Form + async API calls

export * from './types';

// Services (Issue #141: Service Pattern Migration)
export { authStateService } from './services/authStateService';

// Hooks (React bridges)
export { useAuthInit } from './hooks/useAuthInit';
export { useEffectiveUserId } from './headless/useEffectiveUserId';
export {
  useAuthStatus,
  useUser,
  useAuthError,
  useIsAuthenticated,
  useIsAuthLoading,
  useAuthActions,
  type AuthActions,
} from './hooks/useAuthState';
