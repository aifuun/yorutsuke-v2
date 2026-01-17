/**
 * Admin API Client with Cognito Authentication
 *
 * Uses Cognito ID tokens to authenticate API requests.
 */

// API configuration from environment
const API_URL = import.meta.env.VITE_ADMIN_API_URL || '';

// Token getter function - will be set by AuthProvider
let getTokenFn: (() => Promise<string | null>) | null = null;

/**
 * Set the token getter function (called by AuthProvider)
 */
export function setTokenGetter(fn: () => Promise<string | null>): void {
  getTokenFn = fn;
}

/**
 * Check if API is configured
 */
export function isConfigured(): boolean {
  return Boolean(API_URL);
}

/**
 * Make an authenticated API request
 */
async function authFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getTokenFn ? await getTokenFn() : null;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': token,
    ...(options.headers as Record<string, string>),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * API client with typed methods
 */
export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await authFetch(endpoint);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }
    return response.json();
  },

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await authFetch(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }
    return response.json();
  },
};

/**
 * API endpoints
 */
export const endpoints = {
  stats: '/stats',
  control: '/control',
  costs: '/costs',
  batch: '/batch',
  batchConfig: '/batch/config',
  modelConfig: '/model/config', // Issue #149: Dynamic model configuration
};
