import { useState, useSyncExternalStore } from 'react';
import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';
import { AppProvider, useAppContext } from './00_kernel/context';
import { subscribeMockMode, getMockSnapshot } from './00_kernel/config/mock';
import { Sidebar, type ViewType } from './components/Sidebar';
import { DashboardView } from './02_modules/report';
import { CaptureView } from './02_modules/capture';
import { TransactionView } from './02_modules/transaction';
import { SettingsView, UserProfileView } from './02_modules/settings';
import { DebugView, useSecretCode } from './02_modules/debug';

function AppContent() {
  const { userId } = useAppContext();
  const [activeView, setActiveView] = useState<ViewType>('capture');
  const { isUnlocked: isDebugUnlocked } = useSecretCode();
  const mockMode = useSyncExternalStore(subscribeMockMode, getMockSnapshot, getMockSnapshot);

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
          onViewChange={setActiveView}
          userId={userId}
          isDebugUnlocked={isDebugUnlocked}
        />

        <main className="main-content accounting-grid">
          <div className={`view-panel ${activeView === 'dashboard' ? 'active' : ''}`}>
            <DashboardView userId={userId} onViewChange={setActiveView} />
          </div>

          <div className={`view-panel ${activeView === 'capture' ? 'active' : ''}`}>
            <CaptureView />
          </div>

          <div className={`view-panel ${activeView === 'ledger' ? 'active' : ''}`}>
            <TransactionView userId={userId} onNavigate={setActiveView} />
          </div>

          <div className={`view-panel ${activeView === 'settings' ? 'active' : ''}`}>
            <SettingsView />
          </div>

          <div className={`view-panel ${activeView === 'profile' ? 'active' : ''}`}>
            <UserProfileView />
          </div>

          <div className={`view-panel ${activeView === 'debug' ? 'active' : ''}`}>
            <DebugView />
          </div>
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
