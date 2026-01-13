import { useState, useSyncExternalStore, useEffect, useCallback } from 'react';
import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';
import { AppProvider, useAppContext } from './00_kernel/context';
import { subscribeMockMode, getMockSnapshot, isDebugEnabled } from './00_kernel/config';
import { createTraceId } from './00_kernel/types';
import { Sidebar, type ViewType } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { DashboardView } from './02_modules/report';
import { CaptureView } from './02_modules/capture';
import { TransactionView } from './02_modules/transaction';
import { SettingsView, UserProfileView } from './02_modules/settings';
// @security: Debug panel only available in development builds
import { DebugView } from './02_modules/debug';
import { transactionSyncService } from './02_modules/transaction/services/transactionSyncService';
import { networkMonitor, transactionPushService, fullSync, autoSyncService, manualSyncService } from './02_modules/sync';
import { authStateService } from './02_modules/auth';
import { settingsStateService } from './02_modules/settings';

// @security: Check once at module load - cannot change at runtime
const IS_DEVELOPMENT = !import.meta.env.PROD;

function AppContent() {
  const { userId, isLoading } = useAppContext();
  const [activeView, setActiveView] = useState<ViewType>('capture');
  const mockMode = useSyncExternalStore(subscribeMockMode, getMockSnapshot, getMockSnapshot);

  // Initialize services (load persisted state from localStorage)
  // Issue #141: Service Pattern Migration
  useEffect(() => {
    manualSyncService.init();
    authStateService.init();
    settingsStateService.init();
  }, []);

  // Set user ID in sync services when it changes
  useEffect(() => {
    transactionSyncService.setUser(userId);
    autoSyncService.setUser(userId);
  }, [userId]);

  // Subscribe to network status changes for queue processing (Issue #86 Phase 2)
  // Note: networkMonitor.initialize() is called once in main.tsx (ADR-001: Service Pattern)
  useEffect(() => {
    if (!userId) return;

    // Subscribe to network reconnect events to process offline queue
    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      if (isOnline) {
        // Network reconnected - process offline queue
        const traceId = createTraceId();
        transactionPushService.processQueue(userId, traceId);
      }
    });

    return unsubscribe;
  }, [userId]);

  // Auto-sync on app start (Issue #86 Phase 4)
  // Automatically sync pending changes instead of showing recovery dialog
  useEffect(() => {
    if (!userId) return;

    // Trigger full sync on startup (processes queue + dirty transactions + pulls new data)
    fullSync(userId).catch((error) => {
      console.error('Auto-sync on startup failed:', error);
    });
  }, [userId]);

  // @security CRITICAL: Debug panel is ALWAYS disabled in production
  // In development, controlled by VITE_DEBUG_PANEL environment variable (.env.local)
  const isDebugUnlocked = isDebugEnabled();

  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  // Show loading state during initialization (after all Hooks)
  if (isLoading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

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
      <ToastContainer />
    </AppProvider>
  );
}

export default App;
