/**
 * Logout Confirmation View
 * Modal dialog to confirm user logout action
 *
 * Issue #168: Complete Auth Module 4-Layer Architecture
 * Pillar L: View uses hooks only, no direct service access
 * Design: Follows FEEDBACK.md modal specifications
 */

import { useEffect } from 'react';
import { useAuthStatus, useAuthActions } from '../hooks/useAuthState';
import './LogoutConfirmView.css';

interface LogoutConfirmViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogoutConfirmView({ isOpen, onClose }: LogoutConfirmViewProps) {
  // Hook Bridge Layer (ADR-020)
  const status = useAuthStatus();
  const { logout } = useAuthActions();

  const isLoading = status === 'loading';

  /**
   * Handle logout confirmation
   * Orchestrator identity: Coordinate service call → UI update
   */
  const handleLogout = async () => {
    await logout();
    onClose(); // Close modal after logout completes
  };

  /**
   * Handle Escape key to close modal
   * Accessibility: Keyboard navigation support
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="logout-overlay" role="dialog" aria-modal="true" aria-labelledby="logout-title">
      {/* Backdrop */}
      <div className="logout-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Modal Content */}
      <div className="logout-modal">
        <header className="logout-header">
          <h2 id="logout-title" className="logout-title">
            Confirm Logout
          </h2>
        </header>

        <div className="logout-body">
          <p className="logout-message">
            Are you sure you want to logout? You will need to login again to access your account.
          </p>
        </div>

        <footer className="logout-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cancel logout"
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-error"
            onClick={handleLogout}
            disabled={isLoading}
            aria-label={isLoading ? 'Logging out...' : 'Logout'}
          >
            {isLoading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Logging out...
              </>
            ) : (
              'Logout'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
