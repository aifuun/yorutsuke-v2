import { BarChart3, Search } from 'lucide-react';
import { Icon } from '../index';

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
  const defaultIcons: Record<EmptyStateVariant, typeof BarChart3> = {
    'first-use': BarChart3, // Changed from 🎉 (will use variant styling)
    'no-data': BarChart3,   // Changed from 📊
    'no-results': Search,   // Changed from 🔍
  };

  // For icon component: use the Lucide icon if provided, otherwise use default
  const displayIcon = icon ? icon : defaultIcons[variant];
  const isEmoji = typeof icon === 'string'; // Check if custom icon is emoji or Lucide
  
  return (
    <div
      className={`empty-state empty-state--${variant} ${className}`}
      role="status"
    >
      <div className="empty-state__icon">
        {isEmoji ? (
          // Custom emoji passed in
          <span role="img" aria-hidden="true">{displayIcon}</span>
        ) : (
          // Use Lucide icon with Icon wrapper
          <Icon 
            icon={displayIcon as any} 
            size={variant === 'first-use' ? 'xl' : 'lg'} 
            aria-label={title}
          />
        )}
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
