import { useState } from 'react';
import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';
import { AppProvider, useAppContext } from './00_kernel/context';
import { Sidebar, type ViewType } from './components/Sidebar';
import { ReportView, ReportHistoryView } from './02_modules/report';
import { CaptureView } from './02_modules/capture';
import { TransactionView } from './02_modules/transaction';
import { SettingsView } from './02_modules/settings';

function AppContent() {
  const { userId } = useAppContext();
  const [activeView, setActiveView] = useState<ViewType>('report');

  return (
    <div className="app-shell">
      <div className="app-body">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />

        <main className="main-content">
          <div className={`view-panel ${activeView === 'report' ? 'active' : ''}`}>
            <ReportView userId={userId} />
          </div>

          <div className={`view-panel ${activeView === 'capture' ? 'active' : ''}`}>
            <CaptureView userId={userId} />
          </div>

          <div className={`view-panel ${activeView === 'transactions' ? 'active' : ''}`}>
            <TransactionView userId={userId} />
          </div>

          <div className={`view-panel ${activeView === 'history' ? 'active' : ''}`}>
            <ReportHistoryView userId={userId} />
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
