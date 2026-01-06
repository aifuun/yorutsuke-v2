// Pillar L: View - User profile and account management
import { useAuth } from '../../auth';
import { useTranslation } from '../../../i18n';
import { ask } from '@tauri-apps/plugin-dialog';
import '../styles/settings.css';

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

  return (
    <div className="settings">
      <header className="settings-header">
        <h1 className="settings-title">{t('settings.profile')}</h1>
      </header>

      <div className="settings-content">
        <div className="settings-container">
          {/* User Avatar & Info */}
          <div className="premium-card settings-card profile-card">
            <div className="profile-header">
              <div className="profile-avatar">
                {isGuest ? '👤' : user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="profile-info">
                <h2 className="profile-name">{user?.email || t('auth.guest')}</h2>
                <p className="profile-tier">
                  {user?.tier || 'Free'} {t('settings.plan')} • 30 images/day
                </p>
              </div>
            </div>

            {!isGuest && (
              <button
                type="button"
                className="btn-action btn-action--dark btn-full"
                onClick={handleLogout}
              >
                {t('settings.logout')}
              </button>
            )}
          </div>

          {/* Guest Mode Warning */}
          {isGuest && (
            <div className="guest-warning">
              <div className="guest-warning__icon">👤</div>
              <div className="guest-warning__content">
                <p className="guest-warning__title">{t('auth.guestMode')}</p>
                <p className="guest-warning__text">{t('auth.guestWarning')}</p>
                <div className="guest-warning__actions">
                  <button className="btn-action btn-action--warning">{t('auth.registerNow')}</button>
                  <button className="btn-action btn-action--ghost">{t('auth.login')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Subscription Info (for logged-in users) */}
          {!isGuest && (
            <div className="premium-card settings-card">
              <h2 className="section-header">{t('settings.subscription')}</h2>

              <div className="setting-row">
                <div className="setting-info">
                  <p className="setting-label">{t('settings.currentPlan')}</p>
                  <p className="setting-hint">{t('settings.currentPlanHint')}</p>
                </div>
                <span className="setting-value">{user?.tier || 'Free'}</span>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <p className="setting-label">{t('settings.upgradePlan')}</p>
                  <p className="setting-hint">{t('settings.upgradePlanHint')}</p>
                </div>
                <button className="btn-action btn-action--primary">
                  {t('settings.upgrade')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
