import { Spinner } from '../Spinner';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  /**
   * Whether the overlay is visible
   */
  isOpen: boolean;

  /**
   * Loading message to display
   */
  message?: string;

  /**
   * Spinner size
   * @default 'lg'
   */
  spinnerSize?: 'sm' | 'md' | 'lg';

  /**
   * Overlay type: full-screen or scoped to parent
   * @default 'fullscreen'
   */
  type?: 'fullscreen' | 'overlay';

  /**
   * Accessibility label for screen readers
   * @default 'Loading'
   */
  ariaLabel?: string;
}

/**
 * LoadingOverlay - Full-screen or component-scoped loading indicator
 *
 * **Variants**:
 * - `fullscreen`: Fixed position, covers entire viewport (z-index: 9998)
 * - `overlay`: Positioned absolute, scoped to parent element
 *
 * **Features**:
 * - Blur backdrop filter for visual focus
 * - Spinner + optional message
 * - Accessibility support (role="status", aria-label)
 * - Reduced motion support
 *
 * @example
 * // Full-screen loading
 * <LoadingOverlay
 *   isOpen={loading}
 *   message="Processing batch..."
 * />
 *
 * @example
 * // Component-scoped overlay
 * <div style={{ position: 'relative', height: '400px' }}>
 *   <LoadingOverlay
 *     isOpen={loading}
 *     type="overlay"
 *     message="Loading data..."
 *   />
 *   {/* Your content here... *\/}
 * </div>
 */
export function LoadingOverlay({
  isOpen,
  message = 'Loading...',
  spinnerSize = 'lg',
  type = 'fullscreen',
  ariaLabel = 'Loading',
}: LoadingOverlayProps) {
  if (!isOpen) return null;

  return (
    <div
      className={`loading-overlay loading-overlay--${type}`}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      <div className="loading-overlay__content">
        <Spinner
          size={spinnerSize}
          aria-label={ariaLabel}
          className="loading-overlay__spinner"
        />
        {message && <p className="loading-overlay__message">{message}</p>}
      </div>
    </div>
  );
}
