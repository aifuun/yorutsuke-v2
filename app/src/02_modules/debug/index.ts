export { useSecretCode } from './headless';
export { DebugView } from './views/DebugView';
export { DiagnosticPanel } from './views/DiagnosticPanel';
export { deleteUserData, purgeAllData } from './adapters/adminApi';
export type { DataType } from './adapters/adminApi';

// Diagnostic export service (Phase 1: Button, Phase 2: Queue)
export { DiagnosticService, diagnosticService, diagnosticStore } from './services/DiagnosticService';
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
