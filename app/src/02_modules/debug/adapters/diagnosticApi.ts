/**
 * Diagnostic API Adapter (Cloud Lambda Calls)
 *
 * Pillar B: Airlock - validates all Lambda responses with Zod
 * Pillar I: Firewall - isolated HTTP boundary
 *
 * Calls Lambda function to process diagnostic reports:
 * - Accepts: userId + localData (no token needed)
 * - Returns: S3 URL (authenticated) or local reference (guest)
 *
 * Note: Business logic orchestration happens in DiagnosticService,
 * not here. This adapter only handles HTTP boundary operations.
 */

import { z } from 'zod';
import { fetch } from '@tauri-apps/plugin-http';
import { logger } from '../../../00_kernel/telemetry';
import type { LocalDiagnosticData } from '../types/diagnostic';

// ============================================================================
// Zod Schemas (Pillar B: Airlock)
// ============================================================================

const DiagnosticExportResponseSchema = z.object({
  success: z.literal(true),
  reportId: z.string(),
  s3Url: z.string(),
  timestamp: z.string(),
  fileSize: z.number(),
  traceId: z.string().optional(),
});

export type DiagnosticExportResponse = z.infer<
  typeof DiagnosticExportResponseSchema
>;

// ============================================================================
// Constants
// ============================================================================

const DIAGNOSTIC_LAMBDA_URL = import.meta.env.VITE_DIAGNOSTIC_LAMBDA_URL;
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds

// ============================================================================
// Helper: Timeout Protection
// ============================================================================

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// ============================================================================
// HTTP API: Upload Diagnostic Report to Lambda
// ============================================================================

/**
 * Send diagnostic report to Lambda for processing
 *
 * Lambda collects both local and cloud data for all users:
 * - "device-*" (guest): Full diagnostic export with cloud metadata
 * - "user-*" (authenticated): Full diagnostic export with cloud metadata
 *
 * Returns S3 presigned URL (7-day expiry) for all users
 *
 * @param userId - User ID (determines access level via prefix)
 * @param localData - Local diagnostic data collected on device
 * @param traceId - Trace ID for log correlation
 * @param attempt - Retry attempt number (for logging)
 * @returns Validated diagnostic export response with S3 URL and cloud data
 * @throws Error on network failure or validation error
 */
export async function uploadDiagnosticReport(
  userId: string,
  localData: LocalDiagnosticData,
  traceId: string,
  attempt: number
): Promise<DiagnosticExportResponse> {
  if (!DIAGNOSTIC_LAMBDA_URL) {
    throw new Error(
      'Diagnostic Lambda URL not configured. Set VITE_DIAGNOSTIC_LAMBDA_URL environment variable.'
    );
  }

  logger.debug('DIAGNOSTIC_API_CALL_START', {
    traceId,
    userId,
    attempt,
    url: DIAGNOSTIC_LAMBDA_URL,
  });

  try {
    // Make HTTP POST request to Lambda with timeout protection
    const response = await withTimeout(
      fetch(DIAGNOSTIC_LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          localData,
          traceId,
          attempt,
        }),
      }),
      REQUEST_TIMEOUT_MS,
      `Diagnostic Lambda request timeout after ${REQUEST_TIMEOUT_MS}ms`
    );

    if (!response.ok) {
      throw new Error(
        `Lambda HTTP error: ${response.status} ${response.statusText}`
      );
    }

    // Parse and validate response (Pillar B: Airlock)
    const body = await response.json();

    logger.debug('DIAGNOSTIC_API_RESPONSE_RAW', {
      traceId,
      statusCode: response.status,
      bodyKeys: Object.keys(body),
    });

    // Validate with Zod schema
    const validated = DiagnosticExportResponseSchema.parse(body);

    logger.info('DIAGNOSTIC_API_CALL_SUCCESS', {
      traceId,
      reportId: validated.reportId,
      hasS3Url: !!validated.s3Url,
      fileSize: validated.fileSize,
    });

    // Log full S3 URL for debugging download issues
    if (validated.s3Url) {
      logger.debug('DIAGNOSTIC_S3_URL_RECEIVED', {
        traceId,
        s3Url: validated.s3Url,
        urlLength: validated.s3Url.length,
      });
    }

    return validated;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.error('DIAGNOSTIC_API_CALL_ERROR', {
      traceId,
      userId,
      attempt,
      error: errorMessage,
    });

    throw error;
  }
}
