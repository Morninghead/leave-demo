import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { syncAllEmployeeBalances } from './utils/sync-all-balances';
import { logger } from './utils/logger';

const leaveBalanceReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;
  const userId = event.user?.userId;

  try {
    const currentYear = new Date().getFullYear();

    // ✅ AUTO-SYNC: Ensure all active employees have leave balances for current year
    logger.log('🔄 [REPORT] Ensuring leave balances exist for all active employees...');
    try {
      const syncResult = await syncAllEmployeeBalances(currentYear);
      if (syncResult.balancesCreated > 0 || syncResult.balancesUpdated > 0) {
        logger.log('✅ [REPORT] Auto-sync completed:', {
          employees_processed: syncResult.employeesProcessed,
          balances_created: syncResult.balancesCreated,
          balances_updated: syncResult.balancesUpdated
        });
      }
    } catch (syncError: any) {
      logger.warn('⚠️ [REPORT] Auto-sync failed (non-critical):', syncError.message);
      // Don't fail the report if sync fails - proceed with existing data
    }

    let sql = `
      SELECT
        e.id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        e.position_th,
        e.position_en,
        CAST(COALESCE(MAX(CASE WHEN lt.code = 'SICK' THEN lb.remaining_days END), 0) AS NUMERIC) as sick_leave_balance,
        CAST(COALESCE(MAX(CASE WHEN lt.code = 'VAC' THEN lb.remaining_days END), 0) AS NUMERIC) as annual_leave_balance,
        CAST(COALESCE(MAX(CASE WHEN lt.code = 'PL' THEN lb.remaining_days END), 0) AS NUMERIC) as personal_leave_balance,
        CAST(COALESCE(MAX(CASE WHEN lt.code = 'SICK' THEN lb.used_days END), 0) AS NUMERIC) as sick_leave_used,
        CAST(COALESCE(MAX(CASE WHEN lt.code = 'VAC' THEN lb.used_days END), 0) AS NUMERIC) as annual_leave_used,
        CAST(COALESCE(MAX(CASE WHEN lt.code = 'PL' THEN lb.used_days END), 0) AS NUMERIC) as personal_leave_used,
        EXTRACT(YEAR FROM CURRENT_DATE) as year
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_balances lb ON e.id = lb.employee_id
        AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE e.is_active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by role
    if (!['hr', 'admin', 'dev'].includes(userRole || '')) {
      if (userRole === 'manager') {
        // Managers see only their department
        const userDept = await query('SELECT department_id FROM employees WHERE id = $1', [userId]);
        if (userDept.length > 0 && userDept[0].department_id) {
          sql += ` AND e.department_id = $${paramIndex}`;
          params.push(userDept[0].department_id);
          paramIndex++;
        }
      } else {
        // Regular employees see only their own data
        sql += ` AND e.id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }
    }

    sql += `
      GROUP BY e.id, e.employee_code, e.first_name_th, e.last_name_th,
               e.first_name_en, e.last_name_en, d.name_th, d.name_en,
               e.position_th, e.position_en
      ORDER BY d.name_th, e.employee_code
    `;

    const result = await query(sql, params);

    return successResponse({ balances: result });
  } catch (error: any) {
    logger.error('Leave balance report error:', error);
    return errorResponse(error.message || 'Failed to generate leave balance report', 500);
  }
};

export const handler: Handler = requireAuth(leaveBalanceReport);
