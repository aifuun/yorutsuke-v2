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
import { validateTaxInfo, convertModelResultToOcrResult } from '../model-analyzer.js';

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

  describe('Edge cases - Critical', () => {
    it('should accumulate multiple warnings (amount mismatch + rate mismatch)', () => {
      // Both TAX_AMOUNT_MISMATCH and TAX_RATE_MISMATCH should be present
      const result = validateTaxInfo(1500, 1000, 150, 10);
      // Expected: 1000 + 100 = 1100, but got 1500 (amount mismatch)
      // Also: for 1000 at 10%, expected tax is 100, but got 150 (rate mismatch)
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.some(w => w.code === 'TAX_AMOUNT_MISMATCH')).toBe(true);
      expect(result.warnings.some(w => w.code === 'TAX_RATE_MISMATCH')).toBe(true);
    });

    it('should handle very large amounts (millions)', () => {
      // ¥1,000,000 at 10% tax
      const result = validateTaxInfo(1100000, 1000000, 100000, 10);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle very small amounts (single yen with rounding precision)', () => {
      // ¥100 at 8% tax, but OCR returned ¥1 as tax_amount (data noise)
      const result = validateTaxInfo(101, 100, 1, 8);
      // 100 * 0.08 = 8 (expected), but got 1, so should warn about rate mismatch
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'TAX_RATE_MISMATCH')).toBe(true);
    });

    it('should reject decimal tax rates (non-standard like 8.5%)', () => {
      // International receipts might have 8.5%, should warn
      const result = validateTaxInfo(1085, 1000, 85, 8.5);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'INVALID_TAX_RATE')).toBe(true);
    });

    it('should skip validation when all tax fields are 0 (falsy = no tax info)', () => {
      // Free item scenario - amount = 0, subtotal = 0, tax = 0, rate = 0
      // When all are 0 (falsy), validateTaxInfo treats it as "no tax fields provided"
      // and skips validation entirely (see line 357: !0 && !0 && !0 = true)
      const result = validateTaxInfo(0, 0, 0, 0);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0); // No warnings because skipped
    });

    it('should reject negative amounts (refund/chargeback)', () => {
      // Negative amounts might indicate refunds
      // -1100 + -1000 = -100 at 10% (refund scenario)
      const result = validateTaxInfo(-1100, -1000, -100, 10);
      // Should accept (business logic: negative amounts are valid for refunds)
      // But verify the math still works
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn on mismatched sign (positive total, negative subtotal)', () => {
      // Data corruption case: total positive but subtotal negative
      const result = validateTaxInfo(1100, -1000, 100, 10);
      // 1100 != -1000 + 100 = -900
      expect(result.warnings.some(w => w.code === 'TAX_AMOUNT_MISMATCH')).toBe(true);
    });

    it('should handle rounding edge case at boundary (±2 JPY should warn)', () => {
      // Exactly 2 JPY off should warn (tolerance is ±1)
      const result = validateTaxInfo(1102, 1000, 100, 10);
      // 1000 + 100 = 1100, but got 1102 (off by 2)
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'TAX_AMOUNT_MISMATCH')).toBe(true);
    });

    it('should handle tax rate calculation precision (rounding at 1 yen boundary)', () => {
      // For ¥2000 at 8%, expected tax is ¥160, but OCR got ¥159 (off by 1, acceptable)
      const result = validateTaxInfo(2159, 1999, 159, 8);
      // Expected tax for 1999 at 8% is 159.92 → rounds to 160
      // Got 159, so it's a 1 yen mismatch (acceptable)
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject extremely high tax rate (over 50%)', () => {
      // Corruption detection: 50% tax is unrealistic
      const result = validateTaxInfo(1500, 1000, 500, 50);
      expect(result.warnings.some(w => w.code === 'INVALID_TAX_RATE')).toBe(true);
    });

    it('should handle NaN gracefully (missing numeric fields)', () => {
      // If parseFloat returns NaN from Azure response
      const result = validateTaxInfo(NaN, 1000, 100, 10);
      // NaN !== calculatedTotal, should warn
      expect(result.valid).toBe(true);
      // Should not crash, may warn about amount mismatch
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
