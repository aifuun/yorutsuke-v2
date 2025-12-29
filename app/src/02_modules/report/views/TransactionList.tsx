// Transaction list container
import { useState } from 'react';
import type { Transaction } from '../../../01_domains/transaction';
import type { TransactionId } from '../../../00_kernel/types';
import { useTranslation } from '../../../i18n';
import { TransactionItem } from './TransactionItem';

interface TransactionListProps {
  transactions: Transaction[];
  // Action callbacks
  onEdit?: (id: TransactionId, changes: Partial<Transaction>) => void;
  onConfirm?: (id: TransactionId) => void;
  onDelete?: (id: TransactionId) => void;
}

export function TransactionList({
  transactions,
  onEdit,
  onConfirm,
  onDelete,
}: TransactionListProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<TransactionId | null>(null);

  const toggleExpand = (id: TransactionId) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  if (transactions.length === 0) {
    return (
      <div className="transactions-empty">
        <span className="empty-icon">📋</span>
        <p>{t('report.empty')}</p>
        <span className="empty-hint">{t('report.emptyHint')}</span>
      </div>
    );
  }

  return (
    <div className="transactions-section">
      <div className="section-header">
        <h3>{t('report.transactions')}</h3>
        <span className="section-count">{t('report.transactionCount', { count: transactions.length })}</span>
      </div>
      <div className="transactions-list">
        {transactions.map(tx => (
          <TransactionItem
            key={String(tx.id)}
            transaction={tx}
            isExpanded={expandedId === tx.id}
            onToggle={() => toggleExpand(tx.id)}
            onEdit={onEdit}
            onConfirm={onConfirm}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
