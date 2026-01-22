/**
 * Debug Module Hooks
 * React bridge layer for stores (Issue #166)
 */

// Diagnostic workflow hooks
export {
  useDiagnosticStatus,
  useDiagnosticResult,
  useDiagnosticError,
  useDiagnosticContext,
  useDiagnosticProgress,
  useDiagnosticPhase,
  diagnosticActions,
} from './useDiagnosticState';

// Debug settings hooks (Issue #166: Option B - isolated from Settings module)
export {
  useDebugSettingsInit,
  useDebugSettingsStatus,
  useDebugEnabled,
  useDebugSettings,
  useDebugSettingsError,
  debugSettingsActions,
} from './useDebugSettings';

// Re-export existing hooks from headless
export { useSecretCode } from '../headless/useSecretCode';
