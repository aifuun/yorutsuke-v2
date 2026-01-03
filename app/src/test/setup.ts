/// <reference types="vitest/globals" />
// Test setup file for Vitest
import '@testing-library/jest-dom/vitest';

// Mock Tauri APIs for testing
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn(),
  },
}));

// Mock environment variables
vi.stubEnv('VITE_LAMBDA_PRESIGN_URL', 'https://mock.lambda/presign');
vi.stubEnv('VITE_LAMBDA_QUOTA_URL', 'https://mock.lambda/quota');
