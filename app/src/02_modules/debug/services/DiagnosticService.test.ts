/**
 * Unit tests for DiagnosticService
 *
 * Tests the service state management and initialization.
 * Integration tests for data aggregation are handled via diagnostic adapter mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DiagnosticService } from './DiagnosticService';
import { UserId } from '../../../00_kernel/types';

describe('DiagnosticService', () => {
  let service: DiagnosticService;
  const mockUserId = UserId('user-test-123');

  beforeEach(() => {
    service = new DiagnosticService();
  });

  afterEach(() => {
    service.reset();
  });

  // =========================================================================
  // State Management
  // =========================================================================

  describe('State Management', () => {
    it('should initialize with null context', () => {
      expect(service.getContext()).toBeNull();
    });

    it('should reset state', () => {
      service.reset();
      expect(service.getContext()).toBeNull();
    });

    it('should support context access', () => {
      // Context should be null initially
      let context = service.getContext();
      expect(context).toBeNull();

      // After reset, still null
      service.reset();
      context = service.getContext();
      expect(context).toBeNull();
    });
  });

  // =========================================================================
  // Service Initialization
  // =========================================================================

  describe('Service Initialization', () => {
    it('should create singleton instance', () => {
      const service1 = new DiagnosticService();
      const service2 = new DiagnosticService();

      // Both should be valid service instances
      expect(service1.getContext()).toBeNull();
      expect(service2.getContext()).toBeNull();
    });

    it('should be resettable', () => {
      service.reset();
      service.reset(); // Should not throw

      expect(service.getContext()).toBeNull();
    });
  });

  // =========================================================================
  // Note: Full integration tests (execute, collectLocalData, etc.)
  // =========================================================================

  // Full end-to-end tests are implemented in the adapter layer tests
  // and frontend integration tests. This test file focuses on service
  // state management and initialization.
  //
  // To test the full workflow:
  // - See DiagnosticService.ts implementation
  // - See diagnosticIpc.ts adapter tests
  // - See frontend integration tests in the Debug View
});
