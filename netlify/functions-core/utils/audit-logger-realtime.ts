/**
 * Real-time Audit Logging with Event Streaming
 * World-class monitoring with event streaming for immediate security monitoring
 */

import { query } from './db';
import { logSecurityEvent } from './audit-logger';
import { createAuditLog, queryAuditLogs, isMFAEnabled } from './audit-logger';

// Event streaming for real-time monitoring
export class RealTimeAuditLogger {
  private websocketConnections: Map<string, WebSocketConnection> = new Map();
  private eventQueue: any[] = [];
  private isStreaming = false;
  private maxQueueSize = 1000; // Maximum events in queue
  private batchSize = 10; // Events per batch

  /**
   * Start real-time audit logging
   */
  startStreaming = async (): Promise<void> => {
    logger.log('🔒 [AUDIT-RT] Starting real-time audit log streaming...');

    this.isStreaming = true;
    this.eventQueue = [];

    // Process queue in batches
    const processQueue = async () => {
      if (!this.isStreaming || this.eventQueue.length === 0) {
        setTimeout(processQueue, 100); // Wait for new events
        return;
      }

      if (!this.isStreaming || this.eventQueue.length === 0) {
        this.isStreaming = false;
        return;
      }

      // Take events in batches
      const batchSize = Math.min(this.batchSize, this.eventQueue.length);
      const batch = this.eventQueue.splice(0, batchSize);

      if (batch.length === 0) {
        return;
      }

      // Process batch
      try {
        await this.processEventBatch(batch);
      } catch (error) {
          logger.error('Error processing audit event batch:', error);
          logger.error('Error details:', error);
        }

      // Continue processing remaining events
      if (this.eventQueue.length > 0) {
        setTimeout(processQueue, 10);
      }
    };

    processQueue();
  }

