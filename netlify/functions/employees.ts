// netlify/functions/employees.ts
import { Handler } from '@netlify/functions';
import { sql, query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const getEmployees = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  // ✅ Allow hr, admin, and managers (department managers/admins)
  const userId = event.user?.id;
  const userRole = event.user?.role;

  try {
    // Get user's department and permission flags
    const [userInfo] = await sql`
      SELECT department_id, is_department_admin, is_department_manager, role
      FROM employees
      WHERE id = ${userId}
    `;

    const isHrOrAdmin = ['hr', 'admin'].includes(userRole || '');
    const isDeptManager = userInfo?.is_department_manager || false;
    const isDeptAdmin = userInfo?.is_department_admin || false;
    const userDeptId = userInfo?.department_id;

    // Permission check: Only hr, admin, or department managers/admins can access
    if (!isHrOrAdmin && !isDeptManager && !isDeptAdmin) {
      return errorResponse('Permission denied. Only HR, Admin, or Department Managers can view employees.', 403);
    }

    const searchParams = new URLSearchParams(event.rawQuery || '');
    const searchTerm = searchParams.get('search') || '';
    const filterRole = searchParams.get('role') || '';
    const filterStatus = searchParams.get('status') || ''; // Empty string means show all statuses

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Default: only show active employees (unless explicitly filtering)
    if (filterStatus === 'active') {
      conditions.push('e.is_active = true');
    } else if (filterStatus === 'inactive') {
      conditions.push('e.is_active = false');
    }
    // If filterStatus === 'all', don't add any condition

    // Department filtering: if user is dept manager/admin (not hr/admin), only show their department
    if (!isHrOrAdmin && (isDeptManager || isDeptAdmin) && userDeptId) {
      conditions.push(`e.department_id = $${paramIndex}`);
      params.push(userDeptId);
      paramIndex++;
    }

    if (searchTerm) {
      conditions.push(`(
        e.employee_code ILIKE $${paramIndex} OR
        e.first_name_th ILIKE $${paramIndex} OR
        e.last_name_th ILIKE $${paramIndex} OR
        e.first_name_en ILIKE $${paramIndex} OR
        e.last_name_en ILIKE $${paramIndex} OR
        e.email ILIKE $${paramIndex}
      )`);
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (filterRole && filterRole !== 'all') {
      conditions.push(`e.role = $${paramIndex}`);
      params.push(filterRole);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const queryText = `
      SELECT
        e.id,
        e.employee_code,
        e.first_name_th,
        e.last_name_th,
        e.first_name_en,
        e.last_name_en,
        e.first_name_th || ' ' || e.last_name_th as name_th,
        e.first_name_en || ' ' || e.last_name_en as name_en,
        e.email,
        e.phone_number,
        e.role,
        e.is_active,
        CASE
          WHEN e.is_active = true THEN 'active'
          ELSE 'inactive'
        END as status,
        e.position_th,
        e.position_en,
        e.department_id,
        e.hire_date,
        e.is_department_admin,
        e.is_department_manager,
        e.created_at,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY e.employee_code ASC
    `;

    const employees = await query(queryText, params);

    return successResponse({
      success: true,
      data: employees,
      employees, // Keep for backward compatibility
      count: employees.length
    });
  } catch (error: any) {
    console.error('Get employees error:', error);
    return errorResponse(error.message || 'Failed to get employees', 500);
  }
};

export const handler: Handler = requireAuth(getEmployees);
