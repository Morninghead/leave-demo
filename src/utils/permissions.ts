// src/utils/permissions.ts
import { User } from '../types/auth';

/**
 * Centralized permission utilities for consistent access control
 */

export type UserRole = User['role'];
const DEV_CODE = '999999999';

/**
 * Check if user is a Developer (superuser with full access)
 * Checks both role='dev' and special employee_code='999999999'
 */
export const isDev = (user: User | null | undefined): boolean => {
  if (!user) return false;
  // Compare employee_code as string to handle both string and number types
  const userCode = String(user.employee_code || '').trim();
  return user.role === 'dev' || userCode === DEV_CODE;
};

/**
 * Check if user has specific role
 */
export const hasRole = (user: User | null | undefined, role: UserRole): boolean => {
  if (!user) return false;
  return user.role === role;
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (user: User | null | undefined, roles: UserRole[]): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};

/**
 * Check if user can access routes requiring manager-level permissions
 * This includes Department Admin, Department Manager, and Manager roles
 */
export const isManagerLevel = (user: User | null | undefined): boolean => {
  if (!user) return false;
  if (isDev(user)) return true; // Dev has all permissions
  return (
    user.is_department_admin ||
    user.is_department_manager ||
    user.role === 'manager'
  );
};

/**
 * Check if user can access HR-level features
 */
export const isHRLevel = (user: User | null | undefined): boolean => {
  if (!user) return false;
  if (isDev(user)) return true; // Dev has all permissions
  return user.role === 'hr';
};

/**
 * Check if user is admin
 */
export const isAdmin = (user: User | null | undefined): boolean => {
  if (!user) return false;
  if (isDev(user)) return true; // Dev has all permissions
  return user.role === 'admin';
};

/**
 * Check if user can access employees management
 * Note: Admin role is NOT included - only HR can manage employees
 */
export const canManageEmployees = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return isHRLevel(user); // Admin removed - only HR can manage employees
};

/**
 * Check if user can access approval features
 * Note: Admin role is NOT included - only Managers and HR can approve
 */
export const canApprove = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return isManagerLevel(user) || isHRLevel(user); // Admin removed - cannot approve
};

/**
 * Check if user can access reports
 * Note: Admin can access reports but only limited ones (handled by specific report components)
 */
export const canAccessReports = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return isManagerLevel(user) || isHRLevel(user) || isAdmin(user);
};

/**
 * Check if user can access settings
 * Note: Admin role is NOT included - only HR can access settings
 */
export const canAccessSettings = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return isHRLevel(user); // Admin removed - cannot access settings
};

/**
 * Check if user can access a specific route based on required roles
 */
export const canAccessRoute = (
  user: User | null | undefined,
  requiredRoles?: UserRole[]
): boolean => {
  if (!user) return false;

  // If no roles required, any authenticated user can access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Dev has access to everything
  if (isDev(user)) return true;

  // Check each required role
  return requiredRoles.some((role) => {
    switch (role) {
      case 'employee':
        return true; // All authenticated users are employees by default
      case 'manager':
        return isManagerLevel(user);
      case 'leader':
        return hasRole(user, role);
      case 'hr':
        return isHRLevel(user);
      case 'admin':
        return isAdmin(user);
      default:
        return hasRole(user, role);
    }
  });
};

/**
 * Get user's display role name (including department permissions)
 */
export const getUserDisplayRole = (user: User | null | undefined): string => {
  if (!user) return 'Unknown';

  if (isDev(user)) return 'Developer';
  if (isAdmin(user)) return 'Administrator';
  if (isHRLevel(user)) return 'HR';
  if (hasRole(user, 'leader')) return 'Leader';
  if (user.is_department_admin) return 'Department Admin';
  if (user.is_department_manager) return 'Department Manager';
  if (hasRole(user, 'manager')) return 'Manager';

  return 'Employee';
};

/**
 * Check if user has development bypass (for testing)
 */
export const hasDevelopmentBypass = (user: User | null | undefined): boolean => {
  if (!user) return false;
  // Add any development bypass logic here
  // For example: return user.email?.includes('@dev.test') || false;
  return false;
};

/**
 * Permission check result type
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  userRole?: string;
  requiredRoles?: string[];
}

/**
 * Comprehensive permission check with detailed result
 */
export const checkPermission = (
  user: User | null | undefined,
  requiredRoles?: UserRole[]
): PermissionCheck => {
  if (!user) {
    return {
      allowed: false,
      reason: 'User not authenticated',
      requiredRoles
    };
  }

  const hasAccess = canAccessRoute(user, requiredRoles);

  return {
    allowed: hasAccess,
    reason: hasAccess ? undefined : `Insufficient permissions. Required: ${requiredRoles?.join(', ') || 'authenticated'}`,
    userRole: getUserDisplayRole(user),
    requiredRoles
  };
};
