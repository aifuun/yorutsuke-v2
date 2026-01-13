/**
 * Auth Init Hook
 * Ultra-thin React bridge for initializing auth on app mount
 *
 * Migrated from auth/headless/useAuth.ts (Issue #141)
 * This hook ONLY handles React lifecycle - all business logic is in authStateService
 */

import { useEffect, useRef } from 'react';
import { authStateService } from '../services/authStateService';

/**
 * Initializes auth state on mount (loads stored session)
 * Pure side-effect hook - returns nothing
 *
 * Call once at app startup level
 */
export function useAuthInit(): void {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    authStateService.init();
  }, []);
}
