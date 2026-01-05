// Effective User ID Hook
// Returns a valid UserId whether authenticated or guest
// Pillar L: Headless - No JSX, returns data only

import { useState, useEffect } from 'react';
import { UserId, type UserId as UserIdType } from '../../../00_kernel/types';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { getGuestId } from '../adapters/tokenStorage';
import { useAuth } from './useAuth';

/**
 * Returns an effective user ID that is always non-null
 * - If authenticated: returns the real user ID
 * - If not authenticated: returns a persistent guest ID
 *
 * This ensures the capture pipeline can always work,
 * storing data under a consistent ID.
 *
 * @example
 * function CaptureView() {
 *   const { effectiveUserId, isGuest } = useEffectiveUserId();
 *   // effectiveUserId is always non-null
 *   const capture = useCaptureLogic(effectiveUserId, 30);
 * }
 */
export function useEffectiveUserId(): {
  effectiveUserId: UserIdType | null;  // null only during initial load
  isGuest: boolean;
  isLoading: boolean;
} {
  const { user, isLoading: authLoading } = useAuth();
  const [guestId, setGuestId] = useState<UserIdType | null>(null);
  const [guestLoading, setGuestLoading] = useState(true);

  // Load guest ID on mount
  useEffect(() => {
    async function loadGuestId() {
      try {
        const id = await getGuestId();
        setGuestId(UserId(id));
        logger.debug(EVENTS.DEVICE_ID_LOADED, { guestId: id });
      } catch (e) {
        logger.error(EVENTS.APP_ERROR, { context: 'loadGuestId', error: String(e) });
      } finally {
        setGuestLoading(false);
      }
    }
    loadGuestId();
  }, []);

  const isLoading = authLoading || guestLoading;

  // If authenticated, use real user ID
  if (user) {
    return {
      effectiveUserId: user.id,
      isGuest: false,
      isLoading: false,
    };
  }

  // If not authenticated, use guest ID
  return {
    effectiveUserId: guestId,
    isGuest: true,
    isLoading,
  };
}
