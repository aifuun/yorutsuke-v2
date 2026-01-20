/**
 * Diagnostic Export Panel
 *
 * Pillar L: Pure view component - renders state from headless hook
 * No business logic, only JSX rendering
 *
 * Features:
 * - Displays diagnostic export button
 * - Shows loading state during collection
 * - Shows success with S3 download link
 * - Shows error with retry option
 */

import { useCallback } from 'react';
import { useTranslation } from '../../../i18n';
import { useDiagnosticExportLogic } from '../headless/useDiagnosticExportLogic';
import type { UserId } from '../../../00_kernel/types';
import './diagnostic-panel.css';

interface DiagnosticPanelProps {
  userId: UserId | null;
}

export function DiagnosticPanel({ userId }: DiagnosticPanelProps) {
  const { t } = useTranslation();
  const { state, result, error, tokenLoading, exportDiagnosticData, reset } =
    useDiagnosticExportLogic(userId);

  const handleExport = useCallback(() => {
    exportDiagnosticData();
  }, [exportDiagnosticData]);

  const handleRetry = useCallback(() => {
    reset();
    exportDiagnosticData();
  }, [exportDiagnosticData, reset]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  // =========================================================================
  // Idle State - Show button
  // =========================================================================

  if (state === 'idle') {
    const isDisabled = !userId || tokenLoading;
    const disabledReason = !userId
      ? t('diagnostic.disabled.no_user')
      : tokenLoading
        ? t('diagnostic.disabled.loading_token')
        : undefined;

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
  // Loading States - Show spinner
  // =========================================================================

  if (state === 'collecting' || state === 'uploading') {
    const phase = state === 'collecting' ? t('diagnostic.phase.collecting') : t('diagnostic.phase.uploading');

    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__section">
          <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>

          <div className="diagnostic-panel__loading">
            <div className="diagnostic-panel__spinner" aria-label={t('diagnostic.state.loading')} />
            <p className="diagnostic-panel__status">{phase}...</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Success State - Show download link
  // =========================================================================

  if (state === 'success' && result) {
    return (
      <div className="diagnostic-panel">
        <div className="diagnostic-panel__section diagnostic-panel__section--success">
          <h3 className="diagnostic-panel__title">📊 {t('diagnostic.title')}</h3>

          <div className="diagnostic-panel__success">
            <div className="diagnostic-panel__success-icon">✅</div>
            <p className="diagnostic-panel__success-message">{t('diagnostic.state.success')}</p>

            <div className="diagnostic-panel__details">
              <p className="diagnostic-panel__detail">
                <strong>{t('diagnostic.detail.report_id')}:</strong> {result.reportId}
              </p>
              <p className="diagnostic-panel__detail">
                <strong>{t('diagnostic.detail.file_size')}:</strong> {formatBytes(result.fileSize)}
              </p>
              <p className="diagnostic-panel__detail">
                <strong>{t('diagnostic.detail.expiry')}:</strong> {t('diagnostic.detail.expiry_value')}
              </p>
            </div>

            <div className="diagnostic-panel__actions">
              <a
                href={result.s3Url}
                className="diagnostic-panel__download-button"
                download={`diagnostic-${result.reportId}.json`}
                target="_blank"
                rel="noopener noreferrer"
              >
                📥 {t('diagnostic.button.download')}
              </a>

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
