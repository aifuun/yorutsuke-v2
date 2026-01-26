// Confirmation dialog component for destructive actions
import { useState, useEffect } from 'react';
import { CancelButton, ConfirmButton, DeleteButton } from '../../../components';
import './confirm-dialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  checkboxLabel?: string;
  defaultChecked?: boolean;
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
  defaultChecked = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const [isChecked, setIsChecked] = useState(defaultChecked);

  // Reset checkbox when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsChecked(defaultChecked);
    }
  }, [isOpen, defaultChecked]);

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
          <CancelButton onClick={onCancel}>
            {cancelText}
          </CancelButton>
          {variant === 'danger' ? (
            <DeleteButton onClick={onConfirm} disabled={!canConfirm}>
              {confirmText}
            </DeleteButton>
          ) : (
            <ConfirmButton onClick={onConfirm} disabled={!canConfirm}>
              {confirmText}
            </ConfirmButton>
          )}
        </div>
      </div>
    </div>
  );
}
