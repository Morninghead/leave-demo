// netlify/functions/employee-off-days-calendar.ts
// Calendar view API for HR to see employee off-days by department/date range

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const getOffDaysCalendar = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const userRole = event.user?.role;

        // Only HR and dev can access calendar view
        if (!['hr', 'dev'].includes(userRole || '')) {
            return errorResponse('Unauthorized: HR or dev role required', 403);
        }

        const params = event.queryStringParameters || {};
        const {
            department_id,
            start_date,
            end_date,
        } = params;

        // Build query to get employees with their off-days
        let sql = `
      SELECT 
        e.id as employee_id,
        e.employee_code,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        d.name_en as department_name_en,
        d.name_th as department_name_th,
        d.id as department_id,
        COALESCE(
          json_agg(
            json_build_object(
              'id', eod.id,
              'off_date', eod.off_date,
              'off_type', eod.off_type,
              'notes', eod.notes
            ) ORDER BY eod.off_date
          ) FILTER (WHERE eod.id IS NOT NULL),
          '[]'
        ) as off_days
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employee_off_days eod ON e.id = eod.employee_id
    `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        // Build WHERE clause
        const whereClauses: string[] = ['e.is_active = true'];

        // Filter by department
        if (department_id) {
            whereClauses.push(`e.department_id = $${paramIndex}`);
            queryParams.push(department_id);
            paramIndex++;
        }

        // Filter by date range (on off_days)
        if (start_date) {
            whereClauses.push(`(eod.off_date IS NULL OR eod.off_date >= $${paramIndex})`);
            queryParams.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereClauses.push(`(eod.off_date IS NULL OR eod.off_date <= $${paramIndex})`);
            queryParams.push(end_date);
            paramIndex++;
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        sql += `
      GROUP BY e.id, e.employee_code, e.first_name_en, e.last_name_en, 
               e.first_name_th, e.last_name_th, d.name_en, d.name_th, d.id
      ORDER BY d.name_en, e.employee_code
    `;

        const employees = await query(sql, queryParams);

        // Filter out employees with no off-days (for cleaner calendar view)
        const employeesWithOffDays = employees.filter(emp =>
            emp.off_days && emp.off_days.length > 0 && emp.off_days[0].id !== null
        );

        return successResponse({
            success: true,
            employees: employeesWithOffDays,
            total_employees: employeesWithOffDays.length,
            date_range: {
                start: start_date || null,
                end: end_date || null,
            },
        });

    } catch (error: any) {
        console.error('Get off-days calendar error:', error);
        return errorResponse(error.message || 'Failed to get off-days calendar', 500);
    }
};

export const handler: Handler = requireAuth(getOffDaysCalendar);
