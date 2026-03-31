import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { generateToken } from './utils/jwt';
import { errorResponse, handleCORS, successResponse } from './utils/response';
import { getClientIP, rateLimit } from './utils/rateLimiter';
import { verifyLineIdToken } from './utils/line-auth';

type EmployeeRow = {
  id: string;
  employee_code: string;
  scan_code: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  email: string;
  phone_number: string | null;
  birth_date: string | null;
  department_id: string;
  position_th: string | null;
  position_en: string | null;
  role: string | null;
  is_active: boolean;
  hire_date: string | null;
  profile_image_url: string | null;
  is_department_admin: boolean | null;
  is_department_manager: boolean | null;
  department_code: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
};

function validateLineLoginInput(lineIdToken: string): void {
  if (!lineIdToken) {
    throw new Error('LINE identity token is required');
  }

  if (lineIdToken.length > 5000) {
    throw new Error('LINE identity token is too long');
  }
}

export const handler: Handler = async (event) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const { line_id_token } = JSON.parse(event.body || '{}');
    validateLineLoginInput(line_id_token);

    const clientIP = getClientIP(event);
    const rateLimitResult = rateLimit(clientIP);
    if (!rateLimitResult.success) {
      return errorResponse('Too many login attempts. Please try again later.', 429);
    }

    const settings = await query<{ setting_value: string }>(
      `SELECT setting_value
       FROM company_settings
       WHERE setting_key = $1
       LIMIT 1`,
      ['line_login_enabled']
    );

    if (settings[0]?.setting_value !== 'true') {
      return errorResponse('LINE Login is disabled', 403);
    }

    const lineProfile = await verifyLineIdToken(line_id_token);

    const employees = await query<EmployeeRow>(
      `SELECT
         e.id,
         e.employee_code,
         e.scan_code,
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
         d.name_th AS department_name_th,
         d.name_en AS department_name_en
       FROM employee_line_accounts ela
       INNER JOIN employees e ON e.id = ela.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ela.line_user_id = $1
         AND e.is_active = true
       LIMIT 1`,
      [lineProfile.sub]
    );

    if (employees.length === 0) {
      return errorResponse('LINE account is not linked to an active employee', 404);
    }

    const employee = employees[0];
    const role = employee.role || 'employee';
    const isDepartmentAdmin = !!employee.is_department_admin || role === 'admin';
    const isDepartmentManager =
      !!employee.is_department_manager || role === 'manager' || role === 'admin';
    const isHR = role === 'hr' || role === 'admin';

    const token = generateToken({
      userId: employee.id,
      employeeCode: employee.employee_code,
      role,
    });

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
      role,
      hire_date: employee.hire_date,
      profile_image_url: employee.profile_image_url,
      is_hr: isHR,
      is_department_admin: isDepartmentAdmin,
      is_department_manager: isDepartmentManager,
      status: employee.is_active ? 'active' : 'inactive',
      must_change_password: false,
      is_first_login: false,
      has_custom_password: true,
      auth_method: 'line',
    };

    return successResponse({
      user,
      token,
      message: 'LINE login successful',
      requires_password_change: false,
    });
  } catch (error: any) {
    const statusCode =
      error.message === 'LINE identity token is invalid or expired' ? 401 : 500;
    return errorResponse(error.message || 'LINE login failed', statusCode);
  }
};
