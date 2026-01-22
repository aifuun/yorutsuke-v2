/**
 * Transaction Sync Adapter
 * Wraps transaction module adapters for sync operations
 * Pillar I: Firewalls - Provides single boundary between sync and transaction modules
 *
 * This adapter isolates sync module from transaction module internals.
 * All sync services MUST use this adapter instead of direct transaction imports.
 */

import type { UserId, TransactionId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import * as transactionDb from '../../transaction/adapters/transactionDb';
import * as transactionApi from '../../transaction/adapters/transactionApi';
import {
  fetchTransactionsFromCloud as cloudFetch,
  fetchTransactions as localFetch,
  upsertTransaction as dbUpsert,
  checkFileExists as fileCheck
} from '../../transaction/adapters';

/**
 * Sync result from cloud API
 */
export interface SyncTransactionsResult {
  synced: number;
  failed: string[];
}

/**
 * Fetch options for local transactions
 */
export interface FetchTransactionsOptions {
  startDate?: string;
  endDate?: string;
  includeDeleted?: boolean;
}

// ============================================================================
// Transaction Database Operations (Local)
// ============================================================================

/**
 * Fetch all dirty transactions for a user (marked for sync)
 * @param userId - User ID
 * @returns Array of dirty transactions
 */
export async function fetchDirtyTransactions(userId: UserId): Promise<Transaction[]> {
  return transactionDb.fetchDirtyTransactions(userId);
}

/**
 * Clear dirty flags for successfully synced transactions
 * @param ids - Array of transaction IDs to clear
 */
export async function clearDirtyFlags(ids: TransactionId[]): Promise<void> {
  return transactionDb.clearDirtyFlags(ids);
}

/**
 * Fetch transactions from local database
 * @param userId - User ID
 * @param options - Fetch options (date range, includeDeleted)
 * @returns Array of transactions
 */
export async function fetchLocalTransactions(
  userId: UserId,
  options: FetchTransactionsOptions = {}
): Promise<Transaction[]> {
  return localFetch(userId, options);
}

/**
 * Upsert (insert or update) a transaction in local database
 * @param transaction - Transaction to upsert
 */
export async function upsertLocalTransaction(transaction: Transaction): Promise<void> {
  return dbUpsert(transaction);
}

// ============================================================================
// Transaction Cloud API Operations (Remote)
// ============================================================================

/**
 * Sync dirty transactions to cloud (Push: Local → Cloud)
 * @param userId - User ID
 * @param transactions - Array of transactions to sync
 * @returns Sync result with success count and failed IDs
 */
export async function syncTransactionsToCloud(
  userId: UserId,
  transactions: Transaction[]
): Promise<SyncTransactionsResult> {
  return transactionApi.syncTransactions(userId, transactions);
}

/**
 * Fetch transactions from cloud (Pull: Cloud → Local)
 * @param userId - User ID
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @returns Array of transactions from cloud
 */
export async function fetchTransactionsFromCloud(
  userId: UserId,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  return cloudFetch(userId, startDate, endDate);
}

// ============================================================================
// File System Operations
// ============================================================================

/**
 * Check if a file exists at given path
 * @param filePath - Full file path to check
 * @returns True if file exists, false otherwise
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  return fileCheck(filePath);
}
