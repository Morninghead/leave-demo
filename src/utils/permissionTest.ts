// src/utils/permissionTest.ts
/**
 * Permission Testing Utility
 * Used to test and verify that users only see menus they have access to
 */

import { User } from '../types/auth';
import {
  canAccessRoute,
  canAccessSettings,
  canManageEmployees,
  canApprove,
  canAccessReports,
  getUserDisplayRole
} from './permissions';

export interface MenuAccessTest {
  path: string;
  label: string;
  requiredRoles: string[];
  accessible: boolean;
  userRole: string;
  reason?: string;
}

export interface UserPermissionTest {
  user: User;
  userDisplayRole: string;
  menuAccess: MenuAccessTest[];
  summary: {
    totalMenus: number;
    accessibleMenus: number;
    inaccessibleMenus: number;
  };
}

/**
 * Test menu access for a specific user
 */
export function testUserMenuAccess(user: User): UserPermissionTest {
  const allMenus = [
    { path: '/dashboard', label: 'Dashboard', requiredRoles: [] },
    { path: '/leave', label: 'Leave', requiredRoles: [] },
    { path: '/shift', label: 'Shift Swap', requiredRoles: [] },
    { path: '/leave', label: 'Leave/Shift', requiredRoles: [] },
    { path: '/holidays', label: 'Holidays', requiredRoles: [] },
    { path: '/approval', label: 'Approvals', requiredRoles: ['manager', 'hr', 'admin'] },
    { path: '/employees', label: 'Employees', requiredRoles: ['hr', 'admin'] },
    { path: '/reports', label: 'Reports', requiredRoles: ['manager', 'hr', 'admin'] },
    { path: '/settings', label: 'Settings', requiredRoles: ['hr', 'admin'] },
  ];

  const menuAccess: MenuAccessTest[] = allMenus.map(menu => {
    const accessible = canAccessRoute(user, menu.requiredRoles as any[]);

    return {
      ...menu,
      accessible,
      userRole: user.role,
      reason: !accessible ? `Requires: ${menu.requiredRoles.join(', ') || 'Any authenticated user'}` : undefined
    };
  });

  const summary = {
    totalMenus: allMenus.length,
    accessibleMenus: menuAccess.filter(m => m.accessible).length,
    inaccessibleMenus: menuAccess.filter(m => !m.accessible).length,
  };

  return {
    user,
    userDisplayRole: getUserDisplayRole(user),
    menuAccess,
    summary
  };
}

/**
 * Test all user types
 */
export function testAllUserTypes(): UserPermissionTest[] {
  const testUsers: User[] = [
    // Basic Employee
    {
      id: '1',
      employee_code: 'EMP001',
      first_name_th: 'สมชาย',
      last_name_th: 'ใจดี',
      first_name_en: 'Somchai',
      last_name_en: 'Jaidee',
      email: 'somchai@company.com',
      role: 'employee',
      status: 'active',
      is_department_admin: false,
      is_department_manager: false,
      is_hr: false,
      scan_code: '',
      department_id: ''
    },
    // Department Admin
    {
      id: '2',
      employee_code: 'DEPT001',
      first_name_th: 'มนูษ',
      last_name_th: 'เจริญ',
      first_name_en: 'Manoon',
      last_name_en: 'Charoen',
      email: 'manoon@company.com',
      role: 'employee',
      status: 'active',
      is_department_admin: true,
      is_department_manager: false,
      is_hr: false,
      scan_code: '',
      department_id: ''
    },
    // Department Manager
    {
      id: '3',
      employee_code: 'MGR001',
      first_name_th: 'วีระ',
      last_name_th: 'มานะ',
      first_name_en: 'Wira',
      last_name_en: 'Mana',
      email: 'wira@company.com',
      role: 'manager',
      status: 'active',
      is_department_admin: false,
      is_department_manager: true,
      is_hr: false,
      scan_code: '',
      department_id: ''
    },
    // HR User
    {
      id: '4',
      employee_code: 'HR001',
      first_name_th: 'ศิริ',
      last_name_th: 'รักษ์',
      first_name_en: 'Siri',
      last_name_en: 'Rak',
      email: 'siri@company.com',
      role: 'hr',
      status: 'active',
      is_department_admin: false,
      is_department_manager: false,
      is_hr: true,
      scan_code: '',
      department_id: ''
    },
    // Admin User
    {
      id: '5',
      employee_code: 'ADM001',
      first_name_th: 'ผู้ดูแล',
      last_name_th: 'ระบบ',
      first_name_en: 'System',
      last_name_en: 'Admin',
      email: 'admin@company.com',
      role: 'admin',
      status: 'active',
      is_department_admin: false,
      is_department_manager: false,
      is_hr: false,
      scan_code: '',
      department_id: ''
    },
  ];

  return testUsers.map(testUserMenuAccess);
}

