/**
 * Admin Login Page
 */

import { useState, type FormEvent } from 'react';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

export function Login({ onLogin, error, isLoading }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      await onLogin(email, password);
    } catch {
      // Error is handled by parent
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-app-text">Yorutsuke</h1>
          <p className="text-app-text-secondary mt-2">Admin Panel</p>
        </div>

        {/* Login Form */}
        <div className="bg-app-surface border border-app-border rounded-lg p-8">
          <h2 className="text-xl font-semibold text-app-text mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm text-app-text-secondary mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-lg
                           text-app-text placeholder-app-text-secondary
                           focus:outline-none focus:border-app-accent
                           disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm text-app-text-secondary mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-lg
                           text-app-text placeholder-app-text-secondary
                           focus:outline-none focus:border-app-accent
                           disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 bg-app-accent text-white rounded-lg font-medium
                         hover:bg-app-accent/80 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-app-text-secondary text-sm mt-6">
          Contact administrator for access
        </p>
      </div>
    </div>
  );
}
