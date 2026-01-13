import React from 'react';
import { useNetworkStatus } from '../../00_kernel/network';
import { useTranslation } from '../../i18n';
import './ViewHeader.css';

export interface ViewHeaderProps {
  /**
   * Main title of the view
   * @example "Dashboard", "Transactions", "Settings"
   */
  title: string;

  /**
   * Optional subtitle/description
   * @example "Overview of your finances", "Manage your account"
   */
  subtitle?: string;

  /**
   * Optional right-side content (version badge, buttons, date, etc.)
   */
  rightContent?: React.ReactNode;

  /**
   * Show current date on the right side
   * @default false
   */
  showDate?: boolean;

  /**
   * Optional date string (if showDate is true)
   * @default current date in locale format
   */
  dateString?: string;

  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Unified View Header Component
 * 
 * Provides consistent header styling across all tab views.
 * Supports title, subtitle, and optional right-side content (version, date, buttons).
 * 
 * @example
 * ```tsx
 * // Simple header with title only
 * <ViewHeader title="Dashboard" />
 * 
 * // With subtitle
 * <ViewHeader 
 *   title="Settings"
 *   subtitle="Manage your account preferences"
 * />
 * 
 * // With version badge
 * <ViewHeader 
 *   title="Settings"
 *   rightContent={<VersionBadge version="0.1.0" />}
 * />
 * 
 * // With date display
 * <ViewHeader 
 *   title="Dashboard"
 *   subtitle="Daily overview"
 *   showDate={true}
 * />
 * 
 * // With custom right content
 * <ViewHeader 
 *   title="Transactions"
 *   rightContent={
 *     <div className="header-actions">
 *       <button>New Entry</button>
 *       <button>Sync</button>
 *     </div>
 *   }
 * />
 * ```
 */
export function ViewHeader({
  title,
  subtitle,
  rightContent,
  showDate = false,
  dateString,
  className = '',
}: ViewHeaderProps) {
  const { isOnline } = useNetworkStatus();
  const { t } = useTranslation();

  return (
    <header className={`view-header ${className}`}>
      <div className="view-header__left">
        <div className="view-header__text">
          <h1 className="view-header__title">{title}</h1>
          {subtitle && <p className="view-header__subtitle">{subtitle}</p>}
        </div>
        {showDate && <span className="view-header__date">{dateString}</span>}
      </div>
      <div className="view-header__right">
        {!isOnline && (
          <span className="network-status network-status--offline">
            ⚠️ {t('capture.offline')}
          </span>
        )}
        {rightContent}
      </div>
    </header>
  );
}
