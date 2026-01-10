interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  rows?: number;
  maxLength?: number;
  showCharacterCount?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Textarea - Multi-line text input component
 *
 * Features: Character count, min-height, vertical resize only
 *
 * @example
 * <Textarea
 *   value={description}
 *   onChange={setDescription}
 *   placeholder="Enter description"
 *   rows={4}
 *   maxLength={500}
 *   showCharacterCount
 *   error={errors.description}
 * />
 */
export function Textarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  rows = 4,
  maxLength,
  showCharacterCount = false,
  className = '',
  'aria-label': ariaLabel,
}: TextareaProps) {
  const hasError = !!error;

  const textareaId = `textarea-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${textareaId}-error`;

  const characterCount = value.length;
  const showCount = showCharacterCount || (maxLength !== undefined && maxLength > 0);

  return (
    <div className={`textarea-wrapper ${className}`}>
      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={`textarea ${hasError ? 'textarea--error' : ''}`}
        aria-label={ariaLabel}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
      />
      {showCount && (
        <div className="textarea__count">
          {characterCount}
          {maxLength && ` / ${maxLength}`}
        </div>
      )}
      {hasError && (
        <div id={errorId} className="textarea__message textarea__message--error">
          {error}
        </div>
      )}
    </div>
  );
}
