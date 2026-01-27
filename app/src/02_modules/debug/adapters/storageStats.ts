// Storage statistics for Debug panel
import { invoke } from '@tauri-apps/api/core';
import { getDb } from '../../../00_kernel/storage/db';

export interface StorageStats {
  transactionCount: number;
  imageRecordCount: number;
  imageFileCount: number;
}

/**
 * Get storage statistics for Debug panel display
 * - transactionCount: Records in transactions table
 * - imageRecordCount: Records in images table
 * - imageFileCount: Actual files in filesystem
 */
export async function getStorageStats(): Promise<StorageStats> {
  const db = await getDb();

  // Query database counts
  const txCountResult = await db.select<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM transactions'
  );
  const imageCountResult = await db.select<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM images'
  );

  // Query filesystem count via Tauri IPC
  const fileCount = await invoke<number>('count_image_files');

  return {
    transactionCount: txCountResult[0]?.count || 0,
    imageRecordCount: imageCountResult[0]?.count || 0,
    imageFileCount: fileCount,
  };
}
