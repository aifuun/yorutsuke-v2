interface SkeletonProps {
  variant: 'header' | 'line' | 'circle';
  width?: string;
  height?: string;
  className?: string;
}

/**
 * Skeleton - Loading placeholder with pulse animation
 *
 * @example
 * <Skeleton variant="header" />
 * <Skeleton variant="line" width="200px" />
 * <Skeleton variant="circle" width="48px" height="48px" />
 */
export function Skeleton({
  variant,
  width,
  height,
  className = '',
}: SkeletonProps) {
  const style: React.CSSProperties = {};

  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`skeleton skeleton--${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
