import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toastStore } from './toastStore';
import { Toast } from './Toast';

/**
 * ToastContainer - Renders toast notifications
 *
 * Subscribes to toastStore and displays toasts in a stack.
 * Max 3 visible toasts (FIFO queue).
 * Positioned bottom-right on desktop, bottom-center on mobile.
 *
 * @example
 * <ToastContainer />
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState(toastStore.getState().toasts);

  useEffect(() => {
    const unsubscribe = toastStore.subscribe((state) => {
      setToasts(state.toasts);
    });

    return unsubscribe;
  }, []);

  // Show max 3 toasts (FIFO)
  const visibleToasts = toasts.slice(-3);

  if (visibleToasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="toast-container">
      {visibleToasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={() => toastStore.getState().removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
}
