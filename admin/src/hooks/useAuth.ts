/**
 * Authentication Hook using Amazon Cognito
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

// Cognito configuration from environment
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '';

const userPool = userPoolId && clientId
  ? new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    })
  : null;

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { email: string } | null;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
}

/**
 * Get stored user from localStorage
 */
function getStoredUser(): { email: string } | null {
  const stored = localStorage.getItem('admin_user');
  return stored ? JSON.parse(stored) : null;
}

/**
 * Store user to localStorage
 */
function storeUser(user: { email: string } | null): void {
  if (user) {
    localStorage.setItem('admin_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('admin_user');
  }
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Check current session on mount
  useEffect(() => {
    if (!userPool) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'Cognito not configured',
      });
      return;
    }

    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        storeUser(null);
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
        return;
      }

      const email = session.getIdToken().payload.email as string;
      const user = { email };
      storeUser(user);
      setState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      });
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    if (!userPool) {
      throw new Error('Cognito not configured');
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const userEmail = session.getIdToken().payload.email as string;
          const user = { email: userEmail };
          storeUser(user);
          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            error: null,
          });
          resolve();
        },
        onFailure: (err) => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: err.message || 'Login failed',
          }));
          reject(err);
        },
        newPasswordRequired: () => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: 'Password change required. Contact admin.',
          }));
          reject(new Error('New password required'));
        },
      });
    });
  }, []);

  const logout = useCallback(() => {
    if (!userPool) return;

    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.signOut();
    }
    storeUser(null);
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    });
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!userPool) return null;

    const currentUser = userPool.getCurrentUser();
    if (!currentUser) return null;

    return new Promise((resolve) => {
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      });
    });
  }, []);

  return {
    ...state,
    login,
    logout,
    getAccessToken,
  };
}

/**
 * Check if user is stored (for quick checks without hook)
 */
export function hasStoredUser(): boolean {
  return getStoredUser() !== null;
}
