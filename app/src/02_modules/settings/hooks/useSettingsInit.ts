/**
 * Settings Init Hook
 * Ultra-thin React bridge for initializing settings on app mount
 *
 * Migrated from settings/headless/useSettings.ts (Issue #141)
 * This hook ONLY handles React lifecycle - all business logic is in settingsStateService
 */

import { useEffect, useRef } from 'react';
import { settingsStateService } from '../services/settingsStateService';

/**
 * Initializes settings on mount (loads and applies settings)
 * Pure side-effect hook - returns nothing
 *
 * Call once at app startup level
 */
export function useSettingsInit(): void {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    settingsStateService.init();
  }, []);
}
