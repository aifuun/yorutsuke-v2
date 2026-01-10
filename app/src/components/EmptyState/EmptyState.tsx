type EmptyStateVariant = 'first-use' | 'no-data' | 'no-results';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState - Displays empty state messages
 *
 * 3 variants:
 * - first-use: First-time user (64px icon, primary button)
 * - no-data: No data available (48px icon, secondary button)
 * - no-results: No search results (48px icon, ghost button to clear filters)
 *
 * @example
 * <EmptyState
 *   variant="first-use"
 *   icon="🎉"
 *   title="Welcome to Yorutsuke!"
 *   description="Drop your first receipt to get started"
 *   action={{ label: "Learn More", onClick: handleLearnMore }}
 * />
 */
export function EmptyState({
  variant,
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const defaultIcons: Record<EmptyStateVariant, string> = {
    'first-use': '🎉',
    'no-data': '📊',
    'no-results': '🔍',
  };

  const displayIcon = icon || defaultIcons[variant];

  return (
    <div
      className={`empty-state empty-state--${variant} ${className}`}
      role="status"
    >
      <div className="empty-state__icon" role="img" aria-hidden="true">
        {displayIcon}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__description">{description}</p>
      {action && (
        <button
          type="button"
          className={`btn btn--${
            variant === 'first-use' ? 'primary' : variant === 'no-data' ? 'secondary' : 'ghost'
          }`}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
