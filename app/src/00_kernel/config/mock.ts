// Mock mode configuration for UI development
// When enabled, API calls return mock data instead of hitting real backends
import { dlog } from '../../02_modules/debug/headless/debugLog';

const TAG = 'Mock';

/**
 * Initial mock mode is enabled when:
 * 1. VITE_USE_MOCK=true (explicit), or
 * 2. No Lambda URLs are configured (implicit)
 */
const INITIAL_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  (!import.meta.env.VITE_LAMBDA_PRESIGN_URL &&
   !import.meta.env.VITE_LAMBDA_QUOTA_URL &&
   !import.meta.env.VITE_LAMBDA_CONFIG_URL);

// Runtime mock state
let _mockEnabled = INITIAL_MOCK;
const _listeners = new Set<() => void>();

/**
 * Check if mock mode is currently enabled
 */
export function isMockEnabled(): boolean {
  return _mockEnabled;
}

/**
 * For backwards compatibility - use isMockEnabled() for reactive checks
 */
export const USE_MOCK = INITIAL_MOCK;

/**
 * Toggle mock mode at runtime
 */
export function setMockEnabled(enabled: boolean): void {
  _mockEnabled = enabled;
  _listeners.forEach(listener => listener());
  dlog.info(TAG, enabled ? 'Enabled' : 'Disabled');
}

/**
 * Subscribe to mock mode changes
 */
export function subscribeMockMode(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Get current mock state (for useSyncExternalStore)
 */
export function getMockSnapshot(): boolean {
  return _mockEnabled;
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
  dlog.info(TAG, INITIAL_MOCK ? 'Enabled (initial)' : 'Disabled (initial)');
}
