import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, LoginCredentials, AuthState } from '../types/auth';
import api from '../api/auth';
import { resetLineLiffState, tryLineLogout } from '../utils/line-liff';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    requiresPasswordChange: false,
  });

  useEffect(() => {
    const loadUser = () => {
      try {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        // ✅ FIX: Do NOT restore requiresPasswordChange from localStorage
        // This prevents users from getting stuck if they close browser during password change
        // Instead, requiresPasswordChange is only kept in memory during the session
        // If user closes browser, they will be logged out automatically (token remains but session is reset)

        if (token && userStr) {
          const user: User = JSON.parse(userStr);

          setState({
            user,
            token,
            isAuthenticated: true,
            requiresPasswordChange: false, // Always false on page reload - user must login again if they left during password change
            isLoading: false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const endpoint = credentials.line_id_token ? '/auth-line-login' : '/auth-login';
      const response = await api.post(endpoint, credentials);

      if (response.data.success) {
        const { user, token, requires_password_change } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        // ✅ Do NOT store requiresPasswordChange in localStorage
        // This prevents users from getting stuck - it's only kept in memory

        setState({
          user,
          token,
          isAuthenticated: true,
          requiresPasswordChange: requires_password_change || false,
          isLoading: false,
        });
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      setState((prev) => ({ ...prev, isLoading: false }));
      const message =
        error.response?.data?.message ||
        error.message ||
        'Login failed';
      throw new Error(message);
    }
  };

  const logout = () => {
    // Use /auth-logout endpoint
    api.post('/auth-logout').catch(console.error);
    resetLineLiffState();
    tryLineLogout().catch(console.error);

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('requiresPasswordChange');
    // NOTE: Do NOT clear remembered employee code on logout
    // Users want their employee code to be remembered for convenience
    // localStorage.removeItem('rememberedEmployeeCode');

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      requiresPasswordChange: false,
      isLoading: false,
    });
  };

  const refreshUser = async () => {
    try {
      // Use /auth-me endpoint
      const response = await api.get('/auth-me');

      if (response.data.success) {
        const user = response.data.user;
        localStorage.setItem('user', JSON.stringify(user));
        setState((prev) => ({ ...prev, user }));
      } else {
        // Only logout on authentication failure, not on server errors
        if (response.status === 401 || response.status === 403) {
          logout();
        }
      }
    } catch (error: any) {
      console.error('Error refreshing user:', error);
      // Only logout on authentication failures, not on server errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      }
      // For 500 errors or other server issues, don't logout - just log the error
      // This prevents users from being logged out due to temporary server issues
    }
  };

  const completePasswordChange = () => {
    // ✅ No longer need to update localStorage - it's only in memory
    setState((prev) => ({ ...prev, requiresPasswordChange: false }));
  };

  // ✅ NEW: Login with password reset - used after forgot password verification
  // This sets user/token and forces password change modal to appear
  const loginWithPasswordReset = (user: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    setState({
      user,
      token,
      isAuthenticated: true,
      requiresPasswordChange: true, // Force password change modal
      isLoading: false,
    });
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshUser,
    completePasswordChange,
    loginWithPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
