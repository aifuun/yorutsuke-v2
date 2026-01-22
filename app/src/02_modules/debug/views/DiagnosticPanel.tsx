/**
 * Diagnostic Export Panel
 *
 * Pillar L: Pure view component - subscribes to vanilla store from service
 * No business logic, only JSX rendering
 *
 * States:
 * - idle: Show "Collect Diagnostic" button
 * - collecting/uploading: Show progress bar + current step
 * - success: Show report info + download/copy buttons
 * - error: Show error message + retry button
 */

import { useCallback } from 'react';
import { useTranslation } from '../../../i18n';
import { logger } from '../../../00_kernel/telemetry';
import {
  useDiagnosticStatus,
  useDiagnosticResult,
  useDiagnosticError,
  useDiagnosticContext,
  diagnosticActions,
} from '../hooks';
import { isDiagnosticExportSuccess } from '../types/diagnostic';
import type { UserId } from '../../../00_kernel/types';
import './diagnostic-panel.css';

interface DiagnosticPanelProps {
  userId: UserId | null;
}

export function DiagnosticPanel({ userId }: DiagnosticPanelProps) {
  const { t } = useTranslation();

  // Subscribe to store via hooks (Pillar L: Hook Bridge Layer)
  const state = useDiagnosticStatus();
  const result = useDiagnosticResult();
  const error = useDiagnosticError();
  const context = useDiagnosticContext();

  // Event handlers
  const handleCollect = useCallback(async () => {
    if (!userId) {
      console.warn('User ID not available');
      return;
    }
    await diagnosticActions.execute(userId);
  }, [userId]);

  const handleCopyLink = useCallback(() => {
    logger.debug('DIAGNOSTIC_COPY_LINK_INITIATED', {
      hasResult: !!result,
      isSuccess: result ? isDiagnosticExportSuccess(result) : false,
    });

    if (result && isDiagnosticExportSuccess(result)) {
      if (result.s3Url) {
        logger.info('DIAGNOSTIC_COPY_LINK', {
          s3Url: result.s3Url,
          urlLength: result.s3Url.length,
          reportId: result.reportId,
        });
        navigator.clipboard.writeText(result.s3Url).then(() => {
          logger.debug('DIAGNOSTIC_LINK_COPIED', {
            reportId: result.reportId,
          });
        });
      } else {
        logger.warn('DIAGNOSTIC_COPY_LINK_NO_URL', {
          reportId: result.reportId,
          fileSize: result.fileSize,
        });
      }
    } else {
      logger.error('DIAGNOSTIC_COPY_LINK_INVALID_STATE', {
        hasResult: !!result,
        isSuccess: result ? isDiagnosticExportSuccess(result) : false,
      });
    }
  }, [result]);

  const handleRetry = useCallback(async () => {
    diagnosticActions.reset();
    if (userId) {
      await diagnosticActions.execute(userId);
    }
  }, [userId]);

  const handleReset = useCallback(() => {
    diagnosticActions.reset();
  }, []);

  // =========================================================================
  // IDLE STATE - Show button
  // =========================================================================
  if (state === 'idle') {
    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__card">
          <div className="diagnostic-panel__header">
            <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>
            <p className="diagnostic-panel__description">{t('diagnostic.description')}</p>
          </div>

          <button
            className="diagnostic-panel__button diagnostic-panel__button--primary"
            onClick={handleCollect}
            disabled={!userId}
            type="button"
          >
            📤 {t('diagnostic.button.export')}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LOADING STATE - Show progress
  // =========================================================================
  if ((state === 'collecting' || state === 'uploading') && context) {
    const stepLabels: Record<string, string> = {
      step1_local_collection: t('diagnostic.phase.step1'),
      step2_upload_local: t('diagnostic.phase.step2'),
      step3_cloud_collection: t('diagnostic.phase.step3'),
      step4_merge: t('diagnostic.phase.step4'),
      step5_generate_link: t('diagnostic.phase.step5'),
    };

    const currentPhaseLabel = context.currentPhase
      ? stepLabels[context.currentPhase] || context.currentPhase
      : 'Processing...';

    const elapsedTime = ((Date.now() - context.startTime) / 1000).toFixed(1);

    // Get phase information
    const phases = Object.entries(context.phases || {}).map(([phase, info]: [string, any]) => ({
      phase,
      label: stepLabels[phase] || phase,
      status: info?.status,
      description: info?.description,
      duration: info?.duration,
    }));

    // Debug: log phases for troubleshooting
    if (phases.length === 0) {
      logger.debug('DIAGNOSTIC_PHASES_EMPTY', {
        contextPhases: Object.keys(context.phases || {}),
        phaseCount: Object.keys(context.phases || {}).length,
      });
    }

    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__card">
          <div className="diagnostic-panel__header">
            <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>
          </div>

          <div className="diagnostic-panel__progress-section">
            <div className="diagnostic-panel__progress-bar">
              <div
                className="diagnostic-panel__progress-fill"
                style={{ width: `${context.overallProgress}%` }}
              />
            </div>

            <div className="diagnostic-panel__progress-info">
              <div className="diagnostic-panel__progress-text">
                <span className="diagnostic-panel__progress-percent">
                  {Math.round(context.overallProgress)}%
                </span>
                <span className="diagnostic-panel__progress-time">{elapsedTime}s</span>
              </div>
              <p className="diagnostic-panel__current-step">{currentPhaseLabel}</p>
            </div>

            {/* Display all phases with status and details */}
            <div className="diagnostic-panel__phases-list">
              {phases.map((phase) => (
                <div
                  key={phase.phase}
                  className={`diagnostic-panel__phase-item diagnostic-panel__phase-item--${phase.status}`}
                >
                  <div className="diagnostic-panel__phase-status">
                    {phase.status === 'completed' && '✅'}
                    {phase.status === 'in_progress' && '⏳'}
                    {phase.status === 'pending' && '⏸️'}
                  </div>
                  <div className="diagnostic-panel__phase-details">
                    <div className="diagnostic-panel__phase-label">{phase.label}</div>
                    {phase.description && (
                      <div className="diagnostic-panel__phase-description">{phase.description}</div>
                    )}
                    {phase.duration && (
                      <div className="diagnostic-panel__phase-duration">
                        {(phase.duration / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUCCESS STATE - Show report info + download
  // =========================================================================
  if (state === 'success' && result && isDiagnosticExportSuccess(result)) {
    const hasUrl = !!result.s3Url;

    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__card diagnostic-panel__card--success">
          <div className="diagnostic-panel__header">
            <div className="diagnostic-panel__success-icon">✅</div>
            <h3 className="diagnostic-panel__title">{t('diagnostic.state.success')}</h3>
          </div>

          <div className="diagnostic-panel__report-info">
            <div className="diagnostic-panel__info-row">
              <span className="diagnostic-panel__info-label">{t('diagnostic.detail.report_id')}:</span>
              <span className="diagnostic-panel__info-value">{result.reportId}</span>
            </div>
            <div className="diagnostic-panel__info-row">
              <span className="diagnostic-panel__info-label">{t('diagnostic.detail.file_size')}:</span>
              <span className="diagnostic-panel__info-value">{formatBytes(result.fileSize)}</span>
            </div>
            {hasUrl && (
              <div className="diagnostic-panel__info-row">
                <span className="diagnostic-panel__info-label">{t('diagnostic.detail.expiry')}:</span>
                <span className="diagnostic-panel__info-value">{t('diagnostic.detail.expiry_value')}</span>
              </div>
            )}
          </div>

          <div className="diagnostic-panel__actions">
            {hasUrl && (
              <button
                className="diagnostic-panel__button diagnostic-panel__button--primary"
                onClick={handleCopyLink}
                title={result.s3Url}
                type="button"
              >
                🔗 {t('diagnostic.button.copy_link')}
              </button>
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
    );
  }

  // =========================================================================
  // ERROR STATE - Show error + retry
  // =========================================================================
  if (state === 'error') {
    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__card diagnostic-panel__card--error">
          <div className="diagnostic-panel__header">
            <div className="diagnostic-panel__error-icon">⚠️</div>
            <h3 className="diagnostic-panel__title">{t('diagnostic.state.error')}</h3>
          </div>

          <div className="diagnostic-panel__error-message">
            <p>{error || 'An unknown error occurred'}</p>
          </div>

          <div className="diagnostic-panel__actions">
            <button
              className="diagnostic-panel__button diagnostic-panel__button--primary"
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
    );
  }

  // Should never reach
  return null;
}

// ============================================================================
// Utilities
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
