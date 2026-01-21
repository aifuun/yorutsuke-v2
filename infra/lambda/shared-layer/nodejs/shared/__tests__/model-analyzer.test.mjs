/**
 * Unit Tests for Model Analyzer - Tax Fields (Issue #155)
 *
 * Tests cover:
 * - validateTaxInfo() - Tax data integrity validation
 * - convertModelResultToOcrResult() - Tax field passing
 * - Tax rate verification (8% or 10% for Japan)
 * - Amount reconciliation (total = subtotal + tax)
 */

import { describe, it, expect } from 'vitest';
import { validateTaxInfo, convertModelResultToOcrResult } from '../model-analyzer.mjs';

// ============================================================
// Test Suite 1: validateTaxInfo() - Tax Validation
// ============================================================

describe('validateTaxInfo() - Tax Data Validation', () => {
  describe('Valid tax data', () => {
    it('should pass validation for complete valid tax data (10% rate)', () => {
      const result = validateTaxInfo(1100, 1000, 100, 10);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should pass validation for complete valid tax data (8% rate)', () => {
      const result = validateTaxInfo(1080, 1000, 80, 8);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept ±1 JPY rounding tolerance', () => {
      // 1000 + 100 = 1100, but got 1101 (off by 1)
      const result = validateTaxInfo(1101, 1000, 100, 10);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept ±1 JPY rounding tolerance (under)', () => {
      // 1000 + 100 = 1100, but got 1099 (off by 1)
      const result = validateTaxInfo(1099, 1000, 100, 10);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Tax amount validation', () => {
    it('should warn when total != subtotal + tax', () => {
      // 1000 + 100 = 1100, but got 1200
      const result = validateTaxInfo(1200, 1000, 100, 10);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('TAX_AMOUNT_MISMATCH');
      expect(result.warnings[0].severity).toBe('warn');
    });

    it('should warn with detailed mismatch message', () => {
      const result = validateTaxInfo(1150, 1000, 100, 10);
      expect(result.warnings[0].message).toContain('¥1150');
      expect(result.warnings[0].message).toContain('¥1000');
      expect(result.warnings[0].message).toContain('¥100');
    });
  });

  describe('Tax rate validation', () => {
    it('should warn on invalid tax rate (too low)', () => {
      const result = validateTaxInfo(1050, 1000, 50, 5);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'INVALID_TAX_RATE')).toBe(true);
    });

    it('should warn on invalid tax rate (too high)', () => {
      const result = validateTaxInfo(1200, 1000, 200, 20);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'INVALID_TAX_RATE')).toBe(true);
    });

    it('should warn on invalid tax rate (0%)', () => {
      const result = validateTaxInfo(1000, 1000, 0, 0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'INVALID_TAX_RATE')).toBe(true);
    });

    it('should accept 8% rate', () => {
      const result = validateTaxInfo(1080, 1000, 80, 8);
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept 10% rate', () => {
      const result = validateTaxInfo(1100, 1000, 100, 10);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Tax rate calculation validation', () => {
    it('should warn when calculated tax != actual tax at given rate', () => {
      // For ¥1000 at 10%, expected tax is ¥100, but got ¥110
      const result = validateTaxInfo(1110, 1000, 110, 10);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'TAX_RATE_MISMATCH')).toBe(true);
    });

    it('should verify 8% calculation', () => {
      // For ¥1000 at 8%, expected tax is ¥80
      const result = validateTaxInfo(1080, 1000, 80, 8);
      expect(result.warnings).toHaveLength(0);
    });

    it('should verify 10% calculation', () => {
      // For ¥1000 at 10%, expected tax is ¥100
      const result = validateTaxInfo(1100, 1000, 100, 10);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Missing data handling', () => {
    it('should skip validation if all tax fields are undefined', () => {
      const result = validateTaxInfo(1000, undefined, undefined, undefined);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation if no subtotal provided', () => {
      const result = validateTaxInfo(1100, undefined, 100, 10);
      expect(result.valid).toBe(true);
      // No TAX_AMOUNT_MISMATCH warning
      expect(result.warnings.some(w => w.code === 'TAX_AMOUNT_MISMATCH')).toBe(false);
    });

    it('should skip tax rate calculation if no tax amount', () => {
      const result = validateTaxInfo(1100, 1000, undefined, 10);
      expect(result.valid).toBe(true);
      // No TAX_RATE_MISMATCH warning
      expect(result.warnings.some(w => w.code === 'TAX_RATE_MISMATCH')).toBe(false);
    });

    it('should allow null amount with tax info', () => {
      const result = validateTaxInfo(undefined, 1000, 100, 10);
      expect(result.valid).toBe(true);
      // No TAX_AMOUNT_MISMATCH (amount is missing)
      expect(result.warnings.some(w => w.code === 'TAX_AMOUNT_MISMATCH')).toBe(false);
    });
  });

  describe('Real world scenarios', () => {
    it('KFC receipt scenario (10% tax)', () => {
      // Real CloudWatch log example
      const result = validateTaxInfo(1950, 1950, 177, 10);
      // Note: totalAmount includes tax in Azure DI response, so subtotal = total in this case
      expect(result.valid).toBe(true);
    });

    it('Big-A supermarket scenario (8% tax)', () => {
      // Real CloudWatch log example
      const result = validateTaxInfo(1150, 1065, 85, 8);
      // 1065 + 85 = 1150 ✓
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('Zero tax scenario (tax-free item)', () => {
      const result = validateTaxInfo(1000, 1000, 0, 0);
      // Should warn about invalid rate (0%)
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'INVALID_TAX_RATE')).toBe(true);
    });
  });
});

