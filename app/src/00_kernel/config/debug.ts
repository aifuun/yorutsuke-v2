// Debug panel configuration from environment variable
// Configure via .env.local (gitignored)
// Example: VITE_DEBUG_PANEL=true

/**
 * Check if debug panel should be shown
 *
 * Rules:
 * - Production builds: Always disabled (security)
 * - Development builds: Controlled by VITE_DEBUG_PANEL environment variable
 *   - VITE_DEBUG_PANEL=true → Show debug panel
 *   - VITE_DEBUG_PANEL=false (or undefined) → Hide debug panel
 *
 * Configuration:
 * Add to .env.local (gitignored, per-developer settings):
 *   VITE_DEBUG_PANEL=true
 */
export function isDebugEnabled(): boolean {
  // Production: always disabled
  if (import.meta.env.PROD) {
    return false;
  }

  // Development: check environment variable
  return import.meta.env.VITE_DEBUG_PANEL === 'true';
}

/**
 * Load debug configuration (no-op, kept for API compatibility)
 * Configuration is compile-time via Vite env vars, no async loading needed
 */
export async function loadDebugConfig(): Promise<void> {
  // No-op: Vite environment variables are resolved at compile time
  // Kept for backwards compatibility with existing code
  return Promise.resolve();
}

/**
 * Get debug snapshot for React (useSyncExternalStore)
 */
export function getDebugSnapshot(): boolean {
  return isDebugEnabled();
}

/**
 * Subscribe to debug config changes (no-op, as config is compile-time)
 * Provided for consistency with other config modules
 */
export function subscribeDebugConfig(_listener: () => void): () => void {
  // Debug config doesn't change at runtime (compile-time constant)
  // Return no-op cleanup function
  return () => {};
}
