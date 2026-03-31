import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

interface Employee {
  id: string;
  employee_code: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  email: string;
  department_id: string;
  role: string;
  status: string;
}

interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

const getMe = async (event: AuthenticatedEvent) => {
  // Handle CORS
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;

    if (!userId) {
      return errorResponse('User ID not found', 400);
    }

    // Query employee with department info
    const employees = await query<any>(
      `
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
        e.is_department_admin,
        e.is_department_manager,
        d.department_code,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = $1 AND e.is_active = true
      LIMIT 1
      `,
      [userId]
    );

    if (employees.length === 0) {
      return errorResponse('User not found', 404);
    }

    const employee = employees[0];

    // ✅ Read permissions from database AND calculate from role (same logic as auth-login.ts)
    const role = employee.role || 'employee';

    // Use database fields if set, otherwise calculate from role
    // Database fields take precedence for granular permission control
    const isDepartmentAdmin = employee.is_department_admin || role === 'admin';
    const isDepartmentManager = employee.is_department_manager || role === 'manager' || role === 'admin';
    const isHR = role === 'hr' || role === 'admin';

    // Prepare user object with permission flags (handle null values safely)
    const user = {
      id: employee.id || '',
      employee_code: employee.employee_code || '',
      scan_code: employee.scan_code || '',
      national_id: employee.national_id || '',
      first_name_th: employee.first_name_th || '',
      last_name_th: employee.last_name_th || '',
      first_name_en: employee.first_name_en || '',
      last_name_en: employee.last_name_en || '',
      email: employee.email || '',
      phone: employee.phone_number || '', // Database column is phone_number
      birth_date: employee.birth_date || null,
      address_th: employee.address_th || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_phone: employee.emergency_contact_phone || '',
      department_id: employee.department_id || '',
      department_code: employee.department_code || '',
      department_name_th: employee.department_name_th || '',
      department_name_en: employee.department_name_en || '',
      position_th: employee.position_th || '',
      position_en: employee.position_en || '',
      role: role,
      status: employee.is_active ? 'active' : 'inactive',
      hire_date: employee.hire_date || null,
      profile_image_url: employee.profile_image_url || '',
      is_hr: isHR,
      is_department_admin: isDepartmentAdmin,
      is_department_manager: isDepartmentManager,
    };

    return successResponse({ user });
  } catch (error: any) {
    logger.error('Get user error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      userId: event.user?.userId,
      query: 'employees with department join'
    });
    return errorResponse(error.message || 'Failed to get user', 500);
  }
};

export const handler: Handler = requireAuth(getMe);
