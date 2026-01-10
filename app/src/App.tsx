import { useState, useSyncExternalStore, useEffect, useCallback } from 'react';
import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';
import { AppProvider, useAppContext } from './00_kernel/context';
import { subscribeMockMode, getMockSnapshot, isDebugEnabled } from './00_kernel/config';
import { Sidebar, type ViewType } from './components/Sidebar';
import { DashboardView } from './02_modules/report';
import { CaptureView } from './02_modules/capture';
import { TransactionView } from './02_modules/transaction';
import { SettingsView, UserProfileView } from './02_modules/settings';
// @security: Debug panel only available in development builds
import { DebugView } from './02_modules/debug';
import { transactionSyncService } from './02_modules/transaction/services/transactionSyncService';

// @security: Check once at module load - cannot change at runtime
const IS_DEVELOPMENT = !import.meta.env.PROD;

function AppContent() {
  const { userId } = useAppContext();
  const [activeView, setActiveView] = useState<ViewType>('capture');
  const mockMode = useSyncExternalStore(subscribeMockMode, getMockSnapshot, getMockSnapshot);

  // DEBUG: Log view changes
  useEffect(() => {
    console.log('[App] activeView changed to:', activeView);
  }, [activeView]);

  // DEBUG: Log component mount/unmount
  useEffect(() => {
    console.log('[App] AppContent mounted');
    return () => console.log('[App] AppContent unmounted');
  }, []);

  // Set user ID in transaction sync service when it changes
  useEffect(() => {
    transactionSyncService.setUser(userId);
  }, [userId]);

  // @security CRITICAL: Debug panel is ALWAYS disabled in production
  // In development, controlled by VITE_DEBUG_PANEL environment variable (.env.local)
  const isDebugUnlocked = isDebugEnabled();

  // DEBUG: Wrap setActiveView to log caller
  const handleViewChange = useCallback((view: ViewType) => {
    console.log('[App] setActiveView called with:', view, 'from:', new Error().stack?.split('\n')[2]);
    setActiveView(view);
  }, []);

  return (
    <div className="app-shell">
      {mockMode !== 'off' && (
        <div className="mock-banner">
          {mockMode === 'online' ? 'MOCK MODE - Data is simulated' : 'OFFLINE MODE - Network disabled'}
        </div>
      )}
      <div className="app-body">
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          userId={userId}
          isDebugUnlocked={isDebugUnlocked}
        />

        <main className="main-content accounting-grid">
          <div className={`view-panel ${activeView === 'dashboard' ? 'active' : ''}`}>
            <DashboardView userId={userId} onViewChange={handleViewChange} />
          </div>

          <div className={`view-panel ${activeView === 'capture' ? 'active' : ''}`}>
            <CaptureView />
          </div>

          <div className={`view-panel ${activeView === 'ledger' ? 'active' : ''}`}>
            <TransactionView userId={userId} onNavigate={handleViewChange} />
          </div>

          <div className={`view-panel ${activeView === 'settings' ? 'active' : ''}`}>
            <SettingsView />
          </div>

          <div className={`view-panel ${activeView === 'profile' ? 'active' : ''}`}>
            <UserProfileView />
          </div>

          {/* @security: Debug view only rendered in development builds */}
          {IS_DEVELOPMENT && (
            <div className={`view-panel ${activeView === 'debug' ? 'active' : ''}`}>
              <DebugView />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <ErrorBoundary
        fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}
      >
        <AppContent />
      </ErrorBoundary>
    </AppProvider>
  );
}

export default App;
