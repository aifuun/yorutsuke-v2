// Mock mode configuration for UI development and testing
// Three modes: off (real API), online (mock API), offline (simulate network failure)
// Persisted in SQLite settings table
import { logger, EVENTS } from '../telemetry/logger';
import { getSetting, setSetting } from '../storage/db';

/**
 * Mock mode states:
 * - 'off': Real API calls (production mode)
 * - 'online': Mock API responses (UI development)
 * - 'offline': Simulate network failure (test session recovery)
 */
export type MockMode = 'off' | 'online' | 'offline';

const MOCK_MODE_KEY = 'mock_mode';
const SLOW_UPLOAD_KEY = 'slow_upload';

/**
 * Default mock mode is always 'off'.
 * Developers can change it via Debug panel, which persists to DB.
 */
const DEFAULT_MODE: MockMode = 'off';

// Runtime mock state
let _mockMode: MockMode = DEFAULT_MODE;
let _slowUpload = false; // For testing SC-503: simulate slow upload
let _initialized = false;
const _listeners = new Set<() => void>();

/**
 * Check if in any mock mode (online or offline)
 * Both modes use the same mock database for isolation from production data
 */
export function isMockMode(): boolean {
  return _mockMode === 'online' || _mockMode === 'offline';
}

/**
 * Check if mocking online mode (API returns mock data, no real calls)
 */
export function isMockingOnline(): boolean {
  return _mockMode === 'online';
}

/**
 * Check if mocking offline mode (simulates network failure)
 */
export function isMockingOffline(): boolean {
  return _mockMode === 'offline';
}

/**
 * Check if slow upload mode is enabled (for SC-503 testing)
 */
export function isSlowUpload(): boolean {
  return _slowUpload;
}

/**
 * Set slow upload mode (for testing force-close during upload)
 * Persists to SQLite for survival across reloads
 */
export function setSlowUpload(enabled: boolean): void {
  _slowUpload = enabled;
  logger.info('slow_upload_changed', { enabled });

  // Persist to database (fire and forget)
  setSetting(SLOW_UPLOAD_KEY, enabled ? 'true' : 'false').catch(error => {
    logger.warn('slow_upload_save_failed', { error: String(error) });
  });
}

// Deprecated aliases for backwards compatibility
/** @deprecated Use isMockingOnline() instead */
export const isMockEnabled = isMockingOnline;
/** @deprecated Use isMockingOffline() instead */
export const isOfflineEnabled = isMockingOffline;

/**
 * Get current mock mode
 */
export function getMockMode(): MockMode {
  return _mockMode;
}

/**
 * @deprecated Always false. Use isMockingOnline() for runtime checks.
 */
export const USE_MOCK = false;

/**
 * Load mock mode and slow upload from database on app start
 * Call this during app initialization after DB is ready
 *
 * NOTE: In production builds, mock mode is always 'off' and DB is not read.
 * This ensures end users cannot accidentally enable mock mode.
 */
export async function loadMockMode(): Promise<void> {
  if (_initialized) return;

  // Production: always 'off', skip DB read
  if (import.meta.env.PROD) {
    _initialized = true;
    return;
  }

  // Development: load from DB
  try {
    const savedMode = await getSetting(MOCK_MODE_KEY);
    if (savedMode && isValidMockMode(savedMode)) {
      _mockMode = savedMode;
      _listeners.forEach(listener => listener());
      logger.info(EVENTS.MOCK_MODE_CHANGED, { mode: savedMode, source: 'db' });
    }

    const savedSlowUpload = await getSetting(SLOW_UPLOAD_KEY);
    if (savedSlowUpload === 'true') {
      _slowUpload = true;
      logger.info('slow_upload_loaded', { enabled: true, source: 'db' });
    }

    _initialized = true;
  } catch (error) {
    logger.warn('mock_mode_load_failed', { error: String(error) });
  }
}

function isValidMockMode(value: string): value is MockMode {
  return value === 'off' || value === 'online' || value === 'offline';
}

/**
 * Set mock mode at runtime and persist to database
 */
export function setMockMode(mode: MockMode): void {
  _mockMode = mode;
  _listeners.forEach(listener => listener());
  logger.info(EVENTS.MOCK_MODE_CHANGED, { mode });

  // Persist to database (fire and forget)
  setSetting(MOCK_MODE_KEY, mode).catch(error => {
    logger.warn('mock_mode_save_failed', { error: String(error) });
  });
}

/**
 * Toggle mock mode at runtime (legacy, use setMockMode instead)
 * @deprecated Use setMockMode() instead
 */
export function setMockEnabled(enabled: boolean): void {
  setMockMode(enabled ? 'online' : 'off');
}

/**
 * Subscribe to mock mode changes
 */
export function subscribeMockMode(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Get current mock mode (for useSyncExternalStore)
 */
export function getMockSnapshot(): MockMode {
  return _mockMode;
}

/**
 * Simulate network delay for realistic mock behavior
 * @param ms Delay in milliseconds (default: 200-500ms random)
 */
export function mockDelay(ms?: number): Promise<void> {
  const delay = ms ?? Math.floor(Math.random() * 300) + 200;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Log mock mode status in development
if (import.meta.env.DEV) {
  logger.info(EVENTS.MOCK_MODE_CHANGED, { mode: DEFAULT_MODE, initial: true });
}
