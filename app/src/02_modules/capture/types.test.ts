import { describe, it, expect } from 'vitest';
import { ALLOWED_EXTENSIONS } from './types';

/**
 * Helper to check if file extension is allowed
 */
function isExtensionAllowed(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number]);
}

describe('capture/types', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    // SC-010: Valid formats accepted
    it('accepts JPG files', () => {
      expect(isExtensionAllowed('receipt.jpg')).toBe(true);
      expect(isExtensionAllowed('receipt.JPG')).toBe(true);
      expect(isExtensionAllowed('RECEIPT.jpeg')).toBe(true);
    });

    it('accepts PNG files', () => {
      expect(isExtensionAllowed('receipt.png')).toBe(true);
      expect(isExtensionAllowed('receipt.PNG')).toBe(true);
    });

    it('accepts WebP files', () => {
      expect(isExtensionAllowed('receipt.webp')).toBe(true);
    });

    // HEIC not supported - Rust image crate lacks native support
    it('rejects HEIC files (not supported)', () => {
      expect(isExtensionAllowed('receipt.heic')).toBe(false);
      expect(isExtensionAllowed('receipt.heif')).toBe(false);
    });

    // SC-011: Invalid formats rejected
    it('rejects text files', () => {
      expect(isExtensionAllowed('document.txt')).toBe(false);
    });

    it('rejects PDF files', () => {
      expect(isExtensionAllowed('document.pdf')).toBe(false);
    });

    it('rejects other document formats', () => {
      expect(isExtensionAllowed('document.doc')).toBe(false);
      expect(isExtensionAllowed('document.docx')).toBe(false);
      expect(isExtensionAllowed('spreadsheet.xlsx')).toBe(false);
    });

    it('rejects video files', () => {
      expect(isExtensionAllowed('video.mp4')).toBe(false);
      expect(isExtensionAllowed('video.mov')).toBe(false);
    });

    it('rejects files without extension', () => {
      expect(isExtensionAllowed('noextension')).toBe(false);
    });

    it('includes all expected formats', () => {
      expect(ALLOWED_EXTENSIONS).toContain('jpg');
      expect(ALLOWED_EXTENSIONS).toContain('jpeg');
      expect(ALLOWED_EXTENSIONS).toContain('png');
      expect(ALLOWED_EXTENSIONS).toContain('webp');
      // HEIC/HEIF not supported
      expect(ALLOWED_EXTENSIONS).not.toContain('heic');
      expect(ALLOWED_EXTENSIONS).not.toContain('heif');
    });
  });
});