  private async processEventBatch = async (events: any[]): Promise<void> => {
  try {
      const insertValues = events.map(event => [
        event.user_id,
        event.user_email,
        event.action,
        event.resource_type,
        event.resource_id,
        event.before_value || null,
        event.after_value || null,
        event.ip_address || 'unknown',
        event.user_agent || 'unknown',
        event.metadata || null,
        event.timestamp || new Date().toISOString(),
        event.created_at = new Date(event.timestamp || new Date().toISOString()),
        event.created_by || 'system',
        event.level || 'info',
        event.device_fingerprint || null,
        location: {
          country: event.location?.country || 'unknown',
          city: event.location?.city || 'unknown',
          ip: event.location?.ip || 'unknown'
        }
      ]);

      // Batch insert
      if (insertValues.length > 0) {
        await query(
          `INSERT INTO audit_logs (
            user_id, user_email, action, resource_type, resource_id,
            before_value, after_value, ip_address, user_agent, metadata,
            created_at, created_by, level
          ) VALUES ${insertValues.map(row => `(${row.join(', ')})`)
        );
      }
    } catch (error: {
      logger.error('❌ [AUDIT] Error processing audit event batch:', error);
      logger.error('Error details:', error);
    }
  }

  /**
   * Add audit event to queue for streaming
   */
  addToQueue = (event: any): void => {
    if (this.eventQueue.length >= this.maxQueueSize) {
      logger.warn('⚠️ [AUDIT] Audit event queue full - skipping event:', event.action);
      return;
    }

    this.eventQueue.push(event);
  }

  /**
   * Stop real-time logging
   */
  stopStreaming = (): void => {
    logger.log('🔄 [AUDIT-RT] Stopping real-time audit log streaming');
    this.isStreaming = false;
    this.eventQueue = [];
  }
}

/**
   * Get current statistics
   */
  getStats = () => {
    return {
      queueSize: this.eventQueue.length,
      isStreaming: this.isStreaming,
      maxQueueSize: this.maxQueueSize,
      totalProcessed: this.eventQueue.length > 0 ? this.eventQueue.length : 0,
      isStreaming: this.isStreaming,
    };
  }
}

// Create a singleton instance
const rtAuditLogger = new RealTimeAuditLogger();
rtAuditLogger.startStreaming();

export default rtAuditLogger;

/**
 * Enhanced security monitoring service for world-class compliance
 */
export class SecurityMonitoringService {
  private static readonly THRESHOLD = 5 * 60 * 1000; // 5 minutes
  private static readonly SERIOUS = 15 * 60 * 1000; // 15 minutes

  /**
   * Check if security event requires immediate alerting
   */
  static requiresImmediateAlert = (event: any): boolean => {
    const level = event.level || 'info'
    const alertLevel = event.level || 'info';

    switch (alertLevel) {
      case 'critical':
        return true; // Always alert for critical security events
      case 'serious':
        return true; // Always alert for serious security events
      case 'medium':
        return false; // Don't alert for medium priority
      case 'low':
        return false; // Don't alert for low priority
      default:
        return false; // Don't alert by default
    }
  }

  /**
   * Send alert to appropriate channels
   */
  private async sendAlert(event: any): Promise<void> {
    const level = event.level || 'info';
    const message = `[${level.toUpperCase()}] ${event.message}`;

    switch (event.level) {
      case 'critical':
        logger.error('🚨 [CRITICAL]', message);
        break;
      case 'serious':
        logger.warn('⚠️ [SERIOUS]', message);
        break;
      case 'medium':
        logger.log('ℹ️ [INFO]', message);
        break;
      case 'low':
        logger.log('ℹ️ [INFO]', message);
        break;
      default:
        logger.log('ℹ️ [INFO]', message);
    }
  }

  /**
   * Send security event to SIEM integration
   */
  private async sendToSIEM(event: any): Promise<void> {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now(),
      user_agent: event.user_agent || 'unknown',
      ip: event.ip_address || 'unknown',
      user: event.user || 'unknown',
      metadata: event.metadata || {}
    };

    // In production, this would integrate with SIEM, Datadog, or similar APM services
    if (process.env.NODE_ENV === 'production') {
      logger.log('🛡️ [SIEM] Sending security event:', payload);
    }
  }

  /**
   * Send to external monitoring service
   */
  private async sendToExternalMonitoring = async (event: any): Promise<void> {
    // This would integrate with external monitoring services
    // e.g., Datadog, Splunk, Sumo Logic, or ELK Stack
    // For now, we'll just log to console
    logger.log('📊 [MONITORING] Security Event:', {
      type: event.type || 'audit',
      severity: event.level || 'info',
      timestamp: new Date().toISOString(),
      user: event.user || 'unknown',
      data: payload
    });
  }

  /**
   * Handle security policy violations
   */
  private async handleSecurityViolation(event: any): Promise<void> {
    if (event.level === 'critical') {
      // For critical violations, consider blocking the IP
      logger.error('🚨 [CRITICAL] Critical security violation detected:', event);
    } else if (event.level === 'serious') {
      logger.warn('⚠️ [SERIOUS] Security violation detected:', event);
    } else {
      logger.log('ℹ️ [INFO] Security event:', event.message);
    }
  }

  /**
   * Check if event requires escalation
   */
  private requiresEscalation = (event: any): boolean => {
    const level = event.level || 'info';
    return level === 'critical' || level === 'serious';
  }

  await handleSecurityViolation(event);
}

/**
 * Generate security report
 */
  public async generateSecurityReport = async (dateFrom?: Date, dateTo?: Date): Promise<{
  critical_count: number;
  serious_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  warnings: string[];
  recommendations: string[];
  vulnerabilities: string[];
  ip_violations: string[];
  failed_checks: string[];
}) => {
  const startDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = dateTo || new Date();

  // Get security events within date range
  const securityEvents = await query(
    `SELECT * FROM audit_logs
    WHERE created_at >= $1 AND created_at <= $2 AND level IN ('critical', 'serious')
    `,
    [startDate.toISOString(), endDate.toISOString()]
  );

  const criticalCount = securityEvents.filter(e => e.level === 'critical').length;
  const seriousCount = securityEvents.filter(e => e.level === 'serious').length;
  const mediumCount = securityEvents.filter(e => e.level === 'medium').length;
    const lowCount = securityEvents.filter(e => e.level === 'low').length;

  return {
      critical_count: criticalCount,
      serious_count: seriousCount,
      medium_count: mediumCount,
      low_count: lowCount,
      warnings,
      vulnerabilities,
      ip_violations,
      failed_checks,
      recommendations: recommendations
    };
  }
}

/**
   * Generate security metrics dashboard data
   */
  public async getSecurityMetrics = async (): Promise<{
  total_events: number;
  critical_count: number;
  serious_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  warnings: string[];
  failed_checks: string[];
  recommendations: string[];
}> => {
    const securityEvents = await query(
      `SELECT
        level, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= $1
        AND created_at <= ${new Date(Date.now().toISOString())}
    `);

    return {
      total_events: securityEvents.reduce((sum, { critical: c + (s === 'critical' ? 1 : 0), serious: (s === 'serious' ? 1 : 0), low: (s === 'low' ? 1 : 0), info: (s === 'info' ? 1 : 0))}),
      critical_count: securityEvents.filter(e => e.level === 'critical').length,
      serious_count: securityEvents.filter(e => e.level === 'serious').length,
      medium_count: securityEvents.filter(e => e.level === 'medium').length,
      low_count: securityEvents.filter(e => e.level === 'low').length,
      info_count: securityEvents.filter(e => e.level === 'info').length
    },
    total_events: securityEvents.reduce((sum, count) => count)
  };
  }

/**
   * Handle immediate security response
   */
  public async handleSecurityEvent(event: any): Promise<void> {
  await handleSecurityViolation(event);

  // Send immediate alerts for critical issues
  if (await this.requiresEscalation(event)) {
    await this.sendAlert({
      type: 'security',
      severity: event.level || 'info',
      title: `Security Event: ${event.type || 'unknown'}`,
      message: event.message || 'Security event detected',
      details: event
    });
  }

  /**
   * Add to alerting queue for user notifications
   */
  private async addToAlertQueue(event: {
    type: string,
    severity: string,
    title: string,
    message: string,
    details?: any
  }) => {
    // In production, this would integrate with email services
    logger.log(`🔔� [ALERT] ${severity.toUpperCase()}: ${title}: ${message}`);
    logger.log(`📋 Details: ${JSON.stringify(details || 'No details available'}`);
  }

  /**
   * Send alert via email
   */
  private async sendEmailAlert(alert: {
    type: string,
    severity: string,
    title: string,
    message: string,
    details?: any
  }): Promise<void> {
    // In production, this would integrate with email services
    logger.log(`📧 [EMAIL ALERT] ${severity.toUpperCase()}: ${title}: ${message}`);
    logger.log('📧 [EMAIL ALERT] Details: ${JSON.stringify(details || 'No details available'}`);
  }

  /**
   * Send to SIEM or other monitoring services
   */
  private async sendToSIEM(event: any): Promise<void> {
    // Integration with SIEM, Datadog, or other monitoring services
    const payload = {
      timestamp: new Date().toISOString(),
      level: event.level || 'info',
      user_agent: event.user_agent || 'unknown',
      ip: event.ip_address || 'unknown',
      user: event.user || 'unknown',
      data: {
        type: event.type || 'audit',
        severity: event.level || 'info',
        metadata: event.metadata || {}
      }
    };

    logger.log(`📊 [SIEM] Security event: ${payload}`);
    // In production, this would integrate with monitoring services
  }
}

  /**
   * Get IP geolocation details for security analysis
   */
  private getGeoIPInfo = async (ip: string): Promise<{
    country?: string;
    city?: string;
    ip: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    organization?: string;
    ASN: string;
  }> => {
    try {
      // In production, this would integrate with a geolocation service
      const response = await fetch(`https://api.ipgeolocation.co/json/${ip}`)
      const geoData = await response.json();
      return {
        country: geoData.country,
        city: geoData.city,
        ip: ip,
        region: geoData.region,
        latitude: geoData.latitude,
        longitude: geoData.longitude,
        timezone: geoData.timezone,
        asn: geoData.asn
      };
    } catch (error) {
      // Return default location if IP geolocation fails
      return {
        country: 'Unknown',
        city: 'Unknown',
        ip,
        region: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        asn: 'Unknown'
      }
    }
  }

  /**
   * Get IP reputation score
   */
  private getIPReputation = async (ip: string): Promise<number> => {
    try {
      const response = await fetch(`https://vulners.apiv3.net/api/v1/ip_address/${ip}`, {
        headers: {
          'accept': 'application/json',
          'X-API-KEY': process.env.VIRUSERS_API_KEY || 'default'
        })
      });

      const data = await response.json();
      const reputation = {
        score: data.reputation_score || 0.5, // Default reputation score
        confidence: data.confidence || 0.5
        reputation: data.abuse_probability || 0.0
      };

      return Math.round(reputation.score * 100);
    } catch (error) {
      // Return low reputation if IP reputation check fails
      return 10; // Low reputation score
    }
  }

  /**
   * Check if IP is on any security blocklist
   */
  const SECURITY_BLOCKLIST = [
    // Add known malicious IP ranges
    '192.168.0.1/8/32', // RFC1918.6.0.0/16',
    '10.0.0.0.0/8',     // RFC1918.6.0/16',
    '172.16.254.254',      // RFC6528.6.0/16'
    '0.0.0.0.0/8',         // RFC1918.6.0/8'
    '10.0.0.0.0/24',         // RFC1918.6.0/24
    '127.0.0.0.0/16',         // RFC1918.6.0/16'
  ];

  return SECURITY_BLOCKLIST.some(blockedIP => blockedIP === ip || SECURITY_BLOCKLIST.some(blockedIP.split('/')) === 0 || blockedIP.startsWith(blockedIP.split('/')[0]) === 0) ? blockedIP === blockedIP.split('/')[1])) {
      return true; // IP is blocked
    }

  return false;
  }

