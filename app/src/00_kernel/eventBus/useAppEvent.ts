// React Hook for subscribing to app events with automatic cleanup
// Pillar L: Headless - No JSX, returns nothing (side-effect only hook)

import { useEffect, useCallback, useRef } from 'react';
import { on } from './eventBus';
import type { AppEvents, AppEventKey } from './types';

/**
 * Subscribe to an app event with automatic cleanup on unmount
 *
 * @listen Varies by eventName
 *
 * @example
 * useAppEvent('upload:complete', (data) => {
 *   refresh(); // Auto-refresh when upload completes
 * });
 *
 * @example
 * // With dependencies
 * useAppEvent('data:refresh', (data) => {
 *   if (data.source === 'upload') {
 *     fetchTransactions();
 *   }
 * });
 */
export function useAppEvent<K extends AppEventKey>(
  eventName: K,
  handler: (data: AppEvents[K]) => void
): void {
  // Use ref to keep handler stable across re-renders
  // This prevents unnecessary unsubscribe/resubscribe cycles
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Stable callback that delegates to ref
  const stableHandler = useCallback((data: AppEvents[K]) => {
    handlerRef.current(data);
  }, []);

  useEffect(() => {
    const unsubscribe = on(eventName, stableHandler);
    return unsubscribe;
  }, [eventName, stableHandler]);
}

/**
 * Subscribe to multiple events with a single handler
 *
 * @example
 * useAppEvents(['image:queued', 'image:failed'], (eventName, data) => {
 *   console.log(`Event: ${eventName}`, data);
 * });
 */
export function useAppEvents<K extends AppEventKey>(
  eventNames: K[],
  handler: (eventName: K, data: AppEvents[K]) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribes = eventNames.map((eventName) => {
      return on(eventName, (data) => {
        handlerRef.current(eventName, data);
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [eventNames.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
}
