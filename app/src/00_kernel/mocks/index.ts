// Centralized mock data exports (Pillar C)
//
// This module provides two categories of mock functions:
//
// 1. mockOnline.ts - Successful API responses for "online" mock mode
// 2. mockOffline.ts - Error scenarios for "offline" mock mode
//
// Usage in adapters:
//   import { mockPresignUrl, mockNetworkError } from '00_kernel/mocks';
//   if (isMockingOffline()) throw mockNetworkError();
//   if (isMockingOnline()) return mockPresignUrl(userId, fileName);

// Online mode - successful responses
export {
  mockPresignUrl,
  mockQuotaData,
  mockAdminDeleteData,
  mockTransactionPull,
  mockBatchConfig,
} from './mockOnline';

// Offline mode - error scenarios
export {
  mockNetworkError,
  mockTimeoutError,
  mockServerError,
  mockAuthError,
  mockRateLimitError,
  mockValidationError,
  mockNotFoundError,
} from './mockOffline';
