import { query } from './db';
import { HandlerEvent } from '@netlify/functions';

/**
 * Audit Log Entry Interface
 */
export interface AuditLogEntry {
  user_id: string;
  user_email?: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  before_value?: any;
  after_value?: any;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Actions
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'EXPORT'
  | 'IMPORT'
  | 'VIEW';

/**
 * Audit Resource Types
 */
export type AuditResourceType =
  | 'employee'
  | 'leave_request'
  | 'leave_balance'
  | 'leave_policy'
  | 'leave_type'
  | 'shift_swap'
  | 'shift_swap_request'
  | 'department'
  | 'company_holiday'
  | 'company_settings'
  | 'user_session'
  | 'report';

/**
 * Get client IP address from event
 */
export function getClientIP(event: HandlerEvent): string | undefined {
  // Try various headers in order of preference
  const headers = event.headers;

  // X-Forwarded-For (most common with proxies/load balancers)
  const xForwardedFor = headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Take the first IP if there are multiple
    return xForwardedFor.split(',')[0].trim();
  }

  // X-Real-IP (nginx)
  const xRealIP = headers['x-real-ip'];
  if (xRealIP) {
    return xRealIP;
  }

  // CF-Connecting-IP (Cloudflare)
  const cfConnectingIP = headers['cf-connecting-ip'];
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // True-Client-IP (Akamai, Cloudflare)
  const trueClientIP = headers['true-client-ip'];
  if (trueClientIP) {
    return trueClientIP;
  }

  // Fallback to client IP if available (AWS Lambda specific)
  const clientIP = (event as any).requestContext?.identity?.sourceIp;
  if (clientIP) {
    return clientIP;
  }

  return undefined;
}

/**
 * Get user agent from event
 */
export function getUserAgent(event: HandlerEvent): string | undefined {
  return event.headers['user-agent'];
}

/**
 * Sanitize sensitive data from objects
 * Removes passwords, tokens, secrets, etc.
 */
export function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'password_hash',
    'token',
    'secret',
    'api_key',
    'private_key',
    'access_token',
    'refresh_token',
    'jwt',
    'ssn',
    'credit_card',
    'cvv',
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Log an audit entry
 *
 * @param entry - Audit log entry
 * @param event - Optional Netlify event for IP/User-Agent extraction
 * @returns Promise<boolean> - true if logged successfully
 */
export async function logAudit(
  entry: AuditLogEntry,
  event?: HandlerEvent
): Promise<boolean> {
  try {
    // Extract IP and User-Agent from event if provided
    const ipAddress = entry.ip_address || (event ? getClientIP(event) : undefined);
    const userAgent = entry.user_agent || (event ? getUserAgent(event) : undefined);

    // Sanitize before/after values
    const sanitizedBefore = entry.before_value ? sanitizeData(entry.before_value) : null;
    const sanitizedAfter = entry.after_value ? sanitizeData(entry.after_value) : null;

    // Insert audit log
    // Note: Using actual DB column names: table_name, record_id, old_values, new_values
    await query(
      `INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        entry.user_id,
        entry.action,
        entry.resource_type,  // maps to table_name column
        entry.resource_id,    // maps to record_id column
        sanitizedBefore ? JSON.stringify(sanitizedBefore) : null,  // maps to old_values
        sanitizedAfter ? JSON.stringify(sanitizedAfter) : null,    // maps to new_values
        ipAddress || null,
        userAgent || null,
      ]
    );

    return true;
  } catch (error) {
    // Don't throw - audit logging should never break the main operation
    console.error('[AUDIT] Failed to log audit entry:', error);
    return false;
  }
}

/**
 * Convenience function for CREATE actions
 */
export async function logCreate(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  afterValue: any,
  event?: HandlerEvent,
  metadata?: Record<string, any>
): Promise<boolean> {
  return logAudit(
    {
      user_id: userId,
      action: 'CREATE',
      resource_type: resourceType,
      resource_id: resourceId,
      after_value: afterValue,
      metadata,
    },
    event
  );
}

/**
 * Convenience function for UPDATE actions
 */
export async function logUpdate(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  beforeValue: any,
  afterValue: any,
  event?: HandlerEvent,
  metadata?: Record<string, any>
): Promise<boolean> {
  return logAudit(
    {
      user_id: userId,
      action: 'UPDATE',
      resource_type: resourceType,
      resource_id: resourceId,
      before_value: beforeValue,
      after_value: afterValue,
      metadata,
    },
    event
  );
}

/**
 * Convenience function for DELETE actions
 */
export async function logDelete(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  beforeValue: any,
  event?: HandlerEvent,
  metadata?: Record<string, any>
): Promise<boolean> {
  return logAudit(
    {
      user_id: userId,
      action: 'DELETE',
      resource_type: resourceType,
      resource_id: resourceId,
      before_value: beforeValue,
      metadata,
    },
    event
  );
}

/**
 * Convenience function for APPROVE actions
 */
export async function logApprove(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  event?: HandlerEvent,
  metadata?: Record<string, any>
): Promise<boolean> {
  return logAudit(
    {
      user_id: userId,
      action: 'APPROVE',
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    },
    event
  );
}

/**
 * Convenience function for REJECT actions
 */
export async function logReject(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  event?: HandlerEvent,
  metadata?: Record<string, any>
): Promise<boolean> {
  return logAudit(
    {
      user_id: userId,
      action: 'REJECT',
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    },
    event
  );
}

/**
 * Convenience function for EXPORT actions
 */
export async function logExport(
  userId: string,
  resourceType: AuditResourceType,
  event?: HandlerEvent,
  metadata?: Record<string, any>
): Promise<boolean> {
  return logAudit(
    {
      user_id: userId,
      action: 'EXPORT',
      resource_type: resourceType,
      resource_id: 'export',
      metadata,
    },
    event
  );
}

/**
 * Get diff between two objects (for audit trail)
 */
export function getObjectDiff(before: any, after: any): Record<string, any> {
  const diff: Record<string, any> = {};

  // Get all keys from both objects
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  for (const key of allKeys) {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return diff;
}
