// Debug Log Collector
// Stores logs in memory for display in Debug UI

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  data?: unknown;
}

const MAX_LOGS = 100;
const logs: LogEntry[] = [];
const listeners: Set<() => void> = new Set();

// Verbose logging flag - when false, only warn/error are logged
let verboseEnabled = false;

/**
 * Enable/disable verbose logging (info level)
 */
export function setVerboseLogging(enabled: boolean) {
  verboseEnabled = enabled;
}

// Cached snapshot for useSyncExternalStore
// Must return same reference unless data changed
let snapshot: LogEntry[] = [];

function notify() {
  // Update snapshot only when data changes
  snapshot = [...logs];
  listeners.forEach((fn) => fn());
}

/**
 * Add a log entry
 * Info-level logs are skipped unless verbose logging is enabled
 */
export function debugLog(
  level: LogEntry['level'],
  tag: string,
  message: string,
  data?: unknown
) {
  // Skip info logs when verbose is disabled
  if (level === 'info' && !verboseEnabled) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    tag,
    message,
    data,
  };

  logs.push(entry);

  // Keep only last MAX_LOGS
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Also output to console
  const consoleMsg = `[${tag}] ${message}`;
  if (level === 'error') {
    console.error(consoleMsg, data ?? '');
  } else if (level === 'warn') {
    console.warn(consoleMsg, data ?? '');
  } else {
    console.log(consoleMsg, data ?? '');
  }

  notify();
}

/**
 * Convenience methods
 */
export const dlog = {
  info: (tag: string, message: string, data?: unknown) =>
    debugLog('info', tag, message, data),
  warn: (tag: string, message: string, data?: unknown) =>
    debugLog('warn', tag, message, data),
  error: (tag: string, message: string, data?: unknown) =>
    debugLog('error', tag, message, data),
};

/**
 * Get all logs (returns cached snapshot for useSyncExternalStore)
 */
export function getLogs(): LogEntry[] {
  return snapshot;
}

/**
 * Clear all logs
 */
export function clearLogs() {
  logs.length = 0;
  snapshot = [];
  listeners.forEach((fn) => fn());
}

/**
 * Subscribe to log updates
 */
export function subscribeLogs(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
