import { useRef, useEffect } from 'react';
import { Radio } from './Radio';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * RadioGroup - Group of radio buttons with arrow key navigation
 *
 * Features: Arrow key navigation (↑↓), keyboard accessible
 *
 * @example
 * <RadioGroup
 *   name="payment"
 *   value={paymentMethod}
 *   onChange={setPaymentMethod}
 *   options={[
 *     { value: 'card', label: 'Credit Card' },
 *     { value: 'bank', label: 'Bank Transfer' },
 *   ]}
 *   aria-label="Payment method"
 * />
 */
export function RadioGroup({
  name,
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: RadioGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      e.preventDefault();

      const currentIndex = options.findIndex((opt) => opt.value === value);
      let nextIndex: number;

      if (e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % options.length;
      } else {
        nextIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
      }

      const nextValue = options[nextIndex].value;
      onChange(nextValue);

      // Focus the next radio button
      const nextRadio = group.querySelector<HTMLInputElement>(
        `input[value="${nextValue}"]`
      );
      nextRadio?.focus();
    };

    group.addEventListener('keydown', handleKeyDown);
    return () => group.removeEventListener('keydown', handleKeyDown);
  }, [value, options, onChange]);

  return (
    <div
      ref={groupRef}
      className={`radio-group ${className}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <Radio
          key={option.value}
          value={option.value}
          checked={value === option.value}
          onChange={onChange}
          label={option.label}
          name={name}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
