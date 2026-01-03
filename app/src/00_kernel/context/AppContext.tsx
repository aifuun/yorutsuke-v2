import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserId } from '../types';
import { getDeviceId, isDeviceId } from '../identity';
import { initDb } from '../storage/db';
import { logger } from '../telemetry';

interface AppContextValue {
  userId: UserId | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<UserId | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize: load device ID on mount
  useEffect(() => {
    async function init() {
      try {
        // Ensure database is initialized first
        await initDb();

        // Get or create device ID
        const deviceId = await getDeviceId();
        setUserId(deviceId);

        logger.info('[App] Initialized with Device ID', { deviceId });
      } catch (error) {
        logger.error('[App] Failed to initialize', { error: String(error) });
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // TODO: Replace with authenticated userId when user logs in
  const isAuthenticated = userId !== null && !isDeviceId(userId);
  const isGuest = userId !== null && isDeviceId(userId);

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
