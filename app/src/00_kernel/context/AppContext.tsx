import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserId as UserIdType } from '../types';
import { UserId } from '../types';
import { getDeviceId } from '../identity';
import { initDb } from '../storage/db';
import { logger, EVENTS } from '../telemetry';

interface AppContextValue {
  userId: UserIdType | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<UserIdType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize: load device ID on mount
  useEffect(() => {
    async function init() {
      try {
        // Ensure database is initialized first
        await initDb();

        // Get or create device ID, use guest-{deviceId} format for consistency
        // This matches useEffectiveUserId() format
        const deviceId = await getDeviceId();
        const guestUserId = UserId(`guest-${deviceId}`);
        setUserId(guestUserId);

        logger.info(EVENTS.APP_INITIALIZED, { userId: guestUserId, isGuest: true });
      } catch (error) {
        logger.error(EVENTS.APP_ERROR, { context: 'init', error: String(error) });
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // TODO: Replace with authenticated userId when user logs in
  // Guest IDs use format: guest-{deviceId} (e.g., guest-device-xxx)
  const isGuest = userId !== null && userId.startsWith('guest-');
  const isAuthenticated = userId !== null && !isGuest;

  const value: AppContextValue = {
    userId,
    isAuthenticated,
    isGuest,
    isLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
