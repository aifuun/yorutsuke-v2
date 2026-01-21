import { logger } from "./logger.mjs";
import { ModelResultSchema, OcrResultSchema } from "./schemas.mjs";

/**
 * Azure Document Intelligence Receipt Analyzer
 * Standalone functions for receipt analysis via Azure DI
 *
 * @ai-intent: Simplified from MultiModelAnalyzer class - single model only
 */

/**
 * Analyze receipt via Azure Document Intelligence
 * @param {string} imageBase64 - Base64-encoded receipt image
 * @param {string} traceId - Trace ID for logging
 * @param {Object} credentials - Azure credentials {endpoint, apiKey}
 * @returns {Promise<Object>} ModelResultSchema-compliant result
 */
export async function analyzeAzureDI(imageBase64, traceId, credentials) {
  try {
    const endpoint = credentials?.endpoint?.replace(/\/$/, ''); // Remove trailing slash
    const apiKey = credentials?.apiKey;

    if (!endpoint || !apiKey) {
      throw new Error("Azure DI credentials not provided");
    }

    logger.debug("AZURE_DI_REQUEST_START", {
      traceId,
      endpoint,
      method: "base64-encoded-image",
    });

    // Step 1: Submit analysis request using Base64-encoded image (v4.0 API)
    const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=2024-11-30`;

    const analyzeResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      body: Buffer.from(imageBase64, "base64"),
    });

    if (!analyzeResponse.ok) {
      const errorBody = await analyzeResponse.text();
      throw new Error(`Azure API error (${analyzeResponse.status}): ${errorBody}`);
    }

    // Get Operation-Location header for polling
    const operationLocation = analyzeResponse.headers.get("Operation-Location");
    if (!operationLocation) {
      throw new Error("No Operation-Location header in response");
    }

    logger.debug("AZURE_DI_ANALYSIS_SUBMITTED", {
      traceId,
      operationLocation: operationLocation.substring(0, 100),
    });

    // Step 2: Poll for analysis results
    let analyzeResult = null;
    const maxRetries = 30;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      const statusResponse = await fetch(operationLocation, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed (${statusResponse.status})`);
      }

      const statusData = await statusResponse.json();

      if (statusData.status === "succeeded") {
        analyzeResult = statusData.analyzeResult;
        logger.debug("AZURE_DI_RESPONSE_RECEIVED", {
          traceId,
          hasDocuments: !!analyzeResult?.documents?.length,
        });
        break;
      } else if (statusData.status === "failed") {
        throw new Error(`Analysis failed: ${statusData.error?.message || "Unknown error"}`);
      }
      // Continue polling if status is "notStarted" or "running"
    }

    if (!analyzeResult) {
      throw new Error("Analysis polling timeout after 30 seconds");
    }

    return normalizeAzureDIResult(analyzeResult);
  } catch (error) {
    logger.error("AZURE_DI_ERROR", {
      traceId,
      error: error.message,
    });
    throw new Error(`Azure Document Intelligence analysis failed: ${error.message}`);
  }
}

/**
 * Normalize Azure Document Intelligence response to ModelResultSchema
 * Extracts fields from prebuilt-receipt model
 * @param {Object} analyzeResult - The analyzeResult object from Azure API response
 * @returns {Object} ModelResultSchema-compliant result
 */
