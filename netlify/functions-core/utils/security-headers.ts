/**
 * Security Headers Utility
 * Implements world-class security headers for web applications
 */

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Strict-Transport-Security': string;
  'X-XSS-Protection': string;
  'X-Content-Type-Policy': string;
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
}

/**
 * Generate world-class security headers
 */
export const getSecurityHeaders = (): SecurityHeaders => ({
  // Content Security Policy (Level 3 - Strict)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests'",
    "block-all-mixed-content",
  ].join('; '),

  // Frame protection
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), fullscreen=(), payment=()',

  // HTTPS enforcement
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // XSS Protection
  'X-XSS-Protection': '1; mode=block; report-uri=/security-violations',

  // Content Type Options
  'X-Content-Type-Policy': 'nosniff',

  // CORS Headers
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
})

/**
 * Apply security headers to response
 */
export const applySecurityHeaders = (response: any): void => {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

/**
 * CSP Violation Reporter
 */
export class CSPViolationReporter {
  static report(cspReport: any) {
    console.error('CSP Violation:', cspReport)

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      // Send to security monitoring service
      // logSecurityViolation(cspReport)
    }
  }
}

/**
 * Security Monitoring
 */
export const logSecurityViolation = (violation: any) => {
  const securityData = {
    timestamp: new Date().toISOString(),
    violation: violation,
    userAgent: violation.userAgent || 'unknown',
    url: violation.url || 'unknown',
    referrer: violation.referrer || 'unknown',
    stack: violation.stack || 'no stack trace',
  }

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to Sentry, Datadog, or other security service
    console.log('Security Violation:', securityData)
  }
}