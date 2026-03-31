import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

const getEmployeeLeaveHistory = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const year = queryParams.year || new Date().getFullYear().toString();
    const employeeId = queryParams.employee_id; // Optional filter for specific employee

    // Build employee filter condition
    const employeeFilter = employeeId ? 'AND e.id = $2' : '';
    const params: any[] = [year];
    if (employeeId) params.push(employeeId);

    // 1. Get all employees with their leave history
    const employeeHistory = await query(
      `SELECT
        e.id as employee_id,
        e.employee_code,
        e.first_name_th,
        e.last_name_th,
        e.first_name_en,
        e.last_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        e.position_th,
        e.position_en,
        e.hire_date,
        COUNT(DISTINCT lr.id) as total_requests,
        COUNT(DISTINCT CASE WHEN lr.status = 'approved' THEN lr.id END) as approved_count,
        COUNT(DISTINCT CASE WHEN lr.status = 'rejected' THEN lr.id END) as rejected_count,
        COUNT(DISTINCT CASE WHEN lr.status = 'pending' THEN lr.id END) as pending_count,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0) as total_days_taken
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id
        AND EXTRACT(YEAR FROM lr.created_at) = $1
      WHERE e.is_active = true ${employeeFilter}
      GROUP BY e.id, e.employee_code, e.first_name_th, e.last_name_th,
               e.first_name_en, e.last_name_en, d.name_th, d.name_en,
               e.position_th, e.position_en, e.hire_date
      ORDER BY total_requests DESC, e.employee_code ASC`,
      params
    );

    // 2. Get leave requests by leave type for each employee
    const leaveByType = await query(
      `SELECT
        e.id as employee_id,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lt.color as leave_type_color,
        COUNT(*) as request_count,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0) as days_taken,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending
      FROM employees e
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id
        AND EXTRACT(YEAR FROM lr.created_at) = $1
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE e.is_active = true ${employeeFilter}
        AND lr.id IS NOT NULL
      GROUP BY e.id, lt.id, lt.name_th, lt.name_en, lt.color
      ORDER BY e.id, request_count DESC`,
      params
    );

    // 3. Get recent leave requests (last 50)
    const recentRequests = await query(
      `SELECT
        lr.id,
        e.employee_code,
        e.first_name_th || ' ' || e.last_name_th as employee_name_th,
        e.first_name_en || ' ' || e.last_name_en as employee_name_en,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lt.color as leave_type_color,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.is_half_day,
        lr.is_hourly_leave,
        lr.leave_start_time,
        lr.leave_end_time,
        lr.status,
        lr.created_at,
        lr.updated_at
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE EXTRACT(YEAR FROM lr.created_at) = $1 ${employeeFilter.replace('e.id', 'lr.employee_id')}
      ORDER BY lr.created_at DESC
      LIMIT 50`,
      params
    );

    // 4. Get leave balances for all employees
    const leaveBalances = await query(
      `SELECT
        e.id as employee_id,
        lb.leave_type_id,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lb.total_days,
        lb.used_days,
        lb.remaining_days
      FROM employees e
      LEFT JOIN leave_balances lb ON e.id = lb.employee_id AND lb.year = $1
      LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE e.is_active = true ${employeeFilter}
      ORDER BY e.id, lt.name_th`,
      params
    );

    // Group leave types and balances by employee
    const employeeMap = new Map();
    employeeHistory.forEach(emp => {
      employeeMap.set(emp.employee_id, {
        ...emp,
        leave_by_type: [],
        leave_balances: [],
        total_requests: parseInt(emp.total_requests),
        approved_count: parseInt(emp.approved_count),
        rejected_count: parseInt(emp.rejected_count),
        pending_count: parseInt(emp.pending_count),
        total_days_taken: parseFloat(emp.total_days_taken)
      });
    });

    leaveByType.forEach(lt => {
      const emp = employeeMap.get(lt.employee_id);
      if (emp) {
        emp.leave_by_type.push({
          leave_type_name_th: lt.leave_type_name_th,
          leave_type_name_en: lt.leave_type_name_en,
          leave_type_color: lt.leave_type_color,
          request_count: parseInt(lt.request_count),
          days_taken: parseFloat(lt.days_taken),
          approved: parseInt(lt.approved),
          rejected: parseInt(lt.rejected),
          pending: parseInt(lt.pending)
        });
      }
    });

    leaveBalances.forEach(lb => {
      const emp = employeeMap.get(lb.employee_id);
      if (emp) {
        emp.leave_balances.push({
          leave_type_name_th: lb.leave_type_name_th,
          leave_type_name_en: lb.leave_type_name_en,
          total_days: parseFloat(lb.total_days),
          used_days: parseFloat(lb.used_days),
          remaining_days: parseFloat(lb.remaining_days)
        });
      }
    });

    const employees = Array.from(employeeMap.values());

    // Calculate summary statistics
    const summary = {
      total_employees: employees.length,
      total_requests: employees.reduce((sum, emp) => sum + emp.total_requests, 0),
      total_approved: employees.reduce((sum, emp) => sum + emp.approved_count, 0),
      total_rejected: employees.reduce((sum, emp) => sum + emp.rejected_count, 0),
      total_pending: employees.reduce((sum, emp) => sum + emp.pending_count, 0),
      total_days_taken: employees.reduce((sum, emp) => sum + emp.total_days_taken, 0),
      avg_requests_per_employee: employees.length > 0 ?
        (employees.reduce((sum, emp) => sum + emp.total_requests, 0) / employees.length).toFixed(1) : '0',
      avg_days_per_employee: employees.length > 0 ?
        (employees.reduce((sum, emp) => sum + emp.total_days_taken, 0) / employees.length).toFixed(1) : '0'
    };

    return successResponse({
      year: parseInt(year),
      employees,
      recent_requests: recentRequests.map(req => ({
        ...req,
        total_days: parseFloat(req.total_days)
      })),
      summary
    });

  } catch (error: any) {
    logger.error('Employee leave history error:', error);
    return errorResponse(error.message || 'Failed to get employee leave history', 500);
  }
};

export const handler: Handler = requireAuth(getEmployeeLeaveHistory);
