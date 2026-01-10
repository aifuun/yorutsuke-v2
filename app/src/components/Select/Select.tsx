interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Select - Dropdown select component
 *
 * Features: Custom arrow, error state, disabled state
 *
 * @example
 * <Select
 *   value={selectedCategory}
 *   onChange={setSelectedCategory}
 *   options={[
 *     { value: 'food', label: 'Food' },
 *     { value: 'transport', label: 'Transport' },
 *   ]}
 *   placeholder="Select category"
 *   error={errors.category}
 * />
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  error,
  className = '',
  'aria-label': ariaLabel,
}: SelectProps) {
  const hasError = !!error;

  const selectId = `select-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${selectId}-error`;

  return (
    <div className={`select-wrapper ${className}`}>
      <div className="select-container">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`select ${hasError ? 'select--error' : ''}`}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="select__arrow"
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {hasError && (
        <div id={errorId} className="select__message select__message--error">
          {error}
        </div>
      )}
    </div>
  );
}
