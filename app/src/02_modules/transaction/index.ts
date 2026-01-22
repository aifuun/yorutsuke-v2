// Public API for transaction module
// Note: useTransactionLogic removed (Issue #89 - Service Pattern migration)
// Use hooks from './hooks/useTransactionState' instead
export { TransactionView } from './views';

// Debug/Testing utilities (for DebugView)
export { seedMockTransactions, getSeedScenarios } from './adapters';
export type { SeedScenario } from './adapters';
