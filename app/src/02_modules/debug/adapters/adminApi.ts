// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import { fetch } from '@tauri-apps/plugin-http';
import type { UserId } from '../../../00_kernel/types';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';

// Timeouts
const DELETE_TIMEOUT_MS = 300_000; // 5 minutes (can be slow for large datasets)

// Get Admin Delete Data Lambda URL
function getAdminDeleteUrl(): string {
  return import.meta.env.VITE_LAMBDA_ADMIN_DELETE_URL || '';
}

// Zod schema for delete data response
const DeleteDataResponseSchema = z.object({
  userId: z.string(),
  deleted: z.object({
    transactions: z.number().optional(),
    images: z.number().optional(),
  }),
});

type DeleteDataResponse = z.infer<typeof DeleteDataResponseSchema>;

// Data types that can be deleted
export type DataType = 'transactions' | 'images';

/**
 * Wrap a promise with timeout protection
 */
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

/**
 * Delete user data from cloud (DynamoDB + S3)
 * Pillar B: Validate response with Zod schema
 *
 * Security: Only deletes data belonging to the specified userId
 *
 * @param userId - User ID whose data to delete
 * @param types - Array of data types to delete ['transactions', 'images']
 * @returns Count of deleted items
 */
export async function deleteUserData(
  userId: UserId,
  types: DataType[]
): Promise<DeleteDataResponse> {
  // Validation
  if (!userId) {
    throw new Error('userId is required');
  }
  if (!types || types.length === 0) {
    throw new Error('types must be a non-empty array');
  }

  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    logger.debug(EVENTS.APP_ERROR, { component: 'adminApi', phase: 'mock_offline' });
    throw new Error('Network error: offline mode');
  }

  // Mocking online - return mock response
  if (isMockingOnline()) {
    await mockDelay(500);
    logger.debug(EVENTS.APP_ERROR, { component: 'adminApi', phase: 'mock_online' });
    return {
      userId,
      deleted: {
        transactions: types.includes('transactions') ? 5 : 0,
        images: types.includes('images') ? 3 : 0,
      },
    };
  }

  // Build request body
  const requestBody = {
    userId,
    types,
  };

  logger.info('admin_delete_data_started', { userId, types });

  // Get and check Lambda URL
  const adminDeleteUrl = getAdminDeleteUrl();
  if (!adminDeleteUrl) {
    logger.error(EVENTS.APP_ERROR, {
      component: 'adminApi',
      error: 'VITE_LAMBDA_ADMIN_DELETE_URL not configured',
      userId,
      types,
    });
    throw new Error(
      'VITE_LAMBDA_ADMIN_DELETE_URL not configured. Please deploy the Lambda and add URL to .env.local'
    );
  }

  try {
    const fetchPromise = fetch(adminDeleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await withTimeout(
      fetchPromise,
      DELETE_TIMEOUT_MS,
      'Delete data timeout (5 minutes)'
    );

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`400: ${errorData.error || 'Invalid request parameters'}`);
      }
      if (response.status === 403) {
        throw new Error('403: Unauthorized');
      }
      if (response.status === 500) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`500: ${errorData.error || 'Server error'}`);
      }
      throw new Error(`Delete failed: ${response.status}`);
    }

    const data = await response.json();

    // Pillar B: Validate response with Zod schema
    const parsed = DeleteDataResponseSchema.safeParse(data);
    if (!parsed.success) {
      logger.error(EVENTS.APP_ERROR, {
        component: 'adminApi',
        error: 'Invalid response schema',
        details: parsed.error.message,
      });
      throw new Error(`Invalid delete response: ${parsed.error.message}`);
    }

    logger.info('admin_delete_data_success', {
      userId,
      deleted: parsed.data.deleted,
    });

    return parsed.data;
  } catch (error) {
    logger.error(EVENTS.APP_ERROR, {
      component: 'adminApi',
      error: String(error),
      userId,
      types,
    });
    throw error;
  }
}
