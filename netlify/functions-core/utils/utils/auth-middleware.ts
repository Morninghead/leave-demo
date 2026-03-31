// netlify/functions/utils/auth-middleware.ts
import { HandlerEvent } from '@netlify/functions';
import { verifyToken, getTokenFromHeader, JWTPayload } from './jwt';
import { errorResponse, handleCORS } from './response';

/**
 * Extended HandlerEvent with authenticated user
 */
export interface AuthenticatedEvent extends HandlerEvent {
  user?: JWTPayload;
}

/**
 * Require authentication middleware
 * Extracts and verifies JWT token from Authorization header
 * 
 * Usage:
 * export const handler = requireAuth(myHandler);
 */
export function requireAuth(handler: (event: AuthenticatedEvent) => Promise<any>) {
  return async (event: HandlerEvent) => {
    // Handle CORS preflight
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    try {
      // Minimal logging for security
      // Get token from Authorization header
      const token = getTokenFromHeader(event.headers.authorization || event.headers.Authorization);

      if (!token) {
        return errorResponse('No token provided', 401);
      }

      // Verify token
      const user = verifyToken(token);

      if (!user) {
        return errorResponse('Invalid or expired token', 401);
      }

      // Attach user to event
      const authenticatedEvent: AuthenticatedEvent = {
        ...event,
        user,
      };

      // Call the actual handler
      return await handler(authenticatedEvent);
      
    } catch (error: any) {
      console.error('❌ Auth middleware error:', error);
      return errorResponse(error.message || 'Authentication failed', 401);
    }
  };
}

/**
 * Require specific role(s) middleware
 * Checks if user has one of the allowed roles
 *
 * Usage:
 * export const handler = requireRole(['hr', 'admin'])(myHandler);
 */
export function requireRole(roles: string[]) {
  return (handler: (event: AuthenticatedEvent) => Promise<any>) => {
    return requireAuth(async (event: AuthenticatedEvent) => {
      const userRole = event.user?.role;

      console.log('🔑 Role check:', {
        required: roles,
        userRole
      });

      // Check if user has required role
      if (!userRole || !roles.includes(userRole)) {
        console.log('❌ Insufficient permissions:', {
          required: roles,
          actual: userRole
        });
        return errorResponse('Insufficient permissions', 403);
      }

      console.log('✅ Role check passed');
      return await handler(event);
    });
  };
}

/**
 * Require admin role
 *
 * Usage:
 * export const handler = requireAdmin(myHandler);
 */
export function requireAdmin(handler: (event: AuthenticatedEvent) => Promise<any>) {
  return requireRole(['admin'])(handler);
}

/**
 * Require HR or admin role
 *
 * Usage:
 * export const handler = requireHR(myHandler);
 */
export function requireHR(handler: (event: AuthenticatedEvent) => Promise<any>) {
  return requireRole(['hr', 'admin'])(handler);
}

/**
 * Require manager, HR, or admin role
 *
 * Usage:
 * export const handler = requireManager(myHandler);
 */
export function requireManager(handler: (event: AuthenticatedEvent) => Promise<any>) {
  return requireRole(['manager', 'hr', 'admin'])(handler);
}

// =============================================
// HELPER FUNCTIONS (for use inside handlers)
// =============================================

/**
 * Check if user has permission
 *
 * Usage:
 * if (!hasPermission(event, ['hr', 'admin'])) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function hasPermission(event: AuthenticatedEvent, allowedRoles: string[]): boolean {
  const userRole = event.user?.role;

  if (!userRole) return false;

  return allowedRoles.includes(userRole);
}

/**
 * Check if user is admin
 *
 * Usage:
 * if (isAdmin(event)) {
 *   // Allow admin-only actions
 * }
 */
export function isAdmin(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['admin']);
}

/**
 * Check if user is HR or admin
 *
 * Usage:
 * if (isHROrAdmin(event)) {
 *   // Allow HR/Admin actions
 * }
 */
export function isHROrAdmin(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['hr', 'admin']);
}

/**
 * Check if user can manage employees
 * Requires HR or Admin role
 *
 * Usage:
 * if (!canManageEmployees(event)) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function canManageEmployees(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['hr', 'admin']);
}

/**
 * Check if user can approve leave requests
 * Requires Manager, HR, or Admin role
 *
 * Usage:
 * if (!canApproveLeave(event)) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function canApproveLeave(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['manager', 'hr', 'admin']);
}

/**
 * Check if user can approve shift swaps
 * Requires Manager, HR, or Admin role
 *
 * Usage:
 * if (!canApproveShiftSwap(event)) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function canApproveShiftSwap(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['manager', 'hr', 'admin']);
}

/**
 * Check if user can manage settings
 * Requires HR or Admin role
 *
 * Usage:
 * if (!canManageSettings(event)) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function canManageSettings(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['hr', 'admin']);
}

/**
 * Check if user can view reports
 * Requires Manager, HR, or Admin role
 *
 * Usage:
 * if (!canViewReports(event)) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function canViewReports(event: AuthenticatedEvent): boolean {
  return hasPermission(event, ['manager', 'hr', 'admin']);
}

/**
 * Check if user owns the resource or has permission
 * 
 * Usage:
 * if (!isOwnerOrHasPermission(event, resourceOwnerId, ['hr', 'admin'])) {
 *   return errorResponse('Forbidden', 403);
 * }
 */
export function isOwnerOrHasPermission(
  event: AuthenticatedEvent, 
  resourceOwnerId: string, 
  allowedRoles: string[]
): boolean {
  const userId = event.user?.userId;
  
  // Check if user is the owner
  if (userId === resourceOwnerId) return true;
  
  // Check if user has required role
  return hasPermission(event, allowedRoles);
}

/**
 * Get current user ID
 * 
 * Usage:
 * const userId = getCurrentUserId(event);
 */
export function getCurrentUserId(event: AuthenticatedEvent): string | undefined {
  return event.user?.userId;
}

/**
 * Get current employee code
 *
 * Usage:
 * const employeeCode = getCurrentEmployeeCode(event);
 */
export function getCurrentEmployeeCode(event: AuthenticatedEvent): string | undefined {
  return event.user?.employeeCode;
}
