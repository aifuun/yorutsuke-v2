interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * Checkbox - Custom styled checkbox component
 *
 * Features: Custom checkmark, keyboard accessible (Space toggles)
 *
 * @example
 * <Checkbox
 *   checked={agreed}
 *   onChange={setAgreed}
 *   label="I agree to the terms and conditions"
 * />
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  name,
  id,
  className = '',
}: CheckboxProps) {
  const checkboxId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className={`checkbox-wrapper ${className}`}>
      <input
        type="checkbox"
        id={checkboxId}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="checkbox__input"
      />
      <label htmlFor={checkboxId} className="checkbox__label">
        <span className="checkbox__box">
          {checked && (
            <svg
              className="checkbox__checkmark"
              width="12"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 5L4.5 8.5L11 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="checkbox__text">{label}</span>
      </label>
    </div>
  );
}
