// Image Lightbox Component
// Simple modal for viewing receipt images in full size

import { useEffect, useCallback } from 'react';
import { useTranslation } from '../../../i18n';
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
  /** Whether transaction is already confirmed */
  isConfirmed?: boolean;
}

export function ImageLightbox({
  imageUrl,
  alt = 'Receipt image',
  onClose,
  onConfirm,
  isConfirmed = false,
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
    onClose();
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          className="lightbox-close"
          onClick={onClose}
          title={t('common.close') || 'Close'}
        >
          ✕
        </button>

        {/* Image */}
        <div className="lightbox-image-container">
          <img src={imageUrl} alt={alt} className="lightbox-image" />
        </div>

        {/* Actions */}
        <div className="lightbox-actions">
          {onConfirm && !isConfirmed && (
            <button
              type="button"
              className="btn btn--success btn--lg"
              onClick={handleConfirm}
            >
              ✓ {t('common.confirm') || 'Confirm'}
            </button>
          )}
          {isConfirmed && (
            <div className="lightbox-confirmed-badge">
              ✓ {t('transaction.confirmed') || 'Confirmed'}
            </div>
          )}
          <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
            {t('common.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