function normalizeAzureDIResult(analyzeResult) {
  try {
    if (!analyzeResult?.documents?.[0]) {
      logger.warn("AZURE_DI_NO_DOCUMENTS", {
        keys: analyzeResult ? Object.keys(analyzeResult) : "no result",
      });
      return ModelResultSchema.parse({});
    }

    const doc = analyzeResult.documents[0];
    const fields = doc.fields || {};

    // 🔍 DEBUG: Log available field names to identify correct ones
    logger.debug("AZURE_DI_AVAILABLE_FIELDS", {
      fieldNames: Object.keys(fields),
      hasTotal: !!fields.Total,
      hasTotalAmount: !!fields.TotalAmount,
      hasInvoiceTotal: !!fields.InvoiceTotal,
      hasReceiptTotal: !!fields.ReceiptTotal,
      hasSubtotal: !!fields.Subtotal,
      hasSubtotalAmount: !!fields.SubtotalAmount,
      hasSubTotal: !!fields.SubTotal,
    });

    // 🔍 DEBUG: Log the actual content of Total field to see structure
    if (fields.Total) {
      logger.debug("AZURE_DI_TOTAL_FIELD_CONTENT", {
        totalField: JSON.stringify(fields.Total),
        hasValueNumber: fields.Total.valueNumber !== undefined,
        hasValueString: fields.Total.valueString !== undefined,
        valueCurrency: fields.Total.valueCurrency,
        type: fields.Total.type,
      });
    }

    const result = {
      vendor: fields.MerchantName?.valueString || fields.VendorName?.valueString || "Unknown",
      // Try all known total field names (different models use different names)
      totalAmount:
        parseAzureAmount(fields.Total) ||
        parseAzureAmount(fields.TotalAmount) ||
        parseAzureAmount(fields.InvoiceTotal) ||
        parseAzureAmount(fields.ReceiptTotal),
      taxAmount: parseAzureAmount(fields.Tax) || parseAzureAmount(fields.TotalTax),
      // Try all known subtotal field names (note: SubTotal has capital T)
      subtotal:
        parseAzureAmount(fields.Subtotal) ||
        parseAzureAmount(fields.SubtotalAmount) ||
        parseAzureAmount(fields.SubTotal),
      taxRate: parseAzureAmount(fields.TaxRate),
      // Extract transaction date (format: YYYY-MM-DD or valueDate object)
      transactionDate: parseAzureDate(fields.TransactionDate),
      confidence: calculateAzureConfidence(fields),
      lineItems: extractAzureLineItems(fields.Items),
    };

    logger.debug("AZURE_DI_EXTRACTED_RESULT", {
      vendor: result.vendor,
      totalAmount: result.totalAmount,
      subtotal: result.subtotal,
      taxAmount: result.taxAmount,
      taxRate: result.taxRate,
      transactionDate: result.transactionDate,
      confidence: result.confidence,
      lineItemCount: result.lineItems?.length || 0,
      extractionSuccess: {
        hasTotal: result.totalAmount !== undefined,
        hasSubtotal: result.subtotal !== undefined,
        hasTax: result.taxAmount !== undefined,
        hasDate: result.transactionDate !== undefined,
      },
    });

    return ModelResultSchema.parse(result);
  } catch (error) {
    logger.warn("AZURE_DI_NORMALIZATION_ERROR", {
      error: error.message,
    });
    return ModelResultSchema.parse({});
  }
}

/**
 * Parse amount field from Azure response
 * Azure DI v4.0 uses:
 * - valueCurrency.amount for currency fields (e.g., Total, TotalTax)
 * - valueNumber for numeric fields
 * - valueString for string representation
 */
function parseAzureAmount(field) {
  if (!field) return undefined;

  // Try valueCurrency.amount first (used for currency fields like Total)
  if (field.valueCurrency && typeof field.valueCurrency.amount === "number") {
    return field.valueCurrency.amount;
  }

  // Try valueNumber (used for non-currency numeric fields)
  if (typeof field.valueNumber === "number") {
    return field.valueNumber;
  }

  // Fall back to valueString if it contains a number
  const strValue = field.valueString;
  if (typeof strValue === "string") {
    const match = strValue.match(/[\d,]+(?:\.\d{1,2})?/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, ""));
    }
  }

  return undefined;
}

/**
 * Parse date field from Azure response
 * Azure DI v4.0 uses:
 * - valueDate for date fields (returns ISO 8601 format: YYYY-MM-DD)
 * - valueString as fallback (may need parsing)
 */
function parseAzureDate(field) {
  if (!field) return undefined;

  // Try valueDate first (ISO 8601 format: YYYY-MM-DD)
  if (field.valueDate && typeof field.valueDate === "string") {
    return field.valueDate;
  }

  // Fall back to valueString if it contains a date
  const strValue = field.valueString;
  if (typeof strValue === "string") {
    // Try to parse various date formats
    // Azure might return: "2026-01-20", "2026/01/20", "20/01/2026", etc.
    const isoMatch = strValue.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Try DD/MM/YYYY or MM/DD/YYYY format
    const slashMatch = strValue.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, '0');
      const month = slashMatch[2].padStart(2, '0');
      const year = slashMatch[3];
      // Assume DD/MM/YYYY for Japanese receipts
      return `${year}-${month}-${day}`;
    }
  }

  return undefined;
}

/**
 * Calculate average confidence from Azure field confidences
 */
function calculateAzureConfidence(fields) {
  const confidences = Object.values(fields)
    .filter((field) => field?.confidence !== undefined)
    .map((field) => field.confidence);

  if (confidences.length === 0) return undefined;

  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  // Convert to 0-100 scale (Azure uses 0-1)
  return Math.round(avgConfidence * 100);
}

