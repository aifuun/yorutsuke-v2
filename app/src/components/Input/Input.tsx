import { useState } from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  success?: string;
  size?: 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
}

/**
 * Input - Text input component
 *
 * Types: text, email, password, number
 * Sizes: md (40px), lg (48px)
 * States: error, success, disabled
 * Features: Password toggle
 *
 * @example
 * <Input
 *   type="email"
 *   value={email}
 *   onChange={setEmail}
 *   placeholder="Enter your email"
 *   error={errors.email}
 * />
 */
export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  success,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = type === 'password' && showPassword ? 'text' : type;
  const hasError = !!error;
  const hasSuccess = !!success && !hasError;

  const inputId = `input-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${inputId}-error`;
  const successId = `${inputId}-success`;

  return (
    <div className={`input-wrapper ${className}`}>
      <div className="input-container">
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`input input--${size} ${hasError ? 'input--error' : ''} ${hasSuccess ? 'input--success' : ''}`}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : hasSuccess ? successId : undefined}
        />
        {type === 'password' && (
          <button
            type="button"
            className="input__toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? '👁' : '👁‍🗨'}
          </button>
        )}
      </div>
      {hasError && (
        <div id={errorId} className="input__message input__message--error">
          {error}
        </div>
      )}
      {hasSuccess && (
        <div id={successId} className="input__message input__message--success">
          {success}
        </div>
      )}
    </div>
  );
}