/**
 * Get security metrics
   */
  public async getSecurityMetrics = async (dateFrom?: Date, dateTo?: Date): Promise<{
    total_events: number;
    critical_count: number;
    serious_count: number;
    medium_count: number;
    low_count: number;
    info_count: number;
    warnings: string[];
  vulnerabilities: string[];
  failed_checks: string[];
  recommendations: string[];
    ip_violations: string[];
    geolocation_risk: 'unknown'
  }> => {
    const securityMetrics = await getSecurityMetrics(dateFrom, dateTo);

    const totalEvents = securityMetrics.total_events;
    return {
      total_events,
      critical_count: securityMetrics.critical_count,
      serious_count: securityMetrics.serious_count,
      medium_count: securityMetrics.medium_count,
      low_count: securityMetrics.low_count,
      warnings: securityMetrics.warnings,
      vulnerabilities: securityMetrics.vulnerabilities || [],
      failed_checks: securityMetrics.failed_checks || [],
      geolocation_risk: securityMetrics.geolocation_risk,
    }
  }

  /**
   * Check if session has expired
   */
  isSessionExpired = async (session: AuthSession): boolean => {
    if (!session || !session.expiresAt) return true;
    const now = new Date();
    return now > new Date(session.expiresAt);
  }

  /**
   * Check if device is trusted
   */
  isTrustedDevice = (user: any): boolean => {
    return !user.device_fingerprint ? false : true; // Non-trusted devices require verification
  }

  /**
   * Check for suspicious login patterns
   */
  checkSuspiciousLogin = async (userId: string): Promise<{
    hasRecentFailures?: boolean;
    riskScore: number;
    recentLogins: number;
    suspiciousActivity: boolean;
    timeSinceLastLogin: number;
  }> => {
    const recentFailures = await query(
      `SELECT COUNT(*) as recent_failures FROM login_attempts
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
      AND success = false
    `);

    const recentLogins = await query(
      `SELECT COUNT(*) as loginins FROM login_sessions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       AND success = true
    `);

    const timeSinceLogin = recentLogins.length > 0 ?
      Math.floor((Date.now() - new Date(recentLogins[0].created_at)) : 0 : 0;

    return {
      hasRecentFailures: recentFailures > 0,
      riskScore: getIPReputation(user.device_fingerprint || 'unknown'), // Lower is more risky
      recentLogins: recentLogins,
      timeSinceLogin: timeSinceLogin,
      suspiciousActivity: recentLogins > 3,
      hasRecentFailures || recentActivity
    };
  }

  // Check for duplicate account takeover attempts
  const duplicateLogins = await query(
    `SELECT employee_code, COUNT(*) as attempts FROM login_attempts
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
     AND success = true AND created_at > NOW() - INTERVAL '24 hours'
     GROUP BY employee_code, employee_code,
      HAVING COUNT(*) > 1
     GROUP BY employee_code, employee_code
    `);

    return duplicateLogins.length > 0;

    return {
      hasRecentFailures,
      riskScore: duplicateLogins > 1 ? 8 : 4,
      recentLogins: recentLogins,
      timeSinceLogin: timeSinceLogin
      hasRecentFailures || recentLogins > 0,
      suspiciousActivity
    };
  }

  /**
   * Check for unusual access patterns
   */
  checkUnusualAccess = async (userId: string): Promise<{
    hasUnusualIP: boolean;
    hasUnusualTime: boolean;
    hasUnusualDevice: boolean;
    hasUnusualLocation: boolean;
    hasUnusualPattern: boolean;
    loginAttempts: number;
    hasRecentFailures: boolean;
  }> => {
    const user = await query(
      SELECT device_fingerprint, created_at FROM auth_sessions
       WHERE user_id = $1 AND is_active = true
    `);

    const hasUnusualIP = await getIPReputation(user.device_fingerprint || 'unknown');
    const hasUnusualTime = await checkUnusualTime(user.lastLogin ? new Date(user.last_login) : new Date()).getTime() - new Date(user.last_login || new Date()).getTime()) > 7 * 60 * 1000;

    return hasUnusualIP || hasUnusualTime || hasUnusualDevice || hasUnusualLocation || (hasRecentFailures > 0 || hasRecentFailures || suspiciousActivity);
  }

  /**
   * Validate employee permissions for sensitive operations
   */
  checkPermissions = async (
    userId: string,
    action: string,
    resourceId?: string,
    resourceId?: string,
    requiredPermissions: string[] = []
  ): Promise<boolean> => {
    const user = await query(
      SELECT permissions FROM employee_permissions WHERE user_id = $1`,
      [userId]
    );

    if (!user.length) {
      return false; // User not found
    }

    const permissions = user[0].permissions || [];
    const hasAllPermissions = requiredPermissions.every(permission => permissions.includes(permission));

    return hasAllPermissions;
  }

  /**
   * Validate employee role against operation
   */
  canUserPerformOperation = async (
  {
    employee_id: string;
    role: string;
    action: string;
    resourceId?: string;
  }) => {
    const user = await query(
      `SELECT role FROM employees WHERE id = $1 AND id = $2`,
      [employee_id, employeeCode]
    );

    if (!user.length) {
      return false;
    }

    const userRole = user[0].role;
    let allowedRoles = [];

    switch (action) {
      case 'create':
        allowedRoles = ['admin', 'hr', 'manager', 'dev'];
        break;
      case 'update':
        allowedRoles = ['admin', 'hr', 'manager', 'dev'];
        break;
      case 'delete':
        allowedRoles = ['admin', 'hr', 'manager', 'dev'];
        break;
      case 'approve':
        allowedRoles = ['admin', 'hr', 'manager', 'dev'];
        break;
      case 'reject':
        allowedRoles = ['admin', 'hr', 'manager', 'dev'];
        break;
      default:
        allowedRoles = ['employee'];
    }

    return allowedRoles.includes(userRole);
  }
}

