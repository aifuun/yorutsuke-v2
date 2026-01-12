/**
 * Sync Status Indicator Tests (Issue #86)
 * Tests UI component for sync status display
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { STATUS_I18N, formatPending } from '../__tests__/i18n';

// Mock syncStore
const mockStoreState = {
  isOnline: true,
  pendingCount: 0,
  lastSyncedAt: null,
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
};

vi.mock('../stores/syncStore', () => ({
  useSyncStore: (selector: (state: typeof mockStoreState) => any) => {
    return selector(mockStoreState);
  },
}));

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    // Reset mock state
    mockStoreState.isOnline = true;
    mockStoreState.pendingCount = 0;
    mockStoreState.lastSyncedAt = null;
    mockStoreState.status = 'idle';
  });

  describe('online status', () => {
    it('should show online indicator', () => {
      mockStoreState.isOnline = true;

      render(<SyncStatusIndicator />);

      const indicator = screen.getByTitle(STATUS_I18N.ONLINE);
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🟢');
    });

    it('should show offline indicator', () => {
      mockStoreState.isOnline = false;

      render(<SyncStatusIndicator />);

      const indicator = screen.getByTitle(STATUS_I18N.OFFLINE);
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🔴');
    });

    it('should apply offline class when offline', () => {
      mockStoreState.isOnline = false;

      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status--offline');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('syncing state', () => {
    it('should show syncing text when syncing', () => {
      mockStoreState.status = 'syncing';

      render(<SyncStatusIndicator />);

      expect(screen.getByText(`⟳ ${STATUS_I18N.SYNCING}`)).toBeInTheDocument();
    });

    it('should not show pending count when syncing', () => {
      mockStoreState.status = 'syncing';
      mockStoreState.pendingCount = 5;

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(formatPending(5))).not.toBeInTheDocument();
      expect(screen.getByText(`⟳ ${STATUS_I18N.SYNCING}`)).toBeInTheDocument();
    });
  });

  describe('pending count', () => {
    it('should show pending count when not syncing', () => {
      mockStoreState.status = 'idle';
      mockStoreState.pendingCount = 3;

      render(<SyncStatusIndicator />);

      expect(screen.getByText(formatPending(3))).toBeInTheDocument();
    });

    it('should not show pending count when zero', () => {
      mockStoreState.status = 'idle';
      mockStoreState.pendingCount = 0;
      mockStoreState.lastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    });
  });

  describe('last synced time', () => {
    it('should show "just now" for recent sync', () => {
      mockStoreState.pendingCount = 0;
      mockStoreState.status = 'idle';
      mockStoreState.lastSyncedAt = new Date().toISOString();

      render(<SyncStatusIndicator />);

      expect(screen.getByText(STATUS_I18N.JUST_NOW)).toBeInTheDocument();
    });

    it('should show minutes ago', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      mockStoreState.pendingCount = 0;
      mockStoreState.status = 'idle';
      mockStoreState.lastSyncedAt = twoMinutesAgo;

      render(<SyncStatusIndicator />);

      expect(screen.getByText('2m ago')).toBeInTheDocument();
    });

    it('should show hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      mockStoreState.pendingCount = 0;
      mockStoreState.status = 'idle';
      mockStoreState.lastSyncedAt = twoHoursAgo;

      render(<SyncStatusIndicator />);

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should show days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      mockStoreState.pendingCount = 0;
      mockStoreState.status = 'idle';
      mockStoreState.lastSyncedAt = threeDaysAgo;

      render(<SyncStatusIndicator />);

      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });

    it('should not show time when syncing', () => {
      mockStoreState.status = 'syncing';
      mockStoreState.lastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('should not show time when pending', () => {
      mockStoreState.pendingCount = 2;
      mockStoreState.lastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
      expect(screen.getByText(formatPending(2))).toBeInTheDocument();
    });
  });

  describe('hideWhenIdle prop', () => {
    it('should hide when idle and hideWhenIdle=true', () => {
      mockStoreState.isOnline = true;
      mockStoreState.pendingCount = 0;
      mockStoreState.status = 'idle';

      const { container } = render(<SyncStatusIndicator hideWhenIdle={true} />);

      expect(container.firstChild).toBeNull();
    });

    it('should show when pending and hideWhenIdle=true', () => {
      mockStoreState.isOnline = true;
      mockStoreState.pendingCount = 1;

      render(<SyncStatusIndicator hideWhenIdle={true} />);

      expect(screen.getByText(formatPending(1))).toBeInTheDocument();
    });

    it('should show when offline and hideWhenIdle=true', () => {
      mockStoreState.isOnline = false;
      mockStoreState.pendingCount = 0;

      render(<SyncStatusIndicator hideWhenIdle={true} />);

      expect(screen.getByTitle(STATUS_I18N.OFFLINE)).toBeInTheDocument();
    });

    it('should always show when hideWhenIdle=false', () => {
      mockStoreState.isOnline = true;
      mockStoreState.pendingCount = 0;
      mockStoreState.status = 'idle';

      render(<SyncStatusIndicator hideWhenIdle={false} />);

      expect(screen.getByTitle(STATUS_I18N.ONLINE)).toBeInTheDocument();
    });
  });

  describe('priority of displayed status', () => {
    it('should prioritize syncing over pending', () => {
      mockStoreState.status = 'syncing';
      mockStoreState.pendingCount = 5;

      render(<SyncStatusIndicator />);

      expect(screen.getByText(`⟳ ${STATUS_I18N.SYNCING}`)).toBeInTheDocument();
      expect(screen.queryByText(formatPending(5))).not.toBeInTheDocument();
    });

    it('should prioritize pending over last synced', () => {
      mockStoreState.status = 'idle';
      mockStoreState.pendingCount = 3;
      mockStoreState.lastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.getByText(formatPending(3))).toBeInTheDocument();
      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('should show last synced when nothing else to show', () => {
      mockStoreState.status = 'idle';
      mockStoreState.pendingCount = 0;
      mockStoreState.lastSyncedAt = new Date().toISOString();

      render(<SyncStatusIndicator />);

      expect(screen.getByText(STATUS_I18N.JUST_NOW)).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('should have base sync-status class', () => {
      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status');
      expect(statusElement).toBeInTheDocument();
    });

    it('should have online class when online', () => {
      mockStoreState.isOnline = true;

      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status');
      expect(statusElement).not.toHaveClass('sync-status--offline');
    });

    it('should have offline class when offline', () => {
      mockStoreState.isOnline = false;

      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status--offline');
      expect(statusElement).toBeInTheDocument();
    });
  });
});
