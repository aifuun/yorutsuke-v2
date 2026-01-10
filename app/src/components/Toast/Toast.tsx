import { type Toast as ToastType } from './toastStore';

interface ToastProps {
  toast: ToastType;
  onClose: () => void;
}

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

/**
 * Toast - Notification component
 *
 * Displays temporary notifications with 4 variants.
 * Auto-dismisses based on duration.
 *
 * @example
 * <Toast toast={toast} onClose={() => removeToast(toast.id)} />
 */
export function Toast({ toast, onClose }: ToastProps) {
  return (
    <div
      className={`toast toast--${toast.type}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast__icon" aria-hidden="true">
        {icons[toast.type]}
      </div>
      <div className="toast__content">
        <div className="toast__title">{toast.title}</div>
        {toast.message && <div className="toast__message">{toast.message}</div>}
      </div>
      <button
        className="toast__close"
        onClick={onClose}
        aria-label="Close notification"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}