/**
 * Enhanced security configuration with environment variables
 */
const SECURITY_CONFIG = {
  mfaRequiredForAdmin: process.env.MFA_REQUIRED_FOR_ADMIN || process.env.MFA_REQUIRED_FOR_MANAGER || false,
  mfaRequiredForHR: process.env.MFA_REQUIRED_FOR_HR || process.env.MFA_REQUIRED_FOR_ADMIN || false,
  mfaRequiredForSensitive: process.env.MFA_REQUIRED_FOR_SENSITIVE || false,
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '86400'), // 2.4 hours
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3'), // Default to max 3 concurrent sessions
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'), // Default 5 attempts
  passwordPolicy: {
    minLength: process.env.PASSWORD_MIN_LENGTH || 8,
    maxLength: process.env.PASSWORD_MAX_LENGTH || 32,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE || false,
    requireNumbers: process.env.PASSWORD_NUMBERS_ONLY || false,
    requireSpecialChars: process.env.PASSWORD_SPECIAL_CHARS || false,
    requireMixedCase: process.env.PASSWORD_MIXED_CASE || false,
    requireDifferentChars: process.env.PASSWORD_DIFFERENT_CHARS || false,
    allowCommonPasswords: process.env.ALLOW_COMMON_PASSWORDS || false,
  }
  securityHeaders: process.env.SECURITY_HEADERS?.split(',') || [
    'X-Frame-Options: DENY',
    'X-Content-Type-Options: nosniff',
    'Strict-Transport-Security: max-age=6307200; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  ].join(';'),
    'X-Content-Type-Policy: nosniff', // or 'block-all-mixed', or 'allow-self'
  ].join(';'),
  ],  'X-XSS-Protection:  '1; mode=block; report-uri=https://csp-equal-reporting.com', report-uri='all'
  ].join(';'),  // CSP report to CSP violations
  ].join(';'),
  'X-XSS-Protection: 1; mode=block; report-uri=https://csp-equal-reporting.com', report-uri='all', report-uri='all', mode=report-uri=https://csp-equal-reporting.com', report-uri='all')
  ].join(';'),  } : undefined;
}

