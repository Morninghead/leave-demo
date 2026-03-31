import { Handler } from '@netlify/functions';
import { logger } from './utils/logger';
import { query } from './utils/db';
import { generateToken } from './utils/jwt';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getPasswordSettings } from './auth-password-settings';
import { rateLimit, getClientIP } from './utils/rateLimiter';
import * as bcrypt from 'bcryptjs';

// Input validation functions
function validateLoginInput(loginIdentifier: string, password: string): void {
  if (!loginIdentifier || !password) {
    throw new Error('Employee code, scan code, and password are required');
  }

  // Length validation
  if (loginIdentifier.length > 50) {
    throw new Error('Login identifier too long');
  }
  if (password.length > 255) {
    throw new Error('Password too long');
  }

  // Format validation
  if (!/^[A-Za-z0-9\-]+$/.test(loginIdentifier)) {
    throw new Error('Invalid employee code or scan code format');
  }

  // Prevent SQL injection patterns
  if (/['";\\]/.test(loginIdentifier) || /['";\\]/.test(password)) {
    throw new Error('Invalid characters in input');
  }
}

function validateLoginInputWithScanCode(employee_code: string, password: string, scan_code?: string): void {
  const normalizedEmployeeCode = employee_code?.trim();
  const normalizedScanCode = scan_code?.trim();

  if (!normalizedEmployeeCode && !normalizedScanCode) {
    throw new Error('Employee code or scan code is required');
  }

  if (normalizedEmployeeCode && normalizedScanCode && normalizedEmployeeCode !== normalizedScanCode) {
    throw new Error('Employee code and scan code must match when both are provided');
  }

  validateLoginInput(normalizedEmployeeCode || normalizedScanCode || '', password);
}

const loginHandler: Handler = async (event) => {
  // Debug: Log environment variables (without secrets)
  console.log('🔍 [DEBUG] Environment check:', {
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasDbUrl: !!process.env.NEON_DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    functionPath: event.path
  });

  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const { employee_code, password, scan_code } = JSON.parse(event.body || '{}');
    const normalizedEmployeeCode = employee_code?.trim() || '';
    const normalizedScanCode = scan_code?.trim() || '';
    const loginIdentifier = normalizedEmployeeCode || normalizedScanCode;

    // Get client IP for rate limiting
    const clientIP = getClientIP(event);

    // Apply rate limiting (5 attempts per 15 minutes per IP)
    const rateLimitResult = rateLimit(clientIP);

    if (!rateLimitResult.success) {
            return errorResponse(
        'Too many login attempts. Please try again later.',
        429
      );
    }

    logger.log('📤 [API REQUEST]: Login attempt for:', {
      employee_code,
      scan_code,
      loginIdentifier,
      clientIP,
      attemptsRemaining: rateLimitResult.remaining
    });

    // Validate input
    validateLoginInputWithScanCode(employee_code, password, scan_code);

    logger.log('🔍 Executing database query for authentication...');

    logger.log('🔍 Trying unified employee_code/scan_code lookup for:', loginIdentifier);
    const querySQL = `
      SELECT
        e.id,
        e.employee_code,
        e.scan_code,
        e.national_id,
        e.first_name_th,
        e.last_name_th,
        e.first_name_en,
        e.last_name_en,
        e.email,
        e.phone_number,
        e.birth_date,
        e.address_th,
        e.emergency_contact_name,
        e.emergency_contact_phone,
        e.department_id,
        e.position_th,
        e.position_en,
        e.role,
        e.is_active,
        e.hire_date,
        e.profile_image_url,
        e.password_hash,
        e.has_custom_password,
        e.must_change_password,
        e.is_department_admin,
        e.is_department_manager,
        d.department_code,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE (e.employee_code = $1 OR e.scan_code = $1) AND e.is_active = true
      LIMIT 1
    `;
    const employees = await query(querySQL, [loginIdentifier]);

    // If both lookups failed
    if (employees.length === 0) {
      logger.log('❌ Employee not found for:', employee_code || scan_code);
      return errorResponse('Invalid employee code, scan code, or credentials', 401);
    }

    logger.log('✅ Database query returned:', employees.length, 'employees');

    const employee = employees[0];
    const authMethod = employee.employee_code === loginIdentifier ? 'employee_code' : 'scan_code';
    logger.log('🔐 Lookup method determined:', authMethod);

    // Try password authentication
    let isAuthenticated = false;
    let finalAuthMethod = '';

    // Method 1: Password authentication
    if (employee.password_hash) {
      logger.log('🔐 Attempting password authentication for:', employee.employee_code);
      try {
        isAuthenticated = bcrypt.compareSync(password, employee.password_hash);
        finalAuthMethod = 'password';
      } catch (error) {
        logger.error('Error during password authentication:', error);
      }
    }

    // Method 2: National ID authentication (fallback)
    if (!isAuthenticated && employee.national_id) {
      logger.log('🆔 Attempting national ID authentication for:', employee.employee_code);
      // Clean the national ID (remove dashes, spaces)
      const cleanNationalId = employee.national_id.replace(/[\s-]/g, '');
      const cleanPassword = password.replace(/[\s-]/g, '');

      if (cleanNationalId === cleanPassword) {
        isAuthenticated = true;
        finalAuthMethod = 'national_id';
        logger.log('✅ National ID authentication successful');
      }
    }

    if (!isAuthenticated) {
      logger.log('❌ Authentication failed for:', loginIdentifier);
      return errorResponse('Invalid employee code, scan code, or credentials', 401);
    }

    // Authentication successful

    logger.log('✅ Authentication successful for:', employee.employee_code, 'Lookup method:', authMethod, 'Auth method:', finalAuthMethod);

    // ✅ Read permissions from database AND calculate from role
    const role = employee.role || 'employee';

    // Use database fields if set, otherwise calculate from role
    // Database fields take precedence for granular permission control
    const isDepartmentAdmin = employee.is_department_admin || role === 'admin';
    const isDepartmentManager = employee.is_department_manager || role === 'manager' || role === 'admin';
    const isHR = role === 'hr' || role === 'admin';

    logger.log('✅ Login successful:', {
      employee_code: employee.employee_code,
      role: role,
      isHR: isHR,
      isDepartmentAdmin: isDepartmentAdmin,
      isDepartmentManager: isDepartmentManager,
      db_is_dept_admin: employee.is_department_admin,
      db_is_dept_manager: employee.is_department_manager
    });

    // Generate JWT token with all permissions
    logger.log('🔑 Generating token for user:', {
      userId: employee.id,
      employeeCode: employee.employee_code,
      role: role,
      isHR: isHR,
      isDepartmentAdmin: isDepartmentAdmin,
      isDepartmentManager: isDepartmentManager,
    });
    const token = generateToken({
      userId: employee.id,
      employeeCode: employee.employee_code,
      role: role,
    });

    logger.log('✅ Token generated successfully.');

    // Check password requirements and database must_change_password flag
    const passwordSettings = await getPasswordSettings();

    // Use database field primarily, but also check if force password change on first login is enabled
    // Force password change if:
    // 1. Database flag is set to true (admin forced)
    // 2. Force first login is enabled AND user is using national ID authentication (first time setup)
    // 3. Force first login is enabled AND user is using scan_code authentication (first time setup)
    const mustChangePassword = employee.must_change_password ||
      (passwordSettings.forcePasswordChangeOnFirstLogin && finalAuthMethod === 'national_id') ||
      (passwordSettings.forcePasswordChangeOnFirstLogin && authMethod === 'scan_code' && finalAuthMethod === 'national_id');

    logger.log('🔐 [PASSWORD] Password requirement check:', {
      dbFlag: employee.must_change_password,
      mustChangePassword,
      forcePasswordChange: passwordSettings.forcePasswordChangeOnFirstLogin,
      hasPassword: !!employee.password_hash,
      finalAuthMethod
    });

    // Return user object with all fields
    const user = {
      id: employee.id,
      employee_code: employee.employee_code,
      scan_code: employee.scan_code,
      national_id: employee.national_id,
      first_name_th: employee.first_name_th,
      last_name_th: employee.last_name_th,
      first_name_en: employee.first_name_en,
      last_name_en: employee.last_name_en,
      email: employee.email,
      phone: employee.phone_number, // Database column is phone_number
      birth_date: employee.birth_date,
      address_th: employee.address_th,
      emergency_contact_name: employee.emergency_contact_name,
      emergency_contact_phone: employee.emergency_contact_phone,
      department_id: employee.department_id,
      department_code: employee.department_code,
      department_name_th: employee.department_name_th,
      department_name_en: employee.department_name_en,
      position_th: employee.position_th,
      position_en: employee.position_en,
      role: role,
      hire_date: employee.hire_date,
      profile_image_url: employee.profile_image_url,
      is_hr: isHR,
      is_department_admin: isDepartmentAdmin,
      is_department_manager: isDepartmentManager,
      status: employee.is_active ? 'active' : 'inactive',
      must_change_password: mustChangePassword,
      is_first_login: false, // Always false after proper password management
      has_custom_password: finalAuthMethod === 'password',
      auth_method: finalAuthMethod,
    };

    logger.log('✅ [API RESPONSE]: Login successful');

    return successResponse({
      user,
      token,
      message: mustChangePassword
        ? 'Login successful. You must change your password to continue.'
        : 'Login successful',
      requires_password_change: mustChangePassword,
    });
  } catch (error: any) {
    logger.error('❌ Login error:', error.message);

    // Don't leak detailed error information to client
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Login failed. Please try again.'
      : error.message || 'Login failed';

    return errorResponse(errorMessage, 500);
  }
};

export const handler = loginHandler;
