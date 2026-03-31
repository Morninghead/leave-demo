// netlify/functions/warning-statistics.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Warning Statistics API
 * GET: Get warning statistics
 * - Employees see only their own stats
 * - Managers see department stats
 * - HR/Admin see company-wide stats
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'GET') {
      const userId = event.user?.userId;
      const userRole = event.user?.role;
      const params = event.queryStringParameters || {};
      const scope = params.scope || 'personal'; // personal, department, company

      // Note: employee IDs are UUIDs (strings), not integers
      let employeeIds: string[] = [String(userId)];

      // Determine scope
      if (scope === 'department' || scope === 'company') {
        if (userRole === 'admin' || userRole === 'hr') {
          if (scope === 'company') {
            // Get all employees
            const allEmployees = await sql`SELECT id FROM employees`;
            employeeIds = allEmployees.map(e => e.id);
          } else {
            // Get department employees (use admin's department)
            const [admin] = await sql`SELECT department_id FROM employees WHERE id = ${userId}`;
            if (admin && admin.department_id) {
              const deptEmployees = await sql`
                SELECT id FROM employees WHERE department_id = ${admin.department_id}
              `;
              employeeIds = deptEmployees.map(e => e.id);
            }
          }
        } else {
          // Check if user is manager
          const [employee] = await sql`
            SELECT department_id, is_department_manager, is_department_admin
            FROM employees WHERE id = ${userId}
          `;

          if (employee && (employee.is_department_manager || employee.is_department_admin)) {
            const deptEmployees = await sql`
              SELECT id FROM employees WHERE department_id = ${employee.department_id}
            `;
            employeeIds = deptEmployees.map(e => e.id);
          }
        }
      }

      // Get warning counts by type
      const warningsByType = await sql`
        SELECT
          warning_type,
          COUNT(*) as count
        FROM warning_notices
        WHERE employee_id = ANY(${employeeIds}::uuid[])
        GROUP BY warning_type
        ORDER BY count DESC
      `;

      // Get warning counts by status
      const warningsByStatus = await sql`
        SELECT
          status,
          COUNT(*) as count
        FROM warning_notices
        WHERE employee_id = ANY(${employeeIds}::uuid[])
        GROUP BY status
        ORDER BY count DESC
      `;

      // Get active vs inactive
      const activeInactive = await sql`
        SELECT
          is_active,
          COUNT(*) as count
        FROM warning_notices
        WHERE employee_id = ANY(${employeeIds}::uuid[])
        GROUP BY is_active
      `;

      // Get warnings by month (last 12 months)
      const warningsByMonth = await sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count
        FROM warning_notices
        WHERE employee_id = ANY(${employeeIds}::uuid[])
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month DESC
      `;

      // Get offense type distribution
      const offenseDistribution = await sql`
        SELECT
          ot.name_th,
          ot.name_en,
          ot.severity_level,
          COUNT(wn.id) as count
        FROM warning_notices wn
        LEFT JOIN disciplinary_offense_types ot ON wn.offense_type_id = ot.id
        WHERE wn.employee_id = ANY(${employeeIds}::uuid[])
        GROUP BY ot.id, ot.name_th, ot.name_en, ot.severity_level
        ORDER BY count DESC
      `;

      // Get appeal statistics
      const appealStats = await sql`
        SELECT
          a.status,
          a.review_decision,
          COUNT(*) as count
        FROM warning_appeals a
        JOIN warning_notices wn ON a.warning_notice_id = wn.id
        WHERE wn.employee_id = ANY(${employeeIds}::uuid[])
        GROUP BY a.status, a.review_decision
      `;

      // Get top employees with most warnings (if company/department scope)
      let topEmployees = [];
      if (scope !== 'personal' && employeeIds.length > 1) {
        topEmployees = await sql`
          SELECT
            e.id,
            e.employee_code,
            e.first_name_th,
            e.last_name_th,
            COUNT(wn.id) as warning_count,
            COUNT(CASE WHEN wn.is_active THEN 1 END) as active_warning_count
          FROM employees e
          LEFT JOIN warning_notices wn ON e.id = wn.employee_id
          WHERE e.id = ANY(${employeeIds}::uuid[])
          GROUP BY e.id, e.employee_code, e.first_name_th, e.last_name_th
          HAVING COUNT(wn.id) > 0
          ORDER BY warning_count DESC
          LIMIT 10
        `;
      }

      // Get summary counts
      const [summary] = await sql`
        SELECT
          COUNT(*) as total_warnings,
          COUNT(CASE WHEN is_active THEN 1 END) as active_warnings,
          COUNT(CASE WHEN status = 'PENDING_ACKNOWLEDGEMENT' THEN 1 END) as pending_acknowledgement,
          COUNT(CASE WHEN status = 'APPEALED' THEN 1 END) as appealed,
          COUNT(CASE WHEN requires_hr_approval AND hr_approval_status = 'PENDING_HR_REVIEW' THEN 1 END) as pending_hr_approval
        FROM warning_notices
        WHERE employee_id = ANY(${employeeIds}::uuid[])
      `;

      return successResponse({
        scope,
        summary,
        warningsByType,
        warningsByStatus,
        activeInactive,
        warningsByMonth,
        offenseDistribution,
        appealStats,
        topEmployees,
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Statistics error:', error);
    return errorResponse(error.message || 'Failed to retrieve statistics', 500);
  }
});

export { handler };
