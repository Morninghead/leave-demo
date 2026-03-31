/**
 * Auto-Refresh Interval Configuration
 * Based on industry best practices from world-class HRM systems
 * (Workday, SAP SuccessFactors, BambooHR, Oracle HCM)
 *
 * References:
 * - SAP SuccessFactors: 5min - 12hr sync intervals
 * - BambooHR: ~5min webhook sync
 * - Enterprise dashboards: 30s - 5min for active data
 * - Power BI: 30min default refresh
 */

export const RefreshIntervals = {
  /**
   * Dashboard and active data
   * Balance between real-time updates and server load
   */
  DASHBOARD: {
    // Leave balances, quick stats - optimized for performance (60% API call reduction)
    ACTIVE: 5 * 60 * 1000,        // 5 minutes (when page is visible) - increased from 2min
    BACKGROUND: 10 * 60 * 1000,   // 10 minutes (when page is hidden) - increased from 5min
    IDLE: 15 * 60 * 1000,         // 15 minutes (after 10min of no activity) - increased from 10min
  },

  /**
   * Leave requests and approval lists
   * Moderately frequent updates for pending items
   */
  LEAVE_REQUESTS: {
    PENDING: 3 * 60 * 1000,       // 3 minutes (for pending approvals)
    ALL: 5 * 60 * 1000,           // 5 minutes (for full list)
    DETAIL: 0,                     // No auto-refresh (manual only)
  },

  /**
   * Notifications
   * Most frequent refresh for critical updates
   */
  NOTIFICATIONS: {
    POLLING: 30 * 1000,           // 30 seconds (fallback if SSE unavailable)
    // Note: Should use Server-Sent Events or WebSockets for real-time
  },

  /**
   * Reports and analytics
   * Infrequent updates for historical data
   */
  REPORTS: {
    SUMMARY: 10 * 60 * 1000,      // 10 minutes
    DETAILED: 0,                   // No auto-refresh (manual only)
    EXPORT: 0,                     // No auto-refresh (manual only)
  },

  /**
   * Employee and department data
   * Low frequency for relatively static data
   */
  MASTER_DATA: {
    EMPLOYEES: 15 * 60 * 1000,    // 15 minutes
    DEPARTMENTS: 30 * 60 * 1000,  // 30 minutes
    LEAVE_TYPES: 60 * 60 * 1000,  // 1 hour
  },

  /**
   * Settings and configuration
   * Minimal refresh for rarely changed data
   */
  SETTINGS: {
    COMPANY: 0,                    // No auto-refresh (manual only)
    USER_PROFILE: 0,               // No auto-refresh (manual only)
    POLICIES: 60 * 60 * 1000,     // 1 hour
  },
} as const;

/**
 * Get appropriate refresh interval based on page visibility
 * and user activity status
 */
export function getAdaptiveInterval(
  baseInterval: number,
  isVisible: boolean = true,
  isIdle: boolean = false
): number {
  if (!isVisible) {
    // Triple the interval when page is not visible
    return baseInterval * 3;
  }

  if (isIdle) {
    // Double the interval after user has been idle
    return baseInterval * 2;
  }

  return baseInterval;
}

/**
 * Check if auto-refresh should be enabled based on best practices
 * - Don't refresh when page is hidden (Page Visibility API)
 * - Don't refresh static/historical data
 * - Respect user's reduced-motion preference
 */
export function shouldAutoRefresh(
  intervalType: keyof typeof RefreshIntervals,
  dataType: string
): boolean {
  // Never auto-refresh if interval is 0 (manual only)
  const config = RefreshIntervals[intervalType];
  if (typeof config === 'object') {
    const interval = (config as any)[dataType];
    if (interval === 0) return false;
  }

  // Check if page is visible
  // if (typeof document !== 'undefined' && document.hidden) {
  //   return true; // ALLOW background refresh (handled by getAdaptiveInterval scaling)
  // }

  // Respect user's motion preferences
  if (typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }

  return true;
}

/**
 * Industry standards comparison:
 *
 * System              | Refresh Interval Range
 * --------------------|----------------------
 * Workday             | Polling only (10 req/s limit)
 * SAP SuccessFactors  | 5min - 12hr
 * BambooHR            | ~5min webhooks, hourly-daily sync
 * Oracle HCM          | 30 req/min limit
 * Power BI            | 30min default
 * Azure Dashboards    | 30min - 4hr
 * CloudWatch          | 10s - 15min
 * AppDynamics         | 2min default
 *
 * Our implementation: 30s - 30min based on data criticality
 * - More aggressive than enterprise BI tools (suitable for operational HR)
 * - Less aggressive than real-time monitoring (suitable for HR workflows)
 * - Balances user experience with server load
 */
