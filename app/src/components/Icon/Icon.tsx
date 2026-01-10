import { LucideIcon } from 'lucide-react';

interface IconProps {
  /**
   * Lucide icon component
   */
  icon: LucideIcon;

  /**
   * Icon size: xs (12px), sm (16px), md (20px), lg (24px), xl (32px)
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Icon color (CSS value or design token)
   * @example 'var(--color-primary)' or '#3b82f6'
   */
  color?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * ARIA label for screen readers (required for meaningful icons)
   * Omit for decorative icons
   */
  'aria-label'?: string;
}

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Icon - Wrapper component for Lucide React icons with consistent sizing
 *
 * **Features**:
 * - Consistent size scale (xs-xl)
 * - Optional color customization (supports design tokens)
 * - Built-in accessibility (aria-label, aria-hidden)
 * - TypeScript type safety
 * - Tree-shakeable (only imports used icons)
 *
 * @example
 * // Meaningful icon (with aria-label)
 * <Icon icon={Upload} size="md" aria-label="Upload receipt" />
 *
 * @example
 * // Decorative icon (with text label)
 * <button>
 *   <Icon icon={Plus} size="md" />
 *   <span>Add</span>
 * </button>
 *
 * @example
 * // With custom color
 * <Icon icon={Check} size="md" color="var(--color-success)" />
 */
export function Icon({
  icon: IconComponent,
  size = 'md',
  color,
  className = '',
  'aria-label': ariaLabel,
}: IconProps) {
  const pixelSize = sizeMap[size];

  return (
    <IconComponent
      size={pixelSize}
      color={color}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      role={ariaLabel ? undefined : 'presentation'}
    />
  );
}
