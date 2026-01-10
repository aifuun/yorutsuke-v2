// Pillar L: Headless - logic without UI
// Secret code detection hook for revealing debug menu
import { useState, useEffect, useCallback, useRef } from 'react';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';

const SECRET_CODE = '54178###';
const CODE_TIMEOUT = 2000; // Reset after 2 seconds of inactivity

/**
 * Hook to detect secret key sequence for revealing debug menu
 * User must press 5-4-1-7-8-#-#-# in sequence to unlock
 *
 * @security CRITICAL: Debug panel is ALWAYS disabled in production builds
 * In development, users must enter secret code to unlock
 */
export function useSecretCode() {
  // SECURITY: Always start locked. Users must enter secret code to unlock.
  // In production builds (import.meta.env.PROD), this hook won't even be called
  // because the entire debug view is conditionally not rendered.
  const [isUnlocked, setIsUnlocked] = useState(false);
  const inputRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInput = useCallback(() => {
    inputRef.current = '';
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only listen to number keys and #
    const key = event.key === '#' ? '#' : event.key;
    if (!/^[0-9#]$/.test(key)) {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add key to input
    inputRef.current += key;

    // Check if code matches
    if (inputRef.current === SECRET_CODE) {
      logger.info(EVENTS.DEBUG_MENU_UNLOCKED, {});
      setIsUnlocked(true);
      resetInput();
      return;
    }

    // Check if input is still a valid prefix
    if (!SECRET_CODE.startsWith(inputRef.current)) {
      resetInput();
      return;
    }

    // Set timeout to reset input after inactivity
    timeoutRef.current = setTimeout(resetInput, CODE_TIMEOUT);
  }, [resetInput]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  return { isUnlocked };
}
