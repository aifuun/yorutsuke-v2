import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserId as UserIdType } from '../types';
import { getDeviceId } from '../identity';
import { initDb } from '../storage/db';
import { loadMockMode } from '../config/mock';
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

  // Initialize: load mock mode first, then database, then device ID
  useEffect(() => {
    async function init() {
      try {
        // Step 1: Load persisted mock mode from production database
        // This must happen FIRST so initDb() knows which db to use
        await loadMockMode();

        // Step 2: Initialize database connection (production or mock based on mockMode)
        // After loadMockMode(), initDb() will select the correct db path
        await initDb();

        // Step 3: Get device ID - used directly as guest userId
        // Format: device-{machineId} (stable across app reinstalls)
        const deviceId = await getDeviceId();
        setUserId(deviceId);

        logger.info(EVENTS.APP_INITIALIZED, { userId: deviceId, isGuest: true });
      } catch (error) {
        logger.error(EVENTS.APP_ERROR, { context: 'init', error: String(error) });
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Guest IDs use format: device-{machineId}
  // Authenticated IDs use format: user-{cognitoSub}
  const isGuest = userId !== null && userId.startsWith('device-');
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
