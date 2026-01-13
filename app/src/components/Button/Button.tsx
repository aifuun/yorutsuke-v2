import { type ReactNode } from 'react';
import { Spinner } from '../Spinner';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  'aria-label'?: string;
}

/**
 * Button - Primary interactive component
 *
 * 4 variants: primary, secondary, ghost, danger
 * 3 sizes: sm (32px), md (40px), lg (48px)
 * 5 states: default, hover, active, disabled, loading
 *
 * @example
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Save
 * </Button>
 *
 * @example
 * <Button variant="danger" loading iconLeft={<TrashIcon />}>
 *   Delete
 * </Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  children,
  onClick,
  type = 'button',
  className = '',
  'aria-label': ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={isDisabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading && (
        <span className="btn__spinner">
          <Spinner size="sm" aria-label="Loading" />
        </span>
      )}
      {!loading && iconLeft && <span className="btn__icon">{iconLeft}</span>}
      <span className="btn__text">{children}</span>
      {!loading && iconRight && <span className="btn__icon">{iconRight}</span>}
    </button>
  );
}
