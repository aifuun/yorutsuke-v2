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
          {/* Account Card */}
          <div className="card card--settings">
            <h2 className="card--settings__header">{t('settings.account')}</h2>

            {/* Identity Row */}
            <div className="setting-row">
              <div className="setting-row__info">
                <div className="profile-avatar">
                  {isGuest ? <User size={20} /> : user.email?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="setting-row__control">
                <div className="profile-meta">
                  <span className="profile-meta__name">
                    {isGuest ? t('auth.guest') : user?.email}
                  </span>
                  <span className="profile-meta__badge">
                    <Crown size={10} />
                    {user?.tier || 'Free'}
                  </span>
                </div>
              </div>
            </div>

            {/* Usage Row */}
            <div className="setting-row setting-row--stacked">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('profile.uploadUsage')}</p>
              </div>
              <div className="setting-row__control setting-row__control--full">
                <div className="usage-bar">
                  <div className="usage-bar__header">
                    <span className="usage-bar__count">{QUOTA_USED} / {QUOTA_LIMIT}</span>
                  </div>
                  <div className="usage-bar__track">
                    <div className="usage-bar__fill" style={{ width: `${quotaPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Row (Guest only) */}
            {isGuest && (
              <div className="setting-row setting-row--warning">
                <AlertTriangle size={16} className="setting-row__icon" />
                <div className="setting-row__info">
                  <p className="setting-row__label">{t('profile.dataExpiresSoon')}</p>
                  <p className="setting-row__hint">
                    {t('profile.expiresIn', { days: DAYS_REMAINING })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions Card */}
          <div className="card card--settings">
            <h2 className="card--settings__header">
              {isGuest ? t('profile.registerToSave') : t('settings.subscription')}
            </h2>

            {isGuest ? (
              <>
                <div className="setting-row">
                  <div className="setting-row__info">
                    <p className="setting-row__label">{t('auth.register')}</p>
                    <p className="setting-row__hint">{t('profile.registerToSecure')}</p>
                  </div>
                  <div className="setting-row__control">
                    <button type="button" className="btn btn--primary">
                      <UserPlus size={16} />
                      {t('auth.registerNow')}
                    </button>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-row__info">
                    <p className="setting-row__label">{t('auth.login')}</p>
                    <p className="setting-row__hint">{t('profile.alreadyHaveAccount')}</p>
                  </div>
                  <div className="setting-row__control">
                    <button type="button" className="btn btn--secondary">
                      <LogIn size={16} />
                      {t('auth.login')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="setting-row">
                  <div className="setting-row__info">
                    <p className="setting-row__label">{t('settings.currentPlan')}</p>
                    <p className="setting-row__hint">{t('settings.currentPlanHint')}</p>
                  </div>
                  <div className="setting-row__control">
                    <span className="setting-row__value">{user?.tier || 'Free'}</span>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-row__info">
                    <p className="setting-row__label">{t('settings.upgradePlan')}</p>
                    <p className="setting-row__hint">{t('settings.upgradePlanHint')}</p>
                  </div>
                  <div className="setting-row__control">
                    <button type="button" className="btn btn--primary">
                      {t('settings.upgrade')}
                    </button>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-row__info">
                    <p className="setting-row__label">{t('settings.logout')}</p>
                  </div>
                  <div className="setting-row__control">
                    <button type="button" className="btn btn--danger" onClick={handleLogout}>
                      <LogOut size={16} />
                      {t('settings.logout')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
