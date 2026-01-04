import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Camera, BookOpen, Settings } from 'lucide-react';
import type { UserId } from '../00_kernel/types';
import './Sidebar.css';

export type ViewType = 'dashboard' | 'ledger' | 'capture' | 'settings';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  userId: UserId | null;
}

const NAV_ITEMS: Array<{ view: ViewType; icon: typeof LayoutDashboard; labelKey: string }> = [
  { view: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { view: 'ledger', icon: BookOpen, labelKey: 'nav.ledger' },
  { view: 'capture', icon: Camera, labelKey: 'nav.capture' },
  { view: 'settings', icon: Settings, labelKey: 'nav.settings' },
];

export function Sidebar({ activeView, onViewChange, userId }: SidebarProps) {
  const { t } = useTranslation();

  // Generate user initials from userId
  const userInitials = userId
    ? userId.toString().slice(0, 2).toUpperCase()
    : 'GU';

  return (
    <aside className="sidebar">
      <div className="brand">
        <span>{t('app.name')}</span>
      </div>

      <nav className="nav-group">
        {NAV_ITEMS.map(({ view, labelKey }) => (
          <div
            key={view}
            className={`nav-item ${activeView === view ? 'active' : ''}`}
            onClick={() => onViewChange(view)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onViewChange(view)}
          >
            <span>{t(labelKey)}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{userInitials}</div>
          <span className="user-name">
            {userId ? userId.toString().slice(0, 12) : t('auth.guest')}
          </span>
        </div>
      </div>
    </aside>
  );
}
