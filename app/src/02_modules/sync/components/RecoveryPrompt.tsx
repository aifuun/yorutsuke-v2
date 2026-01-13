/**
 * Recovery Prompt (Issue #86 Phase 4)
 * Shows prompt when app detects pending sync data on startup
 *
 * Pillar L: Pure JSX, logic passed via props
 */

import { useState } from 'react';
import { DeleteButton, SyncButton } from '../../../components';
import type { RecoveryStatus } from '../services/recoveryService';
import './recovery-prompt.css';

interface RecoveryPromptProps {
  status: RecoveryStatus;
  onSyncNow: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onClose: () => void;
}

export function RecoveryPrompt({ status, onSyncNow, onDiscard, onClose }: RecoveryPromptProps) {
  const [state, setState] = useState<'idle' | 'syncing' | 'discarding'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSyncNow = async () => {
    setState('syncing');
    setError(null);

    try {
      await onSyncNow();
      onClose();
    } catch (err) {
      setError('Failed to sync. Please try again.');
      setState('idle');
    }
  };

  const handleDiscard = async () => {
    setState('discarding');
    setError(null);

    try {
      await onDiscard();
      onClose();
    } catch (err) {
      setError('Failed to discard changes. Please try again.');
      setState('idle');
    }
  };

  const totalPending = status.dirtyCount + status.queueCount;

  return (
    <div className="modal-overlay">
      <div className="modal modal--sm recovery-prompt" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        {/* Header */}
        <div className="modal__header">
          <h2 id="recovery-title" className="modal__title">📦 Pending Changes Detected</h2>
        </div>

        {/* Content */}
        <div className="modal__body">
          <p className="recovery-message">
            You have <strong>{totalPending}</strong> pending change{totalPending !== 1 ? 's' : ''} that haven't been synced to the cloud.
          </p>

          {status.dirtyCount > 0 && (
            <div className="recovery-detail">
              <span className="recovery-detail-label">Local changes:</span>
              <span className="recovery-detail-value">{status.dirtyCount}</span>
            </div>
          )}

          {status.queueCount > 0 && (
            <div className="recovery-detail">
              <span className="recovery-detail-label">Queued items:</span>
              <span className="recovery-detail-value">{status.queueCount}</span>
            </div>
          )}

          {status.lastSyncedAt && (
            <div className="recovery-detail">
              <span className="recovery-detail-label">Last synced:</span>
              <span className="recovery-detail-value">
                {formatTimestamp(status.lastSyncedAt)}
              </span>
            </div>
          )}

          {error && (
            <div className="recovery-error">
              ⚠️ {error}
            </div>
          )}

          <p className="recovery-hint">
            Choose to sync now to upload your changes, or discard them to start fresh.
          </p>
        </div>

        {/* Actions */}
        <div className="modal__footer">
          <DeleteButton
            onClick={handleDiscard}
            disabled={state !== 'idle'}
            loading={state === 'discarding'}
          >
            Discard Changes
          </DeleteButton>
          <SyncButton
            onClick={handleSyncNow}
            disabled={state !== 'idle'}
            loading={state === 'syncing'}
          >
            Sync Now
          </SyncButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Format ISO timestamp to human-readable format
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diffMs < 60_000) {
      return 'just now';
    }

    // Less than 1 hour
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }

    // More than 24 hours - show date
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
