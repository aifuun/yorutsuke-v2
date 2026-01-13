import { AlertTriangle } from 'lucide-react';
import { Icon, SyncButton } from '../index';

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * ErrorState - Displays error messages with optional retry
 *
 * Features: Alert icon, title, description, optional retry button
 *
 * @example
 * <ErrorState
 *   title="Failed to Load Data"
 *   description="Network connection error occurred. Please check your connection and try again."
 *   onRetry={handleRetry}
 *   retryLabel="Retry"
 * />
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`error-state ${className}`} role="alert">
      <div className="error-state__icon">
        <Icon icon={AlertTriangle} size="lg" aria-label={title} />
      </div>
      <h3 className="error-state__title">{title}</h3>
      <p className="error-state__description">{description}</p>
      {onRetry && (
        <SyncButton variant="ghost" onClick={onRetry}>
          {retryLabel}
        </SyncButton>
      )}
    </div>
  );
}
