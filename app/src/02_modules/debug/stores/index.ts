/**
 * Debug Module Stores
 * Extracted from services for Pillar L compliance (Issue #166)
 */

// Diagnostic workflow store
export { diagnosticStore, diagnosticSelectors } from './diagnosticStore';
export type {
  DiagnosticStore,
  DiagnosticStoreState,
  DiagnosticActions,
} from './diagnosticStore';

// Debug settings store (Issue #166: Option B - isolated from Settings module)
export { debugSettingsStore, debugSettingsSelectors } from './debugSettingsStore';
export type {
  DebugSettingsStore,
  DebugSettingsState,
  DebugSettingsActions,
} from './debugSettingsStore';
