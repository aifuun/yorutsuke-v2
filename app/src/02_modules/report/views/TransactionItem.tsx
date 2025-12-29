// Single transaction display component with edit capability
import { useState } from 'react';
import type { Transaction, TransactionCategory } from '../../../01_domains/transaction';
import type { TransactionId } from '../../../00_kernel/types';
import { isHighConfidence } from '../../../01_domains/transaction';
import { useTranslation } from '../../../i18n';

const CATEGORIES: TransactionCategory[] = [
  'purchase', 'sale', 'shipping', 'packaging', 'fee', 'other',
];

interface TransactionItemProps {
  transaction: Transaction;
  isExpanded: boolean;
  onToggle: () => void;
  // Action callbacks
  onEdit?: (id: TransactionId, changes: Partial<Transaction>) => void;
  onConfirm?: (id: TransactionId) => void;
  onDelete?: (id: TransactionId) => void;
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

export function TransactionItem({
  transaction,
  isExpanded,
  onToggle,
  onEdit,
  onConfirm,
  onDelete,
}: TransactionItemProps) {
  const { t } = useTranslation();
  const { id, type, category, amount, merchant, confidence, confirmedAt, description, date, rawText } = transaction;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    amount: amount.toString(),
    merchant: merchant || '',
    category: category,
  });

  const handleSave = () => {
    if (onEdit) {
      onEdit(id, {
        amount: parseInt(editForm.amount, 10) || amount,
        merchant: editForm.merchant || null,
        category: editForm.category,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm({
      amount: amount.toString(),
      merchant: merchant || '',
      category: category,
    });
    setIsEditing(false);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConfirm) onConfirm(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(t('transaction.deleteConfirm'))) {
      onDelete(id);
    }
  };

  return (
    <div className={`transaction-item ${isExpanded ? 'expanded' : ''}`}>
      <div className="tx-main" onClick={onToggle}>
        <div className="tx-left">
          <span className={`status-icon ${confirmedAt ? 'confirmed' : ''}`}>
            {getStatusIcon(transaction)}
          </span>
          <div className="tx-info">
            <span className="tx-merchant">{merchant || 'Unknown'}</span>
            <span className="tx-category">{t(`transaction.categories.${category}`)}</span>
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
          {isEditing ? (
            // Edit mode
            <div className="tx-edit-form">
              <div className="edit-row">
                <label>{t('transaction.amount')}</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="edit-row">
                <label>{t('transaction.merchant')}</label>
                <input
                  type="text"
                  value={editForm.merchant}
                  onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="edit-row">
                <label>{t('transaction.category')}</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as TransactionCategory })}
                  onClick={(e) => e.stopPropagation()}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{t(`transaction.categories.${cat}`)}</option>
                  ))}
                </select>
              </div>
              <div className="edit-actions">
                <button className="btn-save" onClick={handleSave}>{t('common.save')}</button>
                <button className="btn-cancel" onClick={handleCancel}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            // View mode
            <>
              <div className="detail-row">
                <span className="detail-label">{t('transaction.description')}</span>
                <span className="detail-value">{description || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('transaction.date')}</span>
                <span className="detail-value">{date}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('transaction.status')}</span>
                <span className="detail-value">
                  {confirmedAt ? t('transaction.confirmed') : t('transaction.pending')}
                </span>
              </div>
              {rawText && (
                <div className="detail-row">
                  <span className="detail-label">{t('transaction.ocrText')}</span>
                  <span className="detail-value ocr-text">{rawText}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="tx-actions">
                {onEdit && (
                  <button
                    className="btn-edit"
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  >
                    {t('common.edit')}
                  </button>
                )}
                {onConfirm && !confirmedAt && (
                  <button className="btn-confirm" onClick={handleConfirm}>
                    {t('common.confirm')}
                  </button>
                )}
                {onDelete && (
                  <button className="btn-delete" onClick={handleDelete}>
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
