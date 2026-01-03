import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminalState,
  isUploadable,
  needsRetry,
  shouldCompress,
  canUpload,
  MIN_UPLOAD_INTERVAL_MS,
} from './rules';
import type { ImageStatus } from './types';

describe('receipt/rules', () => {
  describe('canTransition', () => {
    it('allows pending → compressed', () => {
      expect(canTransition('pending', 'compressed')).toBe(true);
    });

    it('allows pending → failed', () => {
      expect(canTransition('pending', 'failed')).toBe(true);
    });

    it('disallows pending → uploaded (skip compressed)', () => {
      expect(canTransition('pending', 'uploaded')).toBe(false);
    });

    it('allows compressed → uploading', () => {
      expect(canTransition('compressed', 'uploading')).toBe(true);
    });

    it('allows uploading → uploaded', () => {
      expect(canTransition('uploading', 'uploaded')).toBe(true);
    });

    it('allows failed → pending (retry)', () => {
      expect(canTransition('failed', 'pending')).toBe(true);
    });

    it('disallows confirmed → any state', () => {
      const states: ImageStatus[] = [
        'pending', 'compressed', 'uploading', 'uploaded',
        'processing', 'processed', 'failed'
      ];
      states.forEach(state => {
        expect(canTransition('confirmed', state)).toBe(false);
      });
    });
  });

  describe('isTerminalState', () => {
    it('returns true for confirmed', () => {
      expect(isTerminalState('confirmed')).toBe(true);
    });

    it('returns true for failed', () => {
      expect(isTerminalState('failed')).toBe(true);
    });

    it('returns false for pending', () => {
      expect(isTerminalState('pending')).toBe(false);
    });

    it('returns false for uploading', () => {
      expect(isTerminalState('uploading')).toBe(false);
    });
  });

  describe('isUploadable', () => {
    it('returns true for compressed', () => {
      expect(isUploadable('compressed')).toBe(true);
    });

    it('returns false for pending', () => {
      expect(isUploadable('pending')).toBe(false);
    });

    it('returns false for uploading', () => {
      expect(isUploadable('uploading')).toBe(false);
    });

    it('returns false for uploaded', () => {
      expect(isUploadable('uploaded')).toBe(false);
    });
  });

  describe('needsRetry', () => {
    it('returns true for failed', () => {
      expect(needsRetry('failed')).toBe(true);
    });

    it('returns false for confirmed', () => {
      expect(needsRetry('confirmed')).toBe(false);
    });

    it('returns false for pending', () => {
      expect(needsRetry('pending')).toBe(false);
    });
  });

  describe('shouldCompress', () => {
    it('returns true for files > 100KB', () => {
      expect(shouldCompress(150 * 1024)).toBe(true);
    });

    it('returns false for files <= 100KB', () => {
      expect(shouldCompress(100 * 1024)).toBe(false);
    });

    it('returns false for small files', () => {
      expect(shouldCompress(50 * 1024)).toBe(false);
    });
  });

  describe('canUpload', () => {
    it('allows upload when under limit and no recent upload', () => {
      const result = canUpload(5, 30, null);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('denies upload when limit reached', () => {
      const result = canUpload(30, 30, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily limit reached');
    });

    it('denies upload when over limit', () => {
      const result = canUpload(35, 30, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily limit reached');
    });

    it('denies upload when too soon after last upload', () => {
      const now = Date.now();
      const result = canUpload(5, 30, now - 500); // 500ms ago
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Please wait');
    });

    it('allows upload after interval has passed', () => {
      const now = Date.now();
      const result = canUpload(5, 30, now - MIN_UPLOAD_INTERVAL_MS - 100);
      expect(result.allowed).toBe(true);
    });

    it('respects different tier limits', () => {
      // Guest tier (30)
      expect(canUpload(29, 30, null).allowed).toBe(true);
      expect(canUpload(30, 30, null).allowed).toBe(false);

      // Pro tier (300)
      expect(canUpload(299, 300, null).allowed).toBe(true);
      expect(canUpload(300, 300, null).allowed).toBe(false);
    });
  });
});
