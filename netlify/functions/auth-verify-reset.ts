import { Handler } from '@netlify/functions';
import { logger } from './utils/logger';
import { query } from './utils/db';
import { generateToken } from './utils/jwt';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { rateLimit, getClientIP } from './utils/rateLimiter';

/**
 * Password Reset Verification Endpoint
 * 
 * Allows users to reset their password by verifying their identity using:
 * - Employee Code
 * - National ID
 * 
 * On successful verification:
 * 1. Sets must_change_password = true
 * 2. Returns JWT token
 * 3. Frontend will show forced password change modal
 */

// Input validation
function validateInput(employee_code: string, national_id: string): { isValid: boolean; error?: string } {
    if (!employee_code || !national_id) {
        return { isValid: false, error: 'Employee code and national ID are required' };
    }

    // Employee code format validation
    if (employee_code.length > 50) {
        return { isValid: false, error: 'Employee code too long' };
    }

    if (!/^[A-Za-z0-9-]+$/.test(employee_code)) {
        return { isValid: false, error: 'Invalid employee code format' };
    }

    // National ID validation (13 digits for Thai national ID)
    const cleanNationalId = national_id.replace(/[\s-]/g, '');
    if (!/^\d{13}$/.test(cleanNationalId)) {
        return { isValid: false, error: 'National ID must be 13 digits' };
    }

    // Prevent SQL injection patterns
    if (/['";\\]/.test(employee_code) || /['";\\]/.test(national_id)) {
        return { isValid: false, error: 'Invalid characters in input' };
    }

    return { isValid: true };
}

const verifyResetHandler: Handler = async (event) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const { employee_code, national_id } = JSON.parse(event.body || '{}');

        // Get client IP for rate limiting
        const clientIP = getClientIP(event);

        // Apply rate limiting (5 attempts per 15 minutes per IP)
        const rateLimitResult = rateLimit(clientIP);

        if (!rateLimitResult.success) {
            logger.log('🚫 Rate limit exceeded for password reset:', clientIP);
            return errorResponse(
                'Too many attempts. Please try again later.',
                429
            );
        }

        logger.log('🔐 [PASSWORD RESET] Verification attempt for:', {
            employee_code,
            clientIP,
            attemptsRemaining: rateLimitResult.remaining
        });

        // Validate input
        const validation = validateInput(employee_code, national_id);
        if (!validation.isValid) {
            logger.log('❌ Invalid input:', validation.error);
            return errorResponse(validation.error || 'Invalid input', 400);
        }

        // Clean national ID (remove dashes and spaces)
        const cleanNationalId = national_id.replace(/[\s-]/g, '');

        // Find employee by employee_code or scan_code
        const employees = await query(
            `SELECT 
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
        e.department_id,
        e.position_th,
        e.position_en,
        e.role,
        e.is_active,
        e.hire_date,
        e.profile_image_url,
        e.is_department_admin,
        e.is_department_manager,
        d.department_code,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE (e.employee_code = $1 OR e.scan_code = $1) AND e.is_active = true
      LIMIT 1`,
            [employee_code]
        );

        if (employees.length === 0) {
            logger.log('❌ Employee not found by employee_code or scan_code:', employee_code);
            // Use generic error message to prevent user enumeration
            return errorResponse('Invalid employee code or national ID', 401);
        }

        const employee = employees[0];

        // Verify national ID matches
        const storedNationalId = (employee.national_id || '').replace(/[\s-]/g, '');

        if (storedNationalId !== cleanNationalId) {
            logger.log('❌ National ID mismatch for:', employee_code);
            // Use generic error message to prevent user enumeration
            return errorResponse('Invalid employee code or national ID', 401);
        }

        logger.log('✅ National ID verified for:', employee_code);

        // Set must_change_password = true and clear custom password flag
        await query(
            `UPDATE employees 
       SET must_change_password = true,
           updated_at = NOW()
       WHERE id = $1`,
            [employee.id]
        );

        logger.log('✅ Password reset flag set for:', employee_code);

        // Calculate permissions
        const role = employee.role || 'employee';
        const isDepartmentAdmin = employee.is_department_admin || role === 'admin';
        const isDepartmentManager = employee.is_department_manager || role === 'manager' || role === 'admin';
        const isHR = role === 'hr' || role === 'admin';

        // Generate JWT token
        const token = generateToken({
            userId: employee.id,
            employeeCode: employee.employee_code,
            role: role,
        });

        logger.log('✅ Token generated for password reset flow:', employee_code);

        // Return user object (same structure as login response)
        const user = {
            id: employee.id,
            employee_code: employee.employee_code,
            scan_code: employee.scan_code,
            first_name_th: employee.first_name_th,
            last_name_th: employee.last_name_th,
            first_name_en: employee.first_name_en,
            last_name_en: employee.last_name_en,
            email: employee.email,
            phone: employee.phone_number,
            birth_date: employee.birth_date,
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
            must_change_password: true, // Always true for password reset
            is_first_login: false,
            has_custom_password: false,
            auth_method: 'password_reset',
        };

        return successResponse({
            user,
            token,
            message: 'Verification successful. Please set your new password.',
            requires_password_change: true,
        });

    } catch (error: any) {
        logger.error('❌ Password reset verification error:', error.message);

        const errorMessage = process.env.NODE_ENV === 'production'
            ? 'Verification failed. Please try again.'
            : error.message || 'Verification failed';

        return errorResponse(errorMessage, 500);
    }
};

export const handler = verifyResetHandler;
