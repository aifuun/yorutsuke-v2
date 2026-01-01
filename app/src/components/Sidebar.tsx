import { useTranslation } from 'react-i18next';
import { BarChart3, ImagePlus, FileText, History, Settings } from 'lucide-react';
import './Sidebar.css';

export type ViewType = 'report' | 'capture' | 'transactions' | 'history' | 'settings';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const NAV_ITEMS: Array<{ view: ViewType; icon: typeof BarChart3; labelKey: string }> = [
  { view: 'report', icon: BarChart3, labelKey: 'nav.report' },
  { view: 'capture', icon: ImagePlus, labelKey: 'nav.capture' },
  { view: 'transactions', icon: FileText, labelKey: 'nav.transactions' },
  { view: 'history', icon: History, labelKey: 'nav.history' },
  { view: 'settings', icon: Settings, labelKey: 'nav.settings' },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">🌙</span>
        <span>{t('app.name')}</span>
      </div>

      <nav className="nav-group">
        {NAV_ITEMS.map(({ view, icon: Icon, labelKey }) => (
          <div
            key={view}
            className={`nav-item ${activeView === view ? 'active' : ''}`}
            onClick={() => onViewChange(view)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onViewChange(view)}
          >
            <Icon size={18} />
            <span>{t(labelKey)}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="app-version">
          {t('app.tagline')}
        </div>
      </div>
    </aside>
  );
}