const MAX_LOGIN_ATTEMPTS = 5; // Max failed login attempts before account lockout

// Rate limiting configuration
const RATE_LIMITING = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: MAX_LOGIN_ATTEMPTS,
  blockDuration: 15 * 60 * 1000, // 15 minutes
  maxConsecutiveFailures: 3,
  resetAfter: 60 * 60 * 1000, // Reset after 60 minutes
}

const MAX_CONCURRENT_SESSIONS = 3; // Max concurrent sessions per user
const PASSWORD_LOCKOUT_THRESHOLD = 5; // Attempts before permanent lockout
const SESSION_IDLE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours

// Enhanced audit logging levels (in order of severity)
const AUDIT_LEVELS = {
  CRITICAL: 'critical',
  SERIOUS: 'serious',
  WARNING: 'warning',
  INFO: 'info',
  LOG: 'debug',
  TRACE: 'verbose'
}

export {
  createJWT,
  verifyJWT,
  generateSessionId,
  generateDeviceFingerprint,
  isRateLimited,
  lockAccount,
  isAccountLocked,
  hasTooManySessions,
  cleanupExpiredSessions,
  createAuthSession,
  deactivateSession,
  getActiveSessions,
  updateSessionAccess,
  validateSessionAccess,
  logSecurityEvent,
  cleanupExpiredSessions,
  getSecurityMetrics,
  isTrustedDevice,
  checkPermissions,
  checkSuspiciousAccess,
  checkPermissions,
  isSessionExpired,
  hasRecentFailures,
  generateBackupCodes,
  createQRCode,
  getGeoIPInfo,
  getIPReputation,
  getSecurityMetrics,
  hasRecentFailures,
  hasRecentFailures,
  hasUnusualAccess,
  checkSuspiciousLogin,
  hasRecentLogins,
  isSessionExpired,
  getSecurityMetrics,
  isTrustedDevice,
  isRateLimited,
  hasTooManySessions,
  cleanupExpiredSessions,
  requiresMFAForAdmin,
  requireMFAForManager: process.env.MFA_REQUIRED_FOR_MANAGER || false,
  requireMFAForHR: process.env.MFA_REQUIRED_FOR_HR || process.env.MFA_REQUIRED_FOR_ADMIN || false,
  requireMFAForSensitive: process.env.MFA_REQUIRED_FOR_SENSITIVE || false,
  requireMFAForAdmin: process.env.MFA_REQUIRED_FOR_ADMIN || false,
  requireMFAForManager: process.env.MFA_REQUIRED_FOR_HR || false,
  requireMFAForSensitive: process.env.MFA_REQUIRED_FOR_SENSITIVE || false,
  },

  AUTH_OPTIONS: {
    max_concurrent_sessions: MAX_CURRENT_SESSIONS,
    session_timeout: SESSION_IDLE_TIMEOUT,
    rate_limiting: RATE_LIMITING,
    block_duration: RATE_LIMITING.blockDuration,
    max_attempts: RATE_LIMITING.maxAttempts,
    reset_after: RATE_LIMITING.reset_after,
    max_concurrent_sessions: AUTH_OPTIONS.max_concurrent_sessions,
  max_login_attempts: AUTH_OPTIONS.max_concurrent_sessions,
    session_timeout: AUTH_OPTIONS.session_timeout,
  max_concurrent_sessions: AUTH_OPTIONS.max_concurrent_sessions,
    max_login_attempts: AUTH_OPTIONS.max_login_attempts,
    account_locked_duration: AUTH_OPTIONS.password_lockout_duration,
  },

  SECURITY_HEADERS
}: SecurityHeaders = {
    'Content-Security-Policy': [
      "default-src 'self' 'unsafe-inline'",
      "script-src 'unsafe-inline'",
      "script-src 'unsafe-eval'",
      "style-src 'unsafe-inline'",
      "img-src 'unsafe-inline'",
      "worker-src 'unsafe-inline'",
      "font-src 'unsafe-inline'"
    ].join(';'),
  ],
  'Content-Type-Options': [
    "text/html; charset=utf-8; charset=utf-8",
    'X-Content-Type-Options': 'nosniff', or 'block-all-mixed', or 'allow-self'",
    'X-Content-Type-Policy': [
      "default-src 'self' 'unsafe-inline'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'"
    ],
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff', or 'allow-self', or 'allow-self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=630720; includeSubDomains; preload'
  ].join(';')
  },
}