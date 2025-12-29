// Transaction list container
import { useState } from 'react';
import type { Transaction } from '../../../01_domains/transaction';
import type { TransactionId } from '../../../00_kernel/types';
import { TransactionItem } from './TransactionItem';

interface TransactionListProps {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<TransactionId | null>(null);

  const toggleExpand = (id: TransactionId) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  if (transactions.length === 0) {
    return (
      <div className="transactions-empty">
        <span className="empty-icon">📋</span>
        <p>No transactions yet</p>
        <span className="empty-hint">Drop receipts to start tracking</span>
      </div>
    );
  }

  return (
    <div className="transactions-section">
      <div className="section-header">
        <h3>Transactions</h3>
        <span className="section-count">{transactions.length} items</span>
      </div>
      <div className="transactions-list">
        {transactions.map(tx => (
          <TransactionItem
            key={String(tx.id)}
            transaction={tx}
            isExpanded={expandedId === tx.id}
            onToggle={() => toggleExpand(tx.id)}
          />
        ))}
      </div>
    </div>
  );
}