/**
 * Extract line items from Azure Items field
 * @param {Object} itemsField - The Items field from Azure DI response
 * @returns {Array} Array of line items with description, quantity, prices
 */
function extractAzureLineItems(itemsField) {
  if (!itemsField?.valueArray) return [];

  return itemsField.valueArray
    .map((item) => {
      const properties = item.valueObject || {};
      return {
        description: properties.Description?.valueString || "",
        quantity: parseAzureAmount(properties.Quantity),
        unitPrice: parseAzureAmount(properties.Price),
        totalPrice: parseAzureAmount(properties.TotalPrice),
      };
    })
    .filter((item) => item.description); // Only include items with description
}

/**
 * Convert ModelResultSchema (from Azure DI) to OcrResultSchema
 * @ai-intent: Bridge Azure DI results to transaction creation format
 *
 * @param {Object} modelResult - Result from analyzeAzureDI
 * @returns {Object} OcrResultSchema-compliant object
 */
export function convertModelResultToOcrResult(modelResult) {
  // Default values
  const today = new Date().toISOString().split('T')[0];

  // Try totalAmount first, fall back to subtotal if available
  // @ai-intent: Don't use || 0 fallback - let validation fail if no amount found
  // This triggers unconfirmed status in instant-processor instead of silent 0
  const amount = modelResult.totalAmount ?? modelResult.subtotal ?? undefined;

  if (!amount && amount !== 0) {
    logger.warn('AZURE_DI_NO_AMOUNT_EXTRACTED', {
      totalAmount: modelResult.totalAmount,
      subtotal: modelResult.subtotal,
      vendor: modelResult.vendor,
    });
  }

  // Use transaction date from Azure DI if available, otherwise fall back to today
  const date = modelResult.transactionDate || today;

  return {
    amount: amount,
    type: 'expense', // Default to expense (receipts are typically expenses)
    date: date,
    merchant: modelResult.vendor || 'Unknown',
    category: 'other', // Default category, could be inferred from merchant/items
    description: modelResult.lineItems
      ? modelResult.lineItems.map(item => item.description).join(', ').substring(0, 100)
      : 'Azure DI processed receipt',
    // Tax fields (Issue #155) - Pass through from Azure DI extraction
    subtotal: modelResult.subtotal,
    taxAmount: modelResult.taxAmount,
    taxRate: modelResult.taxRate,
  };
}

/**
 * Validate tax information for data integrity (Issue #155)
 * @param {number|undefined} amount - Total amount
 * @param {number|undefined} subtotal - Pre-tax amount
 * @param {number|undefined} taxAmount - Tax amount
 * @param {number|undefined} taxRate - Tax rate (8 or 10)
 * @returns {Object} Validation result with warnings if any
 */
export function validateTaxInfo(amount, subtotal, taxAmount, taxRate) {
  const warnings = [];

  // Skip validation if no tax fields provided
  if (!subtotal && !taxAmount && !taxRate) {
    return { valid: true, warnings };
  }

  // 1. Verify total = subtotal + tax (allow ±1 JPY for rounding)
  if (subtotal && taxAmount && amount) {
    const calculatedTotal = subtotal + taxAmount;
    if (Math.abs(amount - calculatedTotal) > 1) {
      warnings.push({
        code: 'TAX_AMOUNT_MISMATCH',
        message: `Total amount (¥${amount}) does not match subtotal (¥${subtotal}) + tax (¥${taxAmount}) = ¥${calculatedTotal}`,
        severity: 'warn'
      });
    }
  }

  // 2. Verify tax rate is 8% or 10% (Japan consumption tax)
  if (taxRate && ![8, 10].includes(taxRate)) {
    warnings.push({
      code: 'INVALID_TAX_RATE',
      message: `Japan consumption tax should be 8% or 10%, got ${taxRate}%`,
      severity: 'warn'
    });
  }

  // 3. Verify calculated tax rate matches expected rate
  if (subtotal && taxAmount && taxRate) {
    const expectedTax = Math.round(subtotal * (taxRate / 100));
    if (Math.abs(expectedTax - taxAmount) > 1) {
      warnings.push({
        code: 'TAX_RATE_MISMATCH',
        message: `Expected tax for ${taxRate}% rate: ¥${expectedTax}, got ¥${taxAmount}`,
        severity: 'warn'
      });
    }
  }

  return { valid: true, warnings };
}
