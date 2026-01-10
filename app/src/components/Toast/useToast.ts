import { toastStore } from './toastStore';

/**
 * useToast - React hook for showing toast notifications
 *
 * Provides convenience methods for showing different toast types.
 *
 * @example
 * const { showSuccess, showError } = useToast();
 * showSuccess('Upload Complete', 'Receipt processed successfully');
 * showError('Upload Failed', 'Network error occurred');
 */
export function useToast() {
  const showSuccess = (title: string, message: string = '') => {
    toastStore.getState().addToast({
      type: 'success',
      title,
      message,
      duration: 3000,
    });
  };

  const showError = (title: string, message: string = '') => {
    toastStore.getState().addToast({
      type: 'error',
      title,
      message,
      duration: 5000,
    });
  };

  const showWarning = (title: string, message: string = '') => {
    toastStore.getState().addToast({
      type: 'warning',
      title,
      message,
      duration: 4000,
    });
  };

  const showInfo = (title: string, message: string = '') => {
    toastStore.getState().addToast({
      type: 'info',
      title,
      message,
      duration: 3000,
    });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