/**
 * Generate a comprehensive permission test report
 */
export function generatePermissionReport(): string {
  const userTests = testAllUserTypes();

  let report = '# Permission Access Test Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  userTests.forEach(test => {
    report += `## ${test.userDisplayRole} (${test.user.employee_code})\n\n`;
    report += `**Role:** ${test.user.role}\n`;
    report += `**Permissions:** Dept Admin: ${test.user.is_department_admin}, Dept Manager: ${test.user.is_department_manager}, HR: ${test.user.is_hr}\n\n`;

    report += `**Summary:** ${test.summary.accessibleMenus}/${test.summary.totalMenus} menus accessible\n\n`;

    report += '| Menu | Path | Required Roles | Accessible |\n';
    report += '|------|-----|---------------|------------|\n';

    test.menuAccess.forEach(menu => {
      const requiredRoles = menu.requiredRoles.length > 0 ? menu.requiredRoles.join(', ') : 'Any';
      const accessible = menu.accessible ? '✅ Yes' : '❌ No';
      report += `| ${menu.label} | ${menu.path} | ${requiredRoles} | ${accessible} |\n`;
    });

    report += '\n';
  });

  return report;
}

/**
 * Log current user's menu access to console (for debugging)
 */
export function logCurrentUserMenuAccess(user: User | null | undefined): void {
  if (!user) {
    console.log('❌ No user logged in');
    return;
  }

  const test = testUserMenuAccess(user);

  console.group(`🔍 Menu Access Test for ${test.userDisplayRole} (${user.employee_code})`);
  console.log('📊 Summary:', test.summary);
  console.log('👤 User Info:', {
    role: user.role,
    is_department_admin: user.is_department_admin,
    is_department_manager: user.is_department_manager,
    is_hr: user.is_hr,
  });

  console.table(test.menuAccess.map(menu => ({
    Menu: menu.label,
    Path: menu.path,
    Required: menu.requiredRoles.join(', ') || 'Any',
    Accessible: menu.accessible ? '✅' : '❌',
    Reason: menu.reason || '-'
  })));

  console.groupEnd();
}

/**
 * Check if any navigation inconsistencies exist
 */
export function validateNavigationConsistency(): boolean {
  const tests = testAllUserTypes();
  const issues: string[] = [];

  tests.forEach(test => {
    test.menuAccess.forEach(menu => {
      // Check if user can access settings through dropdown but not through main menu
      if (menu.path === '/settings') {
        const canAccessDropdown = canAccessSettings(test.user);
        const canAccessMainMenu = menu.accessible;

        if (canAccessDropdown !== canAccessMainMenu) {
          issues.push(`Inconsistent settings access for ${test.userDisplayRole}: dropdown=${canAccessDropdown}, mainMenu=${canAccessMainMenu}`);
        }
      }
    });
  });

  if (issues.length > 0) {
    console.error('❌ Navigation consistency issues found:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    return false;
  }

  console.log('✅ Navigation consistency check passed');
  return true;
}
