import { ErrorBoundary, ErrorFallback } from './00_kernel/resilience';

function App() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}
    >
      <main>
        <h1>Yorutsuke v2</h1>
        <p>夜付け - AI 記帳アシスタント</p>
      </main>
    </ErrorBoundary>
  );
}

export default App;
