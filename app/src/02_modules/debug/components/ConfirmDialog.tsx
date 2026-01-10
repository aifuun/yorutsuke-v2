// Confirmation dialog component for destructive actions
import { useState, useEffect } from 'react';
import './confirm-dialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  checkboxLabel?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'warning' | 'danger';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  checkboxLabel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const [isChecked, setIsChecked] = useState(false);

  // Reset checkbox when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsChecked(false);
    }
  }, [isOpen]);

  // ESC key to cancel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const canConfirm = checkboxLabel ? isChecked : true;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className={`confirm-dialog confirm-dialog--${variant}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <div className="confirm-dialog-header">
          <h2 id="dialog-title" className="confirm-dialog-title">
            {title}
          </h2>
        </div>

        <div className="confirm-dialog-body">
          <p id="dialog-message" className="confirm-dialog-message">
            {message}
          </p>

          {checkboxLabel && (
            <label className="confirm-dialog-checkbox">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <span>{checkboxLabel}</span>
            </label>
          )}
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            className="confirm-dialog-button confirm-dialog-button--cancel"
            onClick={onCancel}
            autoFocus
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-dialog-button confirm-dialog-button--confirm confirm-dialog-button--${variant}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
