// Mock mode configuration for UI development
// When enabled, API calls return mock data instead of hitting real backends

/**
 * Mock mode is enabled when:
 * 1. VITE_USE_MOCK=true (explicit), or
 * 2. No Lambda URLs are configured (implicit)
 */
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  (!import.meta.env.VITE_LAMBDA_PRESIGN_URL &&
   !import.meta.env.VITE_LAMBDA_QUOTA_URL &&
   !import.meta.env.VITE_LAMBDA_CONFIG_URL);

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
  console.log(`[Mock] Mode: ${USE_MOCK ? 'ENABLED' : 'DISABLED'}`);
}
