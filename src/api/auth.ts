// src/api/auth.ts
import { logger } from '../utils/logger';
import axios from 'axios';

/**
 * Get API base URL based on deployment platform
 * Supports both Netlify and Vercel platforms
 */
function getApiBaseUrl(): string {
  // Use environment variable if set
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  // Auto-detect platform
  const platform = import.meta.env.VITE_DEPLOYMENT_PLATFORM || 'netlify';

  switch (platform) {
    case 'vercel':
      return '/api';
    case 'netlify':
    default:
      return '/.netlify/functions';
  }
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Check if token is expired (basic check)
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;

        if (tokenData.exp && tokenData.exp < currentTime) {
          logger.warn('⚠️ Token expired, removing from storage');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(new Error('Token expired'));
        }
      } catch {
        logger.warn('⚠️ Invalid token format, continuing...');
      }

      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    logger.error('❌ [API REQUEST ERROR]:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // ✅ Return the response to continue the chain
    return response;
  },
  (error) => {
    // Error logging
    if (process.env.NODE_ENV !== 'production') {
      logger.error('❌ [API RESPONSE ERROR]:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }

    // Handle auth errors (except during login)
    if (error.response?.status === 401) {
      const isLoginRequest =
        error.config?.url?.includes('/auth-login') ||
        error.config?.url?.includes('/auth-line-login');
      const isAlreadyOnLogin = window.location.pathname === '/login';

      // Only auto-logout and redirect if:
      // 1. Not a login request (let login handle its own errors)
      // 2. Not already on login page (prevent redirect loop)
      if (!isLoginRequest && !isAlreadyOnLogin) {
        logger.warn('⚠️ Authentication failed, logging out...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('requiresPasswordChange');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
