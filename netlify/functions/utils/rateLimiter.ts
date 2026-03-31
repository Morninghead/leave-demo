// Simple in-memory rate limiter for Netlify Functions
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// Store rate limit data in memory (will reset on function cold start)
const store: RateLimitStore = {};

/**
 * Simple rate limiter implementation
 * @param identifier Unique identifier (IP address, user ID, etc.)
 * @param windowMs Time window in milliseconds
 * @param maxAttempts Maximum attempts allowed in the window
 * @returns Object with success status and retry information
 */
export function rateLimit(
  identifier: string,
  windowMs: number = 15 * 60 * 1000, // 15 minutes default
  maxAttempts: number = 20 // 20 attempts default (increased for development)
): { success: boolean; remaining: number; resetTime: number } {
  // Bypass rate limiting in development
  const isDevelopment = process.env.NODE_ENV === 'development' ||
                        process.env.NETLIFY_DEV === 'true' ||
                        identifier === 'localhost' ||
                        identifier === '127.0.0.1' ||
                        identifier === '::1';

  if (isDevelopment) {
    return {
      success: true,
      remaining: maxAttempts,
      resetTime: Date.now() + windowMs
    };
  }

  const now = Date.now();

  // Clean up expired entries
  for (const key in store) {
    if (now > store[key].resetTime) {
      delete store[key];
    }
  }

  const existing = store[identifier];

  if (!existing || now > existing.resetTime) {
    // First request or expired window
    store[identifier] = {
      count: 1,
      resetTime: now + windowMs
    };
    return {
      success: true,
      remaining: maxAttempts - 1,
      resetTime: now + windowMs
    };
  }

  if (existing.count >= maxAttempts) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: existing.resetTime
    };
  }

  // Increment counter
  existing.count++;
  return {
    success: true,
    remaining: maxAttempts - existing.count,
    resetTime: existing.resetTime
  };
}

/**
 * Enhanced rate limiting for sensitive operations (login, password change, etc.)
 * More restrictive limits for high-risk operations
 */
export function rateLimitSensitive(
  identifier: string,
  operation: 'login' | 'password' | 'file-upload' | 'admin' = 'login'
): { success: boolean; remaining: number; resetTime: number } {
  // Different limits for different operations
  const limits = {
    'login': { windowMs: 15 * 60 * 1000, maxAttempts: 5 },     // 5 attempts per 15 minutes
    'password': { windowMs: 60 * 60 * 1000, maxAttempts: 3 },  // 3 attempts per hour
    'file-upload': { windowMs: 60 * 1000, maxAttempts: 10 },   // 10 uploads per minute
    'admin': { windowMs: 60 * 60 * 1000, maxAttempts: 20 }     // 20 admin actions per hour
  };

  const config = limits[operation];
  return rateLimit(identifier, config.windowMs, config.maxAttempts);
}

/**
 * Get client IP address from Netlify event
 */
export function getClientIP(event: any): string {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    event.requestContext?.identity?.sourceIp ||
    'unknown'
  );
}

/**
 * Generate a unique request ID for monitoring and debugging
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}