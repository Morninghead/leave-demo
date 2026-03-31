import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import bcrypt from 'bcryptjs';

interface ChangePasswordRequest {
  current_password?: string; // For regular password changes
  new_password: string;
  confirm_password: string;
  change_reason?: string; // For admin-forced changes
  employee_id?: string; // For admin changes to other employees
}

// Password validation utilities
const getPasswordSettings = async (): Promise<{
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}> => {
  try {
    const settings = await query(
      'SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN ($1, $2, $3, $4, $5)',
      [
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_numbers',
        'password_require_special_chars'
      ]
    );

    const settingsObj = settings.reduce((acc: any, row: any) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    return {
      minLength: parseInt(settingsObj.password_min_length) || 8,
      requireUppercase: settingsObj.password_require_uppercase === 'true',
      requireLowercase: settingsObj.password_require_lowercase === 'true',
      requireNumbers: settingsObj.password_require_numbers === 'true',
      requireSpecialChars: settingsObj.password_require_special_chars === 'true',
    };
  } catch (error) {
    console.error('Error getting password settings:', error);
    // Return defaults
    return {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    };
  }
};

const validatePassword = async (
  password: string,
  currentEmployeeId?: string
): Promise<{ isValid: boolean; errors: string[] }> => {
  const errors: string[] = [];
  const settings = await getPasswordSettings();

  // Length validation
  if (password.length < settings.minLength) {
    errors.push(`Password must be at least ${settings.minLength} characters long`);
  }

  // Uppercase validation
  if (settings.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase validation
  if (settings.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Numbers validation
  if (settings.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special characters validation
  if (settings.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common patterns - only if strict requirements are enabled
  const hasStrictRequirements = settings.requireUppercase || settings.requireLowercase || settings.requireNumbers || settings.requireSpecialChars;

  if (hasStrictRequirements) {
    const commonPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /letmein/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password cannot contain common patterns');
        break;
      }
    }
  }

  // Check if password contains employee info - only if strict requirements are enabled
  if (currentEmployeeId && hasStrictRequirements) {
    try {
      const employee = await query(
        'SELECT employee_code, first_name_th, last_name_th, first_name_en, last_name_en, email FROM employees WHERE id = $1',
        [currentEmployeeId]
      );

      if (employee.length > 0) {
        const emp = employee[0];
        const checkStrings = [
          emp.employee_code,
          emp.first_name_th,
          emp.last_name_th,
          emp.first_name_en,
          emp.last_name_en,
          emp.email,
        ].filter(Boolean);

        for (const str of checkStrings) {
          if (str && password.toLowerCase().includes(str.toLowerCase())) {
            errors.push('Password cannot contain your personal information');
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking employee info in password:', error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const generateSalt = (): string => {
  return bcrypt.genSaltSync(12);
};

const hashPassword = (password: string, salt: string): string => {
  return bcrypt.hashSync(password, 12); // 12 rounds of salt generation
};

const verifyPassword = (password: string, hashedPassword: string): boolean => {
  return bcrypt.compareSync(password, hashedPassword);
};

const changePassword = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    const userRole = event.user?.role;

    if (!userId) {
      return errorResponse('Authentication required', 401);
    }

    const body: ChangePasswordRequest = JSON.parse(event.body || '{}');
    const { current_password, new_password, confirm_password, change_reason, employee_id } = body;

    if (!new_password || !confirm_password) {
      return errorResponse('New password and confirmation are required', 400);
    }

    if (new_password !== confirm_password) {
      return errorResponse('Passwords do not match', 400);
    }

    // Determine if this is admin-forced change or self-change
    const isAdminChange = userRole === 'admin' || userRole === 'hr';
    const targetEmployeeId = employee_id || userId;
    const isChangingOwnPassword = targetEmployeeId === userId;

    console.log('🔐 [PASSWORD] Password change attempt:', {
      userId,
      targetEmployeeId,
      isChangingOwnPassword,
      isAdminChange,
      hasCurrentPassword: !!current_password,
    });

    // Get target employee info (include national_id for authentication fallback)
    const targetEmployees = await query(
      'SELECT id, employee_code, first_name_th, last_name_th, password_hash, national_id, has_custom_password FROM employees WHERE id = $1 AND is_active = true',
      [targetEmployeeId]
    );

    if (targetEmployees.length === 0) {
      return errorResponse('Employee not found', 404);
    }

    const targetEmployee = targetEmployees[0];

    // Validate current password for self-changes
    if (isChangingOwnPassword) {
      // Require current password if user is changing their own password
      if (!current_password) {
        return errorResponse('Current password is required', 400);
      }

      // Verify current password (support both hashed password and National ID)
      let isValidCurrentPassword = false;

      // Method 1: Try bcrypt verification (for users with custom passwords)
      if (targetEmployee.password_hash) {
        console.log('🔐 [PASSWORD] Attempting bcrypt verification for employee:', targetEmployeeId);
        try {
          isValidCurrentPassword = verifyPassword(current_password, targetEmployee.password_hash);
          if (isValidCurrentPassword) {
            console.log('✅ [PASSWORD] Bcrypt verification successful');
          }
        } catch (error) {
          console.error('⚠️ [PASSWORD] Bcrypt verification error:', error);
        }
      }

      // Method 2: Try National ID verification (fallback for first-time password setup)
      if (!isValidCurrentPassword && targetEmployee.national_id) {
        console.log('🆔 [PASSWORD] Attempting National ID verification for employee:', targetEmployeeId);
        // Clean the national ID (remove dashes, spaces) - same logic as login
        const cleanNationalId = targetEmployee.national_id.replace(/[\s-]/g, '');
        const cleanPassword = current_password.replace(/[\s-]/g, '');

        if (cleanNationalId === cleanPassword) {
          isValidCurrentPassword = true;
          console.log('✅ [PASSWORD] National ID verification successful');
        }
      }

      // If neither method succeeded, reject the password change
      if (!isValidCurrentPassword) {
        console.log('❌ [PASSWORD] Current password verification failed for employee:', targetEmployeeId);
        return errorResponse('Current password is incorrect', 400);
      }

      console.log('✅ [PASSWORD] Current password verified successfully');
    } else {
      // Admin changes - check permissions
      if (!isAdminChange) {
        return errorResponse('You do not have permission to change other users\' passwords', 403);
      }
    }

    // Validate new password
    const passwordValidation = await validatePassword(new_password, targetEmployeeId);
    if (!passwordValidation.isValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        }),
      };
    }

    // Generate new hash
    const newHashedPassword = hashPassword(new_password, '');

    console.log('🔐 [PASSWORD] Updating password for employee:', targetEmployeeId);

    // Update password in database and set custom password flag, also clear must_change_password flag
    await query(
      `UPDATE employees
       SET password_hash = $1, has_custom_password = true, must_change_password = false
       WHERE id = $2`,
      [newHashedPassword, targetEmployeeId]
    );

    console.log('🔐 [PASSWORD] Password, custom password flag, and must_change_password flag updated for employee:', targetEmployeeId);

    // Log password change to audit table
    try {
      const logReason = change_reason || (isChangingOwnPassword ? 'Self-initiated password change' : 'Admin-forced password change');
      const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || null;
      const userAgent = event.headers['user-agent'] || null;

      await query(
        `INSERT INTO password_change_logs (
          employee_id, changed_by, change_reason, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          targetEmployeeId,
          isChangingOwnPassword ? null : userId,
          logReason,
          ipAddress,
          userAgent
        ]
      );

      console.log('🔐 [PASSWORD] Password change logged for employee:', targetEmployeeId, {
        changed_by: isChangingOwnPassword ? null : userId,
        change_reason: logReason,
        ip_address: ipAddress,
        user_agent: userAgent
      });
    } catch (logError: any) {
      // Don't fail the password change if logging fails
      console.error('⚠️ [PASSWORD] Failed to log password change:', logError);
    }

    console.log('✅ [PASSWORD] Password updated successfully for employee:', targetEmployeeId);

    return successResponse({
      message: isChangingOwnPassword
        ? 'Password changed successfully'
        : 'Password updated for employee',
      employee: {
        id: targetEmployee.id,
        employee_code: targetEmployee.employee_code,
        name: `${targetEmployee.first_name_th} ${targetEmployee.last_name_th}`,
      }
    });

  } catch (error: any) {
    console.error('❌ [PASSWORD] Error changing password:', error);
    return errorResponse(error.message || 'Failed to change password', 500);
  }
};

export const handler: Handler = requireAuth(changePassword);