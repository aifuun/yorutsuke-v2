import { useState } from 'react';
import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';
import { AppProvider, useAppContext } from './00_kernel/context';
import { USE_MOCK } from './00_kernel/config/mock';
import { Sidebar, type ViewType } from './components/Sidebar';
import { ReportView } from './02_modules/report';
import { CaptureView } from './02_modules/capture';
import { TransactionView } from './02_modules/transaction';
import { SettingsView } from './02_modules/settings';

function AppContent() {
  const { userId } = useAppContext();
  const [activeView, setActiveView] = useState<ViewType>('dashboard');

  return (
    <div className="app-shell">
      {USE_MOCK && (
        <div className="mock-banner">
          MOCK MODE - Data is simulated
        </div>
      )}
      <div className="app-body">
        <Sidebar activeView={activeView} onViewChange={setActiveView} userId={userId} />

        <main className="main-content accounting-grid">
          <div className={`view-panel ${activeView === 'dashboard' ? 'active' : ''}`}>
            <ReportView userId={userId} />
          </div>

          <div className={`view-panel ${activeView === 'capture' ? 'active' : ''}`}>
            <CaptureView />
          </div>

          <div className={`view-panel ${activeView === 'ledger' ? 'active' : ''}`}>
            <TransactionView userId={userId} />
          </div>

          <div className={`view-panel ${activeView === 'settings' ? 'active' : ''}`}>
            <SettingsView />
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
