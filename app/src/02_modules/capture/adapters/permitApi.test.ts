/**
 * Unit tests for permitApi
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPermit } from './permitApi';
import * as mockConfig from '../../../00_kernel/config/mock';

// Mock Tauri HTTP
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

describe('permitApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPermit()', () => {
    it('should return mock permit in online mock mode', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      const permit = await fetchPermit('device-test-123' as any);

      expect(permit).toBeDefined();
      expect(permit.userId).toBe('device-test-123');
      expect(permit.tier).toBe('guest');
      expect(permit.totalLimit).toBe(500);
      expect(permit.dailyRate).toBe(30);
      expect(permit.signature).toHaveLength(64);
      expect(permit.expiresAt).toBeDefined();
      expect(permit.issuedAt).toBeDefined();
    });

    it('should throw error in offline mock mode', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      await expect(fetchPermit('device-test-123' as any)).rejects.toThrow(
        'Network error'
      );
    });

    it('should return guest tier for device- prefix', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      const permit = await fetchPermit('device-abc-123' as any);

      expect(permit.tier).toBe('guest');
      expect(permit.totalLimit).toBe(500);
      expect(permit.dailyRate).toBe(30);
    });

    it('should return free tier for user- prefix', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      const permit = await fetchPermit('user-xyz-789' as any);

      expect(permit.tier).toBe('free');
      expect(permit.totalLimit).toBe(1000);
      expect(permit.dailyRate).toBe(50);
    });

    it('should accept custom validDays parameter', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      const permit = await fetchPermit('device-test-123' as any, 60);

      expect(permit).toBeDefined();
      // Check expiresAt is approximately 60 days from now
      const expiryTime = new Date(permit.expiresAt).getTime();
      const expectedTime = Date.now() + 60 * 24 * 60 * 60 * 1000;
      const diff = Math.abs(expiryTime - expectedTime);
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });

    it('should have valid ISO 8601 timestamps', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      const permit = await fetchPermit('device-test-123' as any);

      // Test issuedAt format
      expect(permit.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Test expiresAt format
      expect(permit.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Test dates are valid
      expect(new Date(permit.issuedAt).getTime()).not.toBeNaN();
      expect(new Date(permit.expiresAt).getTime()).not.toBeNaN();

      // Test expiresAt is in the future
      expect(new Date(permit.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should have 64-character signature', async () => {
      vi.spyOn(mockConfig, 'isMockingOnline').mockReturnValue(true);
      vi.spyOn(mockConfig, 'isMockingOffline').mockReturnValue(false);
      vi.spyOn(mockConfig, 'mockDelay').mockResolvedValue(undefined);

      const permit = await fetchPermit('device-test-123' as any);

      expect(permit.signature).toHaveLength(64);
      expect(permit.signature).toMatch(/^[a-z0-9-]+$/); // Hex or mock format
    });
  });
});
