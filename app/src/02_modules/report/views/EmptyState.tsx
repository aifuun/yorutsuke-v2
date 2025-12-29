// Reusable empty state component
import { useTranslation } from '../../../i18n';

type EmptyStateVariant = 'first-use' | 'no-data-today' | 'no-results';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ICONS: Record<EmptyStateVariant, string> = {
  'first-use': '🎉',
  'no-data-today': '📋',
  'no-results': '🔍',
};

export function EmptyState({ variant, title, message, action }: EmptyStateProps) {
  const { t } = useTranslation();

  const defaultTitle = t(`empty.${variant}.title`);
  const defaultMessage = t(`empty.${variant}.message`);

  return (
    <div className={`empty-state empty-state--${variant}`}>
      <span className="empty-state__icon">{ICONS[variant]}</span>
      <h3 className="empty-state__title">{title || defaultTitle}</h3>
      <p className="empty-state__message">{message || defaultMessage}</p>
      {action && (
        <button
          type="button"
          className="empty-state__action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