// ============================================================
// Test Suite 2: convertModelResultToOcrResult() - Tax Field Passing
// ============================================================

describe('convertModelResultToOcrResult() - Tax Fields', () => {
  it('should include tax fields in OCR result when provided', () => {
    const modelResult = {
      vendor: 'KFC',
      totalAmount: 1100,
      subtotal: 1000,
      taxAmount: 100,
      taxRate: 10,
      transactionDate: '2026-01-20',
    };

    const result = convertModelResultToOcrResult(modelResult);

    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(100);
    expect(result.taxRate).toBe(10);
  });

  it('should pass undefined tax fields when not provided', () => {
    const modelResult = {
      vendor: 'Supermarket',
      totalAmount: 1000,
      transactionDate: '2026-01-20',
    };

    const result = convertModelResultToOcrResult(modelResult);

    expect(result.subtotal).toBeUndefined();
    expect(result.taxAmount).toBeUndefined();
    expect(result.taxRate).toBeUndefined();
  });

  it('should preserve other OCR fields when adding tax fields', () => {
    const modelResult = {
      vendor: 'Store A',
      totalAmount: 1100,
      subtotal: 1000,
      taxAmount: 100,
      taxRate: 10,
      transactionDate: '2026-01-20',
      lineItems: [
        { description: 'Item 1', totalPrice: 500 },
        { description: 'Item 2', totalPrice: 500 },
      ],
    };

    const result = convertModelResultToOcrResult(modelResult);

    // Verify other fields intact
    expect(result.amount).toBe(1100);
    expect(result.type).toBe('expense');
    expect(result.date).toBe('2026-01-20');
    expect(result.merchant).toBe('Store A');
    expect(result.category).toBe('other');

    // Verify tax fields
    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(100);
    expect(result.taxRate).toBe(10);
  });

  it('should use totalAmount when subtotal is not provided', () => {
    const modelResult = {
      vendor: 'Store B',
      totalAmount: 1100,
      transactionDate: '2026-01-20',
    };

    const result = convertModelResultToOcrResult(modelResult);

    expect(result.amount).toBe(1100);
    expect(result.subtotal).toBeUndefined();
  });

  it('should handle partial tax information', () => {
    const modelResult = {
      vendor: 'Store C',
      totalAmount: 1100,
      subtotal: 1000,
      // taxAmount not provided
      // taxRate not provided
      transactionDate: '2026-01-20',
    };

    const result = convertModelResultToOcrResult(modelResult);

    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBeUndefined();
    expect(result.taxRate).toBeUndefined();
  });

  it('should handle mixed null and undefined tax fields', () => {
    const modelResult = {
      vendor: 'Store D',
      totalAmount: 1100,
      subtotal: null,
      taxAmount: 100,
      taxRate: undefined,
      transactionDate: '2026-01-20',
    };

    const result = convertModelResultToOcrResult(modelResult);

    expect(result.subtotal).toBeNull();
    expect(result.taxAmount).toBe(100);
    expect(result.taxRate).toBeUndefined();
  });
});
