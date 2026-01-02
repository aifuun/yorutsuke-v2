/**
 * Admin Layout Component
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/control', label: 'Control', icon: '🔴' },
  { path: '/costs', label: 'Costs', icon: '💰' },
  { path: '/batch', label: 'Batch', icon: '⚙️' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-app-bg flex">
      {/* Sidebar */}
      <aside className="w-64 bg-app-surface border-r border-app-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-app-border">
          <h1 className="text-2xl font-bold text-app-text">Yorutsuke</h1>
          <p className="text-sm text-app-text-secondary">Admin Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive
                        ? 'bg-app-accent/20 text-app-accent'
                        : 'text-app-text-secondary hover:bg-app-border hover:text-app-text'
                      }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-app-border">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm text-app-text truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-app-text-secondary hover:text-app-text transition-colors"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
