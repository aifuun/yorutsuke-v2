/**
 * Login View
 * User authentication form with email/password inputs
 *
 * Issue #168: Complete Auth Module 4-Layer Architecture
 * Pillar L: View uses hooks only, no direct service access
 * Design: Follows FORMS.md and BUTTONS.md specifications
 */

import { useState, FormEvent } from 'react';
import { useAuthStatus, useAuthError, useAuthActions } from '../hooks/useAuthState';
import './LoginView.css';

export function LoginView() {
  // Hook Bridge Layer (ADR-020) - Connector & Selector identities
  const status = useAuthStatus();
  const authError = useAuthError();
  const { login } = useAuthActions();

  // Local UI state (not business state)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const isLoading = status === 'loading';
  const isDisabled = isLoading || !email || !password;

  /**
   * Validate email format (UI validation, not business validation)
   * ADR-020: Format validation in view/hook, business validation in service
   */
  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    }
    if (!value.includes('@')) {
      setEmailError('Invalid email format');
      return false;
    }
    setEmailError(null);
    return true;
  };

  /**
   * Handle form submission
   * Orchestrator identity: Coordinate validation → service call
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Format validation
    if (!validateEmail(email)) {
      return;
    }

    // Delegate business logic to service
    await login(email, password);
  };

  return (
    <div className="login-view">
      <div className="login-card">
        <header className="login-header">
          <h1 className="login-title">Login</h1>
          <p className="login-subtitle">Sign in to your account</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`form-input ${emailError ? 'input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={() => validateEmail(email)}
              disabled={isLoading}
              aria-label="Email address"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
              autoComplete="email"
            />
            {emailError && (
              <p id="email-error" className="form-error" role="alert">
                {emailError}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              aria-label="Password"
              autoComplete="current-password"
            />
          </div>

          {/* Auth Error Message */}
          {authError && (
            <div className="auth-error" role="alert">
              <span className="auth-error-icon">⚠️</span>
              <p className="auth-error-message">{authError}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={isDisabled}
            aria-label={isLoading ? 'Logging in...' : 'Login'}
          >
            {isLoading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Footer Links */}
        <footer className="login-footer">
          <p className="login-footer-text">
            Don't have an account?{' '}
            <a href="#" className="login-link" onClick={(e) => e.preventDefault()}>
              Sign up
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
