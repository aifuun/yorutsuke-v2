// Views
export { DebugView } from './views/DebugView';
export { DiagnosticPanel } from './views/DiagnosticPanel';

// Hooks (Issue #166: Hook Bridge Layer)
export {
  useSecretCode,
  useDiagnosticStatus,
  useDiagnosticResult,
  useDiagnosticError,
  useDiagnosticContext,
  useDiagnosticProgress,
  useDiagnosticPhase,
  diagnosticActions,
  // Debug settings hooks (Issue #166: Option B)
  useDebugSettingsInit,
  useDebugSettingsStatus,
  useDebugEnabled,
  useDebugSettings,
  useDebugSettingsError,
  debugSettingsActions,
} from './hooks';

// Stores (Issue #166: Extracted from service)
export {
  diagnosticStore,
  diagnosticSelectors,
  // Debug settings store (Issue #166: Option B)
  debugSettingsStore,
  debugSettingsSelectors,
} from './stores';
export type {
  DiagnosticStore,
  DiagnosticStoreState,
  DiagnosticActions,
  // Debug settings types (Issue #166: Option B)
  DebugSettingsStore,
  DebugSettingsState,
  DebugSettingsActions,
} from './stores';

// Services
export { DiagnosticService, diagnosticService } from './services/DiagnosticService';

// Adapters
export { deleteUserData, purgeAllData } from './adapters/adminApi';
export type { DataType } from './adapters/adminApi';
export type { DebugSettings } from './adapters/debugSettingsDb';
export type {
  LocalDiagnosticData,
  CloudDiagnosticData,
  DiagnosticReport,
  DiagnosticExportResult,
  DiagnosticExportSuccess,
  DiagnosticExportError,
  DiagnosticContext,
  DiagnosticState,
  DiagnosticPhase,
  PhaseStatus,
  PhaseProgress,
  StateTransition,
  FSMValidationResult,
  SystemInfo,
  AppState,
  LocalStorage,
  DebugLogEntry,
  CloudTransaction,
  S3Image,
  LambdaError,
  DiagnosticSummary,
} from './types/diagnostic';
export { VALID_STATE_TRANSITIONS } from './types/diagnostic';
export { isDiagnosticExportSuccess, isDiagnosticExportError } from './types/diagnostic';
