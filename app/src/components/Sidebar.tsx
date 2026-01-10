import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Camera, BookOpen, Settings, Wrench, User, ChevronRight } from 'lucide-react';
import { Icon } from './Icon/Icon';
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

  // Filter nav items based on debug unlock status
  const visibleNavItems = NAV_ITEMS.filter(item => !item.debugOnly || isDebugUnlocked);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span>{t('app.name')}</span>
      </div>

      <nav className="nav-group">
        {visibleNavItems.map(({ view, icon: LucideIcon, labelKey }) => (
          <div
            key={view}
            className={`nav-item ${activeView === view ? 'active' : ''}`}
            onClick={() => onViewChange(view)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onViewChange(view)}
          >
            <Icon icon={LucideIcon} size="sm" aria-label={t(labelKey)} />
            <span>{t(labelKey)}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`user-label ${activeView === 'profile' ? 'active' : ''}`}
          onClick={() => onViewChange('profile')}
        >
          <Icon icon={User} size="xs" aria-label={t('nav.profile')} />
          <span>{userId ? userId.toString().slice(0, 16) : t('auth.guest')}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </aside>
  );
}
