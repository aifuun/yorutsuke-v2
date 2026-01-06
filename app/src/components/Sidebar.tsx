import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Camera, BookOpen, Settings, Wrench } from 'lucide-react';
import type { UserId } from '../00_kernel/types';
import './Sidebar.css';

export type ViewType = 'dashboard' | 'ledger' | 'capture' | 'settings' | 'profile' | 'debug';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  userId: UserId | null;
  isDebugUnlocked?: boolean;
}

const NAV_ITEMS: Array<{ view: ViewType; icon: typeof LayoutDashboard; labelKey: string; debugOnly?: boolean }> = [
  { view: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { view: 'ledger', icon: BookOpen, labelKey: 'nav.ledger' },
  { view: 'capture', icon: Camera, labelKey: 'nav.capture' },
  { view: 'settings', icon: Settings, labelKey: 'nav.settings' },
  { view: 'debug', icon: Wrench, labelKey: 'nav.debug', debugOnly: true },
];

export function Sidebar({ activeView, onViewChange, userId, isDebugUnlocked = false }: SidebarProps) {
  const { t } = useTranslation();

  // Generate user initials from userId
  const userInitials = userId
    ? userId.toString().slice(0, 2).toUpperCase()
    : 'GU';

  // Filter nav items based on debug unlock status
  const visibleNavItems = NAV_ITEMS.filter(item => !item.debugOnly || isDebugUnlocked);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span>{t('app.name')}</span>
      </div>

      <nav className="nav-group">
        {visibleNavItems.map(({ view, labelKey }) => (
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
        <div
          className={`user-card ${activeView === 'profile' ? 'active' : ''}`}
          onClick={() => onViewChange('profile')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onViewChange('profile')}
        >
          <div className="user-avatar">{userInitials}</div>
          <span className="user-name">
            {userId ? userId.toString().slice(0, 12) : t('auth.guest')}
          </span>
        </div>
      </div>
    </aside>
  );
}
