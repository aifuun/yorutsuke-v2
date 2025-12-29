import { useTranslation } from 'react-i18next';
import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';

function App() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}
    >
      <main>
        <h1>{t('app.name')}</h1>
        <p>{t('app.tagline')}</p>
      </main>
    </ErrorBoundary>
  );
}

export default App;
