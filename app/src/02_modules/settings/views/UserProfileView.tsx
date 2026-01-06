// Pillar L: View - User profile and account management
import { useAuth } from '../../auth';
import { useTranslation } from '../../../i18n';
import { ask } from '@tauri-apps/plugin-dialog';
import { User, Crown, LogOut, UserPlus, LogIn, AlertTriangle } from 'lucide-react';
import '../styles/settings.css';

// TODO: Get from quota service
const QUOTA_USED = 12;
const QUOTA_LIMIT = 50;
const DAYS_REMAINING = 53;

export function UserProfileView() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    const confirmed = await ask(t('settings.logoutConfirm'), {
      title: 'Logout',
      kind: 'warning',
    });
    if (confirmed) {
      await logout();
    }
  };

  const isGuest = !user?.email;
  const quotaPercent = Math.round((QUOTA_USED / QUOTA_LIMIT) * 100);

  return (
    <div className="settings">
      <header className="settings-header">
        <h1 className="settings-title">{t('settings.profile')}</h1>
      </header>

      <div className="settings-content">
        <div className="settings-container">
          {/* Single Profile Card */}
          <div className="card card--settings card--profile">
            {/* Identity Header */}
            <div className="profile-header">
              <div className="profile-header__avatar">
                {isGuest ? <User size={24} /> : user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="profile-header__info">
                <span className="profile-header__mode">
                  {isGuest ? t('auth.guestMode') : user?.email}
                </span>
                <span className="profile-header__plan">
                  <Crown size={12} />
                  {user?.tier || 'Free'} Plan
                </span>
              </div>
            </div>

            {/* Usage Section */}
            <div className="profile-usage">
              <div className="profile-usage__header">
                <span className="profile-usage__label">{t('profile.uploadUsage')}</span>
                <span className="profile-usage__count">{QUOTA_USED} / {QUOTA_LIMIT}</span>
              </div>
              <div className="profile-usage__track">
                <div className="profile-usage__fill" style={{ width: `${quotaPercent}%` }} />
              </div>
            </div>

            {/* Warning Box (Guest only) */}
            {isGuest && (
              <div className="profile-warning">
                <AlertTriangle size={18} className="profile-warning__icon" />
                <div className="profile-warning__text">
                  <p className="profile-warning__title">
                    {t('profile.expiresIn', { days: DAYS_REMAINING })}
                  </p>
                  <p className="profile-warning__hint">{t('profile.registerToSecure')}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="profile-actions">
              {isGuest ? (
                <>
                  <button type="button" className="btn btn--primary btn--lg">
                    <UserPlus size={18} />
                    {t('profile.registerToSave')}
                  </button>
                  <button type="button" className="btn btn--ghost">
                    <LogIn size={16} />
                    {t('profile.alreadyHaveAccount')}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--primary btn--lg">
                    {t('settings.upgrade')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--danger-text" onClick={handleLogout}>
                    <LogOut size={16} />
                    {t('settings.logout')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
