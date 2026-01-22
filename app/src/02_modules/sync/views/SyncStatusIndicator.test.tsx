/**
 * Sync Status Indicator Tests (Issue #167)
 * Tests UI component for sync status display using Hook Bridge Layer
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { STATUS_I18N, formatPending } from '../__tests__/i18n';

// Mock hook return values
let mockIsOnline = true;
let mockPendingCount = 0;
let mockLastSyncedAt: string | null = null;
let mockIsSyncing = false;

// Mock hooks (ADR-020: Hook Bridge Layer)
vi.mock('../hooks', () => ({
  useIsOnline: () => mockIsOnline,
  usePendingCount: () => mockPendingCount,
  useLastSyncedAt: () => mockLastSyncedAt,
  useIsSyncing: () => mockIsSyncing,
}));

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    // Reset mock hook values
    mockIsOnline = true;
    mockPendingCount = 0;
    mockLastSyncedAt = null;
    mockIsSyncing = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe('online status', () => {
    it('should show online indicator', () => {
      mockIsOnline = true;

      render(<SyncStatusIndicator />);

      const indicator = screen.getByTitle(STATUS_I18N.ONLINE);
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🟢');
    });

    it('should show offline indicator', () => {
      mockIsOnline = false;

      render(<SyncStatusIndicator />);

      const indicator = screen.getByTitle(STATUS_I18N.OFFLINE);
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🔴');
    });

    it('should apply offline class when offline', () => {
      mockIsOnline = false;

      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status--offline');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('syncing state', () => {
    it('should show syncing text when syncing', () => {
      mockIsSyncing = true;

      render(<SyncStatusIndicator />);

      expect(screen.getByText(`⟳ ${STATUS_I18N.SYNCING}`)).toBeInTheDocument();
    });

    it('should not show pending count when syncing', () => {
      mockIsSyncing = true;
      mockPendingCount = 5;

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(formatPending(5))).not.toBeInTheDocument();
      expect(screen.getByText(`⟳ ${STATUS_I18N.SYNCING}`)).toBeInTheDocument();
    });
  });

  describe('pending count', () => {
    it('should show pending count when not syncing', () => {
      mockIsSyncing = false;
      mockPendingCount = 3;

      render(<SyncStatusIndicator />);

      expect(screen.getByText(formatPending(3))).toBeInTheDocument();
    });

    it('should not show pending count when zero', () => {
      mockIsSyncing = false;
      mockPendingCount = 0;
      mockLastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    });
  });

  describe('last synced time', () => {
    it('should show "just now" for recent sync', () => {
      mockPendingCount = 0;
      mockIsSyncing = false;
      mockLastSyncedAt = new Date().toISOString();

      render(<SyncStatusIndicator />);

      expect(screen.getByText(STATUS_I18N.JUST_NOW)).toBeInTheDocument();
    });

    it('should show minutes ago', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      mockPendingCount = 0;
      mockIsSyncing = false;
      mockLastSyncedAt = twoMinutesAgo;

      render(<SyncStatusIndicator />);

      expect(screen.getByText('2m ago')).toBeInTheDocument();
    });

    it('should show hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      mockPendingCount = 0;
      mockIsSyncing = false;
      mockLastSyncedAt = twoHoursAgo;

      render(<SyncStatusIndicator />);

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should show days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      mockPendingCount = 0;
      mockIsSyncing = false;
      mockLastSyncedAt = threeDaysAgo;

      render(<SyncStatusIndicator />);

      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });

    it('should not show time when syncing', () => {
      mockIsSyncing = true;
      mockLastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('should not show time when pending', () => {
      mockPendingCount = 2;
      mockLastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
      expect(screen.getByText(formatPending(2))).toBeInTheDocument();
    });
  });

  describe('hideWhenIdle prop', () => {
    it('should hide when idle and hideWhenIdle=true', () => {
      mockIsOnline = true;
      mockPendingCount = 0;
      mockIsSyncing = false;

      const { container } = render(<SyncStatusIndicator hideWhenIdle={true} />);

      expect(container.firstChild).toBeNull();
    });

    it('should show when pending and hideWhenIdle=true', () => {
      mockIsOnline = true;
      mockPendingCount = 1;

      render(<SyncStatusIndicator hideWhenIdle={true} />);

      expect(screen.getByText(formatPending(1))).toBeInTheDocument();
    });

    it('should show when offline and hideWhenIdle=true', () => {
      mockIsOnline = false;
      mockPendingCount = 0;

      render(<SyncStatusIndicator hideWhenIdle={true} />);

      expect(screen.getByTitle(STATUS_I18N.OFFLINE)).toBeInTheDocument();
    });

    it('should always show when hideWhenIdle=false', () => {
      mockIsOnline = true;
      mockPendingCount = 0;
      mockIsSyncing = false;

      render(<SyncStatusIndicator hideWhenIdle={false} />);

      expect(screen.getByTitle(STATUS_I18N.ONLINE)).toBeInTheDocument();
    });
  });

  describe('priority of displayed status', () => {
    it('should prioritize syncing over pending', () => {
      mockIsSyncing = true;
      mockPendingCount = 5;

      render(<SyncStatusIndicator />);

      expect(screen.getByText(`⟳ ${STATUS_I18N.SYNCING}`)).toBeInTheDocument();
      expect(screen.queryByText(formatPending(5))).not.toBeInTheDocument();
    });

    it('should prioritize pending over last synced', () => {
      mockIsSyncing = false;
      mockPendingCount = 3;
      mockLastSyncedAt = '2026-01-15T10:00:00Z';

      render(<SyncStatusIndicator />);

      expect(screen.getByText(formatPending(3))).toBeInTheDocument();
      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('should show last synced when nothing else to show', () => {
      mockIsSyncing = false;
      mockPendingCount = 0;
      mockLastSyncedAt = new Date().toISOString();

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
      mockIsOnline = true;

      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status');
      expect(statusElement).not.toHaveClass('sync-status--offline');
    });

    it('should have offline class when offline', () => {
      mockIsOnline = false;

      const { container } = render(<SyncStatusIndicator />);

      const statusElement = container.querySelector('.sync-status--offline');
      expect(statusElement).toBeInTheDocument();
    });
  });
});
