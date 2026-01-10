interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
}

/**
 * Spinner - Loading indicator with rotating animation
 *
 * @example
 * <Spinner size="md" aria-label="Loading data" />
 */
export function Spinner({
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Loading',
}: SpinnerProps) {
  return (
    <div
      className={`spinner spinner--${size} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
