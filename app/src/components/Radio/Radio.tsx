interface RadioProps {
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  name: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Radio - Single radio button component
 *
 * Usually used within RadioGroup for arrow key navigation.
 *
 * @example
 * <Radio
 *   value="option1"
 *   checked={selected === 'option1'}
 *   onChange={setSelected}
 *   label="Option 1"
 *   name="options"
 * />
 */
export function Radio({
  value,
  checked,
  onChange,
  label,
  name,
  disabled = false,
  className = '',
}: RadioProps) {
  const radioId = `radio-${name}-${value}`;

  return (
    <div className={`radio-wrapper ${className}`}>
      <input
        type="radio"
        id={radioId}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="radio__input"
      />
      <label htmlFor={radioId} className="radio__label">
        <span className="radio__circle">
          {checked && <span className="radio__dot" />}
        </span>
        <span className="radio__text">{label}</span>
      </label>
    </div>
  );
}
