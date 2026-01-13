// Error fallback UI component
import { useTranslation } from '../../i18n';
import { AlertTriangle } from 'lucide-react';
import { Icon, SyncButton } from '../../components';

interface ErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

/**
 * ErrorFallback - User-friendly error display
 *
 * Shows error message with retry button.
 * Used as fallback for ErrorBoundary.
 */
export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div className="error-fallback">
      <div className="error-icon">
        <Icon icon={AlertTriangle} size="lg" aria-label={t('error.title')} />
      </div>
      <h2>{t('error.title')}</h2>
      <p className="error-message">{error.message}</p>
      <SyncButton onClick={onReset}>
        {t('common.retry')}
      </SyncButton>
    </div>
  );
}
