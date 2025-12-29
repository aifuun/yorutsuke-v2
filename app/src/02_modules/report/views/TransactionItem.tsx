// Single transaction display component
import type { Transaction } from '../../../01_domains/transaction';
import { isHighConfidence } from '../../../01_domains/transaction';

interface TransactionItemProps {
  transaction: Transaction;
  isExpanded: boolean;
  onToggle: () => void;
}

// Format amount with currency
const formatAmount = (amount: number, type: 'income' | 'expense'): string => {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}¥${amount.toLocaleString()}`;
};

// Get status indicator
const getStatusIcon = (tx: Transaction): string => {
  if (tx.confirmedAt) return '✓';
  if (isHighConfidence(tx.confidence)) return '○';
  return '?';
};

export function TransactionItem({ transaction, isExpanded, onToggle }: TransactionItemProps) {
  const { type, category, amount, merchant, confidence, confirmedAt, description, date, rawText } = transaction;

  return (
    <div className={`transaction-item ${isExpanded ? 'expanded' : ''}`}>
      <div className="tx-main" onClick={onToggle}>
        <div className="tx-left">
          <span className={`status-icon ${confirmedAt ? 'confirmed' : ''}`}>
            {getStatusIcon(transaction)}
          </span>
          <div className="tx-info">
            <span className="tx-merchant">{merchant || 'Unknown'}</span>
            <span className="tx-category">{category}</span>
          </div>
        </div>
        <div className="tx-right">
          <span className={`tx-amount ${type}`}>
            {formatAmount(amount, type)}
          </span>
          {confidence !== null && (
            <span className="tx-confidence">{Math.round(confidence * 100)}%</span>
          )}
          <span className="tx-chevron">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="tx-details">
          <div className="detail-row">
            <span className="detail-label">Description</span>
            <span className="detail-value">{description || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date</span>
            <span className="detail-value">{date}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value">
              {confirmedAt ? 'Confirmed' : 'Pending confirmation'}
            </span>
          </div>
          {rawText && (
            <div className="detail-row">
              <span className="detail-label">OCR Text</span>
              <span className="detail-value ocr-text">{rawText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
