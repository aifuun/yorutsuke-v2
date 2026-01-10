interface ProgressProps {
  value: number; // 0-100
  variant?: 'default' | 'success' | 'error';
  indeterminate?: boolean;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

/**
 * Progress - Linear progress bar component
 *
 * Variants: default (blue), success (green), error (red)
 * Features: Indeterminate mode, percentage display
 *
 * @example
 * <Progress value={75} showPercentage />
 *
 * @example
 * <Progress indeterminate label="Loading..." />
 */
export function Progress({
  value,
  variant = 'default',
  indeterminate = false,
  label,
  showPercentage = false,
  className = '',
}: ProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`progress-wrapper ${className}`}>
      {(label || showPercentage) && (
        <div className="progress__header">
          {label && <span className="progress__label">{label}</span>}
          {showPercentage && !indeterminate && (
            <span className="progress__percentage">{percentage}%</span>
          )}
        </div>
      )}
      <div
        className={`progress progress--${variant} ${indeterminate ? 'progress--indeterminate' : ''}`}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className="progress__bar"
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
