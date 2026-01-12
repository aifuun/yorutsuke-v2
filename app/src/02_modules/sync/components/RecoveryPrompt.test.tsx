/**
 * Recovery Prompt Tests (Issue #86)
 * Tests recovery modal UI component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RecoveryPrompt } from './RecoveryPrompt';
import type { RecoveryStatus } from '../services/recoveryService';
import { RECOVERY_I18N, formatPendingCount } from '../__tests__/i18n';

describe('RecoveryPrompt', () => {
  const defaultStatus: RecoveryStatus = {
    needsRecovery: true,
    dirtyCount: 2,
    queueCount: 1,
    lastSyncedAt: '2026-01-15T10:00:00Z',
  };

  const mockOnSyncNow = vi.fn();
  const mockOnDiscard = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering with different status counts', () => {
    it('should display total pending count', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/You have/)).toHaveTextContent('3');
      expect(screen.getByText(/pending changes/)).toBeInTheDocument();
    });

    it('should display singular form for 1 pending change', () => {
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: null,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      // Text is split across elements: "You have <strong>1</strong> pending change"
      expect(screen.getByText((content, element) => {
        return element?.textContent === formatPendingCount(1);
      })).toBeInTheDocument();
    });

    it('should display plural form for multiple pending changes', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      // Text is split across elements: "You have <strong>3</strong> pending changes"
      expect(screen.getByText((content, element) => {
        return element?.textContent === formatPendingCount(3);
      })).toBeInTheDocument();
    });

    it('should show local changes count when present', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(RECOVERY_I18N.LOCAL_CHANGES)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show queued items count when present', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(RECOVERY_I18N.QUEUED_ITEMS)).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should not show local changes when zero', () => {
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 0,
        queueCount: 3,
        lastSyncedAt: null,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(RECOVERY_I18N.LOCAL_CHANGES)).not.toBeInTheDocument();
    });

    it('should not show queued items when zero', () => {
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 2,
        queueCount: 0,
        lastSyncedAt: null,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(RECOVERY_I18N.QUEUED_ITEMS)).not.toBeInTheDocument();
    });

    it('should show last synced time when present', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(RECOVERY_I18N.LAST_SYNCED)).toBeInTheDocument();
    });

    it('should not show last synced when null', () => {
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 2,
        queueCount: 1,
        lastSyncedAt: null,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(RECOVERY_I18N.LAST_SYNCED)).not.toBeInTheDocument();
    });
  });

  describe('Sync Now button', () => {
    it('should call onSyncNow when clicked', async () => {
      mockOnSyncNow.mockResolvedValue(undefined);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      expect(mockOnSyncNow).toHaveBeenCalledTimes(1);
    });

    it('should show loading state while syncing', async () => {
      let resolveSync: () => void;
      const syncPromise = new Promise<void>((resolve) => {
        resolveSync = resolve;
      });
      mockOnSyncNow.mockReturnValue(syncPromise);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      // Check loading state
      expect(screen.getByText(`⟳ ${RECOVERY_I18N.SYNC_NOW_LOADING}`)).toBeInTheDocument();

      // Resolve sync
      resolveSync!();
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should close modal on successful sync', async () => {
      mockOnSyncNow.mockResolvedValue(undefined);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error when sync fails', async () => {
      mockOnSyncNow.mockRejectedValue(new Error('Network error'));

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === `⚠️ ${RECOVERY_I18N.ERROR_SYNC}`;
        })).toBeInTheDocument();
      });

      // Should not close modal
      expect(mockOnClose).not.toHaveBeenCalled();

      // Should return to idle state
      expect(screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`)).toBeInTheDocument();
    });

    it('should disable button during sync', async () => {
      let resolveSync: () => void;
      const syncPromise = new Promise<void>((resolve) => {
        resolveSync = resolve;
      });
      mockOnSyncNow.mockReturnValue(syncPromise);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      // Button should be disabled
      await waitFor(() => {
        expect(screen.getByText(`⟳ ${RECOVERY_I18N.SYNC_NOW_LOADING}`)).toBeDisabled();
      });

      resolveSync!();
    });

    it('should disable discard button during sync', async () => {
      let resolveSync: () => void;
      const syncPromise = new Promise<void>((resolve) => {
        resolveSync = resolve;
      });
      mockOnSyncNow.mockReturnValue(syncPromise);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      // Discard button should also be disabled
      await waitFor(() => {
        const discardButton = screen.getByText(/Discard/);
        expect(discardButton).toBeDisabled();
      });

      resolveSync!();
    });
  });

  describe('Discard button', () => {
    it('should call onDiscard when clicked', async () => {
      mockOnDiscard.mockResolvedValue(undefined);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      expect(mockOnDiscard).toHaveBeenCalledTimes(1);
    });

    it('should show loading state while discarding', async () => {
      let resolveDiscard: () => void;
      const discardPromise = new Promise<void>((resolve) => {
        resolveDiscard = resolve;
      });
      mockOnDiscard.mockReturnValue(discardPromise);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      // Check loading state
      expect(screen.getByText(`⟳ ${RECOVERY_I18N.DISCARD_LOADING}`)).toBeInTheDocument();

      // Resolve discard
      resolveDiscard!();
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should close modal on successful discard', async () => {
      mockOnDiscard.mockResolvedValue(undefined);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error when discard fails', async () => {
      mockOnDiscard.mockRejectedValue(new Error('Database error'));

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === `⚠️ ${RECOVERY_I18N.ERROR_DISCARD}`;
        })).toBeInTheDocument();
      });

      // Should not close modal
      expect(mockOnClose).not.toHaveBeenCalled();

      // Should return to idle state
      expect(screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`)).toBeInTheDocument();
    });

    it('should disable button during discard', async () => {
      let resolveDiscard: () => void;
      const discardPromise = new Promise<void>((resolve) => {
        resolveDiscard = resolve;
      });
      mockOnDiscard.mockReturnValue(discardPromise);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      // Button should be disabled
      await waitFor(() => {
        expect(screen.getByText(`⟳ ${RECOVERY_I18N.DISCARD_LOADING}`)).toBeDisabled();
      });

      resolveDiscard!();
    });

    it('should disable sync button during discard', async () => {
      let resolveDiscard: () => void;
      const discardPromise = new Promise<void>((resolve) => {
        resolveDiscard = resolve;
      });
      mockOnDiscard.mockReturnValue(discardPromise);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      // Sync button should also be disabled
      await waitFor(() => {
        const syncButton = screen.getByText(/Sync Now/);
        expect(syncButton).toBeDisabled();
      });

      resolveDiscard!();
    });
  });

  describe('error display', () => {
    it('should not show error initially', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
    });

    it('should clear previous error when retrying sync', async () => {
      mockOnSyncNow
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      // First attempt - fail
      const syncButton = screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`);
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === `⚠️ ${RECOVERY_I18N.ERROR_SYNC}`;
        })).toBeInTheDocument();
      });

      // Second attempt - succeed
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Error should be cleared
      expect(screen.queryByText(/Failed to sync/)).not.toBeInTheDocument();
    });

    it('should clear previous error when retrying discard', async () => {
      mockOnDiscard
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      // First attempt - fail
      const discardButton = screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`);
      fireEvent.click(discardButton);

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === `⚠️ ${RECOVERY_I18N.ERROR_DISCARD}`;
        })).toBeInTheDocument();
      });

      // Second attempt - succeed
      fireEvent.click(discardButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Error should be cleared
      expect(screen.queryByText(/Failed to discard/)).not.toBeInTheDocument();
    });
  });

  describe('timestamp formatting', () => {
    it('should show "just now" for recent timestamp', () => {
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: new Date().toISOString(),
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('should show minutes ago', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: twoMinutesAgo,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
    });

    it('should show singular minute', () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: oneMinuteAgo,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('1 minute ago')).toBeInTheDocument();
    });

    it('should show hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: twoHoursAgo,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('should show singular hour', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: oneHourAgo,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });

    it('should show formatted date for old timestamp', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const status: RecoveryStatus = {
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 0,
        lastSyncedAt: threeDaysAgo,
      };

      render(
        <RecoveryPrompt
          status={status}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      // Should show formatted date (e.g., "Jan 12, 2026, 10:00 AM")
      const lastSyncedText = screen.getByText('Last synced:').nextElementSibling?.textContent;
      expect(lastSyncedText).toBeTruthy();
      expect(lastSyncedText).not.toBe('just now');
      expect(lastSyncedText).not.toMatch(/ago$/);
    });
  });

  describe('modal structure', () => {
    it('should have modal overlay', () => {
      const { container } = render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(container.querySelector('.modal-overlay')).toBeInTheDocument();
    });

    it('should have modal header with title', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Pending Changes Detected/)).toBeInTheDocument();
    });

    it('should have modal content with hint', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByText(/Choose to sync now to upload your changes/)
      ).toBeInTheDocument();
    });

    it('should have modal actions with buttons', () => {
      render(
        <RecoveryPrompt
          status={defaultStatus}
          onSyncNow={mockOnSyncNow}
          onDiscard={mockOnDiscard}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(`↻ ${RECOVERY_I18N.SYNC_NOW}`)).toBeInTheDocument();
      expect(screen.getByText(`🗑️ ${RECOVERY_I18N.DISCARD}`)).toBeInTheDocument();
    });
  });
});
