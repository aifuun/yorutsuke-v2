// Pillar L: Headless - logic without UI
// Secret code detection hook for revealing debug menu
import { useState, useEffect, useCallback, useRef } from 'react';

const SECRET_CODE = '54178';
const CODE_TIMEOUT = 2000; // Reset after 2 seconds of inactivity

/**
 * Hook to detect secret key sequence for revealing debug menu
 * User must press 5-4-1-7-8 in sequence to unlock
 */
export function useSecretCode() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const inputRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInput = useCallback(() => {
    inputRef.current = '';
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only listen to number keys
    if (!/^[0-9]$/.test(event.key)) {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add key to input
    inputRef.current += event.key;

    // Check if code matches
    if (inputRef.current === SECRET_CODE) {
      console.log('[useSecretCode] Debug menu unlocked!');
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
