/**
 * Diagnostic Export Panel
 *
 * Pillar L: Pure view component - subscribes to vanilla store from service
 * No business logic, only JSX rendering
 *
 * Architecture:
 * - Subscribes to diagnosticStore (Pure TS state)
 * - Calls diagnosticService.execute() directly
 * - Displays 5-step progress (step1-5)
 * - No headless hook layer (follows project standards)
 *
 * Features:
 * - Displays diagnostic export button
 * - Shows 5-step progress during collection
 * - Shows success with S3 download link + copy-link option
 * - Shows error with retry option
 */

import { useCallback, useEffect } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from '../../../i18n';
import { diagnosticStore, diagnosticService } from '../services/DiagnosticService';
import { isDiagnosticExportSuccess } from '../types/diagnostic';
import type { UserId } from '../../../00_kernel/types';
import type { DiagnosticPhase } from '../types/diagnostic';
import './diagnostic-panel.css';

interface DiagnosticPanelProps {
  userId: UserId | null;
}

export function DiagnosticPanel({ userId }: DiagnosticPanelProps) {
  const { t } = useTranslation();

  // Subscribe directly to vanilla store (Pillar L: Service layer owns state)
  const state = useStore(diagnosticStore, (s) => s.state);
  const result = useStore(diagnosticStore, (s) => s.result);
  const error = useStore(diagnosticStore, (s) => s.error);
  const context = useStore(diagnosticStore, (s) => s.context);

  // =========================================================================
  // Note: Auto-reset removed. User explicitly clicks "再次收集" or downloads
  // =========================================================================

  // =========================================================================
  // All event handlers (Hooks Rules: must be at top level, not in conditionals)
  // =========================================================================

  const handleExport = useCallback(async () => {
    if (!userId) {
      console.warn('User ID not available');
      return;
    }

    // Call service directly (no headless layer)
    await diagnosticService.execute(userId);
  }, [userId]);

  const handleRetry = useCallback(async () => {
    // reset() already handles FSM transition and store update
    diagnosticService.reset();
    if (userId) {
      await diagnosticService.execute(userId);
    }
  }, [userId]);

  const handleReset = useCallback(() => {
    // reset() already handles FSM transition and store update
    console.log('[DiagnosticPanel] handleReset called, current state:', state);
    diagnosticService.reset();
    console.log('[DiagnosticPanel] reset() completed');
  }, []);

  const handleCopyLink = useCallback(() => {
    if (result && isDiagnosticExportSuccess(result) && result.s3Url) {
      navigator.clipboard.writeText(result.s3Url).then(() => {
        console.log('Link copied to clipboard');
      });
    }
  }, [result]);

  const handleDownload = useCallback(() => {
    if (result && isDiagnosticExportSuccess(result) && result.s3Url) {
      console.log('[DiagnosticPanel] Opening download link:', result.s3Url);
      window.open(result.s3Url, '_blank');

      // Reset state after download initiated
      console.log('[DiagnosticPanel] Resetting after download');
      diagnosticService.reset();
    }
  }, [result]);

  // =========================================================================
  // Idle State - Show button
  // =========================================================================

  if (state === 'idle') {
    const isDisabled = !userId;
    const disabledReason = !userId ? t('diagnostic.disabled.no_user') : undefined;

    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__section">
          <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>

          <div className="diagnostic-panel__info">
            <p className="diagnostic-panel__description">{t('diagnostic.description')}</p>
          </div>

          <button
            className="diagnostic-panel__button"
            onClick={handleExport}
            disabled={isDisabled}
            title={disabledReason}
            type="button"
          >
            📤 {t('diagnostic.button.export')}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Loading States - Show 5-step progress with logo flow
  // =========================================================================

  if (state === 'collecting' || state === 'uploading') {
    const phases: DiagnosticPhase[] = [
      'step1_local_collection',
      'step2_upload_local',
      'step3_cloud_collection',
      'step4_merge',
      'step5_generate_link',
    ];

    const phaseLogos: Record<DiagnosticPhase, string> = {
      step1_local_collection: '📦',
      step2_upload_local: '⬆️',
      step3_cloud_collection: '☁️',
      step4_merge: '🔗',
      step5_generate_link: '📥',
    };

    const phaseLabels: Record<DiagnosticPhase, string> = {
      step1_local_collection: t('diagnostic.phase.step1'),
      step2_upload_local: t('diagnostic.phase.step2'),
      step3_cloud_collection: t('diagnostic.phase.step3'),
      step4_merge: t('diagnostic.phase.step4'),
      step5_generate_link: t('diagnostic.phase.step5'),
    };

    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__section">
          <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>

          <div className="diagnostic-panel__progress">
            {/* Logo Flow */}
            <div className="diagnostic-panel__logo-flow">
              {phases.map((phase, index) => {
                const phaseInfo = context?.phases[phase];
                const status = phaseInfo?.status || 'pending';
                const isCompleted = status === 'completed';

                return (
                  <div
                    key={phase}
                    className={`diagnostic-panel__logo-step diagnostic-panel__logo-step--${status}`}
                    title={phaseLabels[phase]}
                  >
                    <div className="diagnostic-panel__logo-circle">
                      <span className="diagnostic-panel__logo">{phaseLogos[phase]}</span>
                    </div>
                    {index < phases.length - 1 && (
                      <div
                        className={`diagnostic-panel__logo-connector ${isCompleted ? 'completed' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress Details */}
            <div className="diagnostic-panel__progress-details">
              {context && (
                <>
                  <div className="diagnostic-panel__progress-bar">
                    <div
                      className="diagnostic-panel__progress-bar-fill"
                      style={{ width: `${context.overallProgress}%` }}
                    />
                  </div>

                  <div className="diagnostic-panel__progress-text">
                    <span className="diagnostic-panel__progress-percent">{context.overallProgress.toFixed(0)}%</span>
                    <span className="diagnostic-panel__progress-time">
                      {((Date.now() - context.startTime) / 1000).toFixed(1)}s
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Success State - Show download link or local data info
  // =========================================================================

  if (state === 'success' && result && isDiagnosticExportSuccess(result)) {
    const isLocalOnly = !result.s3Url;
    const successMessage = isLocalOnly
      ? 'Local diagnostic data collected (guest user)'
      : t('diagnostic.state.success');

    // Show completed flow
    const phases: DiagnosticPhase[] = [
      'step1_local_collection',
      'step2_upload_local',
      'step3_cloud_collection',
      'step4_merge',
      'step5_generate_link',
    ];

    const phaseLogos: Record<DiagnosticPhase, string> = {
      step1_local_collection: '📦',
      step2_upload_local: '⬆️',
      step3_cloud_collection: '☁️',
      step4_merge: '🔗',
      step5_generate_link: '📥',
    };

    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__section diagnostic-panel__section--success">
          <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>

          {/* Show completed flow */}
          <div className="diagnostic-panel__progress">
            <div className="diagnostic-panel__logo-flow">
              {phases.map((phase, index) => (
                <div
                  key={phase}
                  className="diagnostic-panel__logo-step diagnostic-panel__logo-step--completed"
                >
                  <div className="diagnostic-panel__logo-circle">
                    <span className="diagnostic-panel__logo">{phaseLogos[phase]}</span>
                  </div>
                  {index < phases.length - 1 && (
                    <div className="diagnostic-panel__logo-connector completed" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="diagnostic-panel__success">
            <div className="diagnostic-panel__success-icon">✅</div>
            <p className="diagnostic-panel__success-message">{successMessage}</p>

            <div className="diagnostic-panel__details">
              <p className="diagnostic-panel__detail">
                <strong>{t('diagnostic.detail.report_id')}:</strong> {result.reportId}
              </p>
              <p className="diagnostic-panel__detail">
                <strong>{t('diagnostic.detail.file_size')}:</strong> {formatBytes(result.fileSize)}
              </p>
              {!isLocalOnly && (
                <p className="diagnostic-panel__detail">
                  <strong>{t('diagnostic.detail.expiry')}:</strong> {t('diagnostic.detail.expiry_value')}
                </p>
              )}
            </div>

            <div className="diagnostic-panel__actions">
              {!isLocalOnly && (
                <>
                  <button
                    className="diagnostic-panel__button diagnostic-panel__button--primary"
                    onClick={handleDownload}
                    type="button"
                  >
                    📥 {t('diagnostic.button.download')}
                  </button>

                  <button
                    className="diagnostic-panel__button diagnostic-panel__button--secondary"
                    onClick={handleCopyLink}
                    type="button"
                  >
                    🔗 {t('diagnostic.button.copy_link')}
                  </button>
                </>
              )}

              <button
                className="diagnostic-panel__button diagnostic-panel__button--secondary"
                onClick={handleReset}
                type="button"
              >
                {t('diagnostic.button.new_export')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Error State - Show error message with retry
  // =========================================================================

  if (state === 'error') {
    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__section diagnostic-panel__section--error">
          <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>

          <div className="diagnostic-panel__error">
            <div className="diagnostic-panel__error-icon">⚠️</div>
            <p className="diagnostic-panel__error-title">{t('diagnostic.state.error')}</p>
            <p className="diagnostic-panel__error-message">{error}</p>

            <div className="diagnostic-panel__actions">
              <button
                className="diagnostic-panel__button diagnostic-panel__button--retry"
                onClick={handleRetry}
                type="button"
              >
                🔄 {t('diagnostic.button.retry')}
              </button>

              <button
                className="diagnostic-panel__button diagnostic-panel__button--secondary"
                onClick={handleReset}
                type="button"
              >
                {t('diagnostic.button.cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Should never reach here
  return null;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format bytes to human-readable size (e.g., "1.5 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
