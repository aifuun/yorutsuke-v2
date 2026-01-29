/**
 * Transactions Page - View all processed transactions
 * Issue #107
 */

import { useState, useEffect } from 'react';
import { z } from 'zod';
import '../styles/transactions.css';

// Zod Schemas (Pillar B: Airlock validation)
const TransactionSchema = z.object({
  userId: z.string(),
  transactionId: z.string(),
  amount: z.number(),
  merchant: z.string(),
  date: z.string(),
  status: z.enum(['unconfirmed', 'confirmed', 'deleted', 'needs_review']),
  category: z.string(),
  createdAt: z.string(),
  imageId: z.string().optional(),
  confidence: z.number().optional(),
});

const TransactionsResponseSchema = z.object({
  transactions: z.array(TransactionSchema).optional(),
  Message: z.string().nullable().optional(),
});

type Transaction = z.infer<typeof TransactionSchema>;
type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;

// FSM State Machine (Pillar D: No boolean flags)
type State =
  | { status: 'loading' }
  | { status: 'success'; data: Transaction[] }
  | { status: 'error'; error: string };

const API_ENDPOINT = 'https://yy2xogwnhx4sxu7tbmt6ax67r40zhzzo.lambda-url.ap-northeast-1.on.aws/';

export function Transactions() {
  const [state, setState] = useState<State>({ status: 'loading' });

  // Filters
  const [searchMerchant, setSearchMerchant] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setState({ status: 'loading' });

    try {
      const response = await fetch(API_ENDPOINT);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();

      // Pillar B: Validate with Zod schema
      const validationResult = TransactionsResponseSchema.safeParse(rawData);

      if (!validationResult.success) {
        throw new Error(`Invalid API response: ${validationResult.error.message}`);
      }

      const data = validationResult.data;
      const transactions = data.transactions && Array.isArray(data.transactions)
        ? data.transactions
        : [];

      setState({ status: 'success', data: transactions });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
      setState({ status: 'error', error: message });
      console.error('Failed to fetch transactions:', err);
    }
  }

  // Filter transactions (only when state is success)
  const transactions = state.status === 'success' ? state.data : [];
  const filteredTransactions = transactions.filter(tx => {
    if (searchMerchant && !tx.merchant.toLowerCase().includes(searchMerchant.toLowerCase())) {
      return false;
    }
    if (filterUserId && !tx.userId.includes(filterUserId)) {
      return false;
    }
    if (filterStatus !== 'all' && tx.status !== filterStatus) {
      return false;
    }
    return true;
  });

  // Get status badge class
  function getStatusBadgeClass(status: Transaction['status']): string {
    switch (status) {
      case 'confirmed':
        return 'status-badge status-confirmed';
      case 'unconfirmed':
        return 'status-badge status-unconfirmed';
      case 'needs_review':
        return 'status-badge status-needs-review';
      case 'deleted':
        return 'status-badge status-deleted';
      default:
        return 'status-badge';
    }
  }

  // Format date
  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  // Format created timestamp
  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Render based on FSM state
  if (state.status === 'loading') {
    return (
      <div className="transactions-page">
        <div className="page-header">
          <h1>Transactions</h1>
        </div>
        <div className="loading-state">
          <div className="spinner" role="status" aria-label="Loading transactions"></div>
          <p>Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="transactions-page">
        <div className="page-header">
          <h1>Transactions</h1>
        </div>
        <div className="error-state" role="alert">
          <p className="error-message">❌ {state.error}</p>
          <button
            onClick={fetchTransactions}
            className="btn btn-primary"
            aria-label="Retry loading transactions"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // state.status === 'success'
  return (
    <div className="transactions-page">
      <div className="page-header">
        <h1>Transactions</h1>
        <button
          onClick={fetchTransactions}
          className="btn btn-secondary"
          aria-label="Refresh transaction list"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filters" role="search" aria-label="Transaction filters">
        <div className="filter-group">
          <label htmlFor="search-merchant">Merchant Search:</label>
          <input
            id="search-merchant"
            type="text"
            placeholder="Search merchant..."
            value={searchMerchant}
            onChange={(e) => setSearchMerchant(e.target.value)}
            className="filter-input"
            aria-label="Search by merchant name"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-user">User ID:</label>
          <input
            id="filter-user"
            type="text"
            placeholder="Filter by user..."
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="filter-input"
            aria-label="Filter by user ID"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
            aria-label="Filter by transaction status"
          >
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="unconfirmed">Unconfirmed</option>
            <option value="needs_review">Needs Review</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="results-summary" role="status" aria-live="polite">
        Showing {filteredTransactions.length} of {transactions.length} transactions
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <div className="empty-state" role="status">
          <p>No transactions found matching your filters.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="transactions-table" role="table" aria-label="Transaction history">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Status</th>
                <th>User ID</th>
                <th>Confidence</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.transactionId}>
                  <td>{formatDate(tx.date)}</td>
                  <td className="merchant-cell">{tx.merchant}</td>
                  <td className="amount-cell">¥{tx.amount.toLocaleString()}</td>
                  <td>{tx.category}</td>
                  <td>
                    <span className={getStatusBadgeClass(tx.status)}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="user-cell" title={tx.userId}>
                    {tx.userId.substring(0, 12)}...
                  </td>
                  <td className="confidence-cell">
                    {tx.confidence ? `${Math.round(tx.confidence * 100)}%` : '—'}
                  </td>
                  <td className="timestamp-cell">{formatTimestamp(tx.createdAt)}</td>
                  <td>
                    {tx.imageId && (
                      <a
                        href={`https://console.aws.amazon.com/s3/object/yorutsuke-images-us-dev?prefix=${tx.imageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-btn"
                        title="View original image in S3"
                      >
                        🖼️ Image
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
