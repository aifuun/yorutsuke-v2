import { createContext, useContext, ReactNode } from 'react';
import type { UserId } from '../types';

interface AppContextValue {
  userId: UserId | null;
  isAuthenticated: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // TODO: Implement authentication state
  const value: AppContextValue = {
    userId: null,
    isAuthenticated: false,
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
