// Image Lightbox / Confirm Modal Component
// Modal for reviewing receipt images, transaction details, and confirming/deleting

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n';
import type { Transaction } from '../../../01_domains/transaction';
import './ImageLightbox.css';

interface ImageLightboxProps {
  /** Image URL to display */
  imageUrl: string;
  /** Image alt text */
  alt?: string;
  /** Called when lightbox should close */
  onClose: () => void;
  /** Called when user confirms the transaction */
  onConfirm?: () => void;
  /** Called when user deletes the transaction */
  onDelete?: () => void;
  /** Whether transaction is already confirmed */
  isConfirmed?: boolean;
  /** Transaction data to display details */
  transaction?: Transaction;
}

export function ImageLightbox({
  imageUrl,
  alt = 'Receipt image',
  onClose,
  onConfirm,
  onDelete,
  isConfirmed = false,
  transaction,
}: ImageLightboxProps) {
  const { t } = useTranslation();

  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Handle confirm + close
  const handleConfirm = () => {
    onConfirm?.();
    // Note: Parent handler (handleModalConfirm) already closes the modal
    // No need to call onClose() here to avoid double-closing
  };

  // Format amount for display (no +/- prefix, color indicates type)
  const formatAmount = (amount: number, _type: string) => {
    return `¥${amount.toLocaleString()}`;
  };

  const hasImage = imageUrl && imageUrl.length > 0;

  // Use Portal to render modal at document body level
  // This escapes stacking context from parent's backdrop-filter
  return createPortal(
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content lightbox-content--with-details" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          className="lightbox-close"
          onClick={onClose}
          title={t('common.close') || 'Close'}
        >
          ✕
        </button>

        <div className="lightbox-body">
          {/* Left: Image */}
          <div className="lightbox-image-section">
            {hasImage ? (
              <div className="lightbox-image-container">
                <img src={imageUrl} alt={alt} className="lightbox-image" />
              </div>
            ) : (
              <div className="lightbox-no-image">
                <span className="no-image-icon">📷</span>
                <span className="no-image-text">{t('transaction.noImage') || 'No image available'}</span>
              </div>
            )}
          </div>

          {/* Right: Transaction Details */}
          {transaction && (
            <div className="lightbox-details-section">
              <h3 className="lightbox-details-title">{t('transaction.details') || 'Transaction Details'}</h3>

              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.merchant') || 'Merchant'}:</span>
                <span className="detail-value">{transaction.merchant || transaction.description}</span>
              </div>

              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.amount') || 'Amount'}:</span>
                <span className={`detail-value detail-amount ${transaction.type === 'income' ? 'amount--income' : 'amount--expense'}`}>
                  {formatAmount(transaction.amount, transaction.type)}
                </span>
              </div>

              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.date') || 'Date'}:</span>
                <span className="detail-value">{transaction.date}</span>
              </div>

              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.category') || 'Category'}:</span>
                <span className="detail-value">{t(`transaction.categories.${transaction.category}`)}</span>
              </div>

              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.type') || 'Type'}:</span>
                <span className="detail-value">{t(`transaction.types.${transaction.type}`)}</span>
              </div>

              {/* OCR Raw Text */}
              {transaction.rawText && (
                <div className="lightbox-ocr-section">
                  <h4 className="lightbox-ocr-title">{t('transaction.extractedText') || 'Extracted Text'}</h4>
                  <div className="lightbox-ocr-text">
                    {transaction.rawText}
                  </div>
                </div>
              )}

              {/* Confidence */}
              {transaction.confidence !== null && transaction.confidence !== undefined && (
                <div className="lightbox-detail-row">
                  <span className="detail-label">{t('transaction.confidence') || 'AI Confidence'}:</span>
                  <span className="detail-value">{Math.round(transaction.confidence * 100)}%</span>
                </div>
              )}

              {/* Status */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.status') || 'Status'}:</span>
                <span className={`detail-value ${isConfirmed ? 'status--confirmed' : 'status--pending'}`}>
                  {isConfirmed
                    ? (t('transaction.confirmed') || '✓ Confirmed')
                    : (t('transaction.pendingConfirmation') || '⏳ Pending')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="lightbox-actions">
          {/* Left: Primary action or confirmed badge */}
          {onConfirm && !isConfirmed ? (
            <button
              type="button"
              className="btn btn--success"
              onClick={handleConfirm}
            >
              ✓ {t('common.confirm') || 'Confirm'}
            </button>
          ) : isConfirmed ? (
            <div className="lightbox-confirmed-badge">
              ✓ {t('transaction.confirmed') || 'Confirmed'}
            </div>
          ) : (
            <div></div>
          )}

          {/* Right: Secondary actions */}
          <div className="lightbox-actions-right">
            {onDelete && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={onDelete}
              >
                🗑 {t('common.delete') || 'Delete'}
              </button>
            )}
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              {t('common.close') || 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
