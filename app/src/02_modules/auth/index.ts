// Auth Module
// T2 (Logic) - Form + async API calls

export * from './types';

// Stores (Issue #168: Extracted vanilla store)
export { authStore, authSelectors, type AuthState } from './stores';

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

// Views (Issue #168: Complete 4-layer architecture)
export { LoginView, LogoutConfirmView } from './views';
