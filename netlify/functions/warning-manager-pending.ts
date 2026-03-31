// netlify/functions/warning-manager-pending.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Get pending warnings for department managers to acknowledge
 * Returns warnings for employees in the manager's department that:
 * 1. Have been acknowledged by employee (status = ACTIVE or REFUSED)
 * 2. Have NOT been acknowledged by manager yet
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'GET') {
      const userId = event.user?.userId;

      // Check if user is a department manager
      const [manager] = await sql`
        SELECT id, department_id, is_department_manager, is_department_admin,
               first_name_th, last_name_th, first_name_en, last_name_en
        FROM employees
        WHERE id = ${userId}
      `;

      if (!manager) {
        return errorResponse('Employee not found', 404);
      }

      // Only managers can access this endpoint
      if (!manager.is_department_manager && !manager.is_department_admin) {
        return successResponse({
          success: true,
          data: [],
          message: 'Not a department manager'
        });
      }

      // Get warnings for employees in manager's department that need manager acknowledgement
      const pendingWarnings = await sql`
        SELECT 
          wn.id,
          wn.notice_number,
          wn.warning_type,
          wn.incident_date,
          wn.incident_description,
          wn.incident_location,
          wn.penalty_description,
          wn.effective_date,
          wn.status,
          wn.attachments_urls,
          wn.suspension_days,
          wn.suspension_start_date,
          wn.suspension_end_date,
          wn.manager_acknowledged,
          wn.created_at,
          -- Employee info (the warned employee)
          emp.id as employee_id,
          emp.employee_code,
          emp.first_name_th as employee_first_name_th,
          emp.last_name_th as employee_last_name_th,
          emp.first_name_en as employee_first_name_en,
          emp.last_name_en as employee_last_name_en,
          emp.position_th as employee_position_th,
          emp.position_en as employee_position_en,
          -- Issuer info
          issuer.first_name_th as issuer_first_name_th,
          issuer.last_name_th as issuer_last_name_th,
          issuer.first_name_en as issuer_first_name_en,
          issuer.last_name_en as issuer_last_name_en,
          issuer.position_th as issuer_position_th,
          issuer.position_en as issuer_position_en,
          -- Offense info
          ot.name_th as offense_name_th,
          ot.name_en as offense_name_en,
          ot.severity_level,
          -- Witnesses
          (
            SELECT json_agg(json_build_object(
              'witness_name', ww.witness_name,
              'witness_position', ww.witness_position,
              'statement', ww.statement
            ))
            FROM warning_witnesses ww
            WHERE ww.warning_notice_id = wn.id
          ) as witnesses
        FROM warning_notices wn
        JOIN employees emp ON wn.employee_id = emp.id
        JOIN employees issuer ON wn.issued_by = issuer.id
        LEFT JOIN disciplinary_offense_types ot ON wn.offense_type_id = ot.id
        WHERE 
          -- Employee is in manager's department
          emp.department_id = ${manager.department_id}
          -- Show warnings in ANY active status (including pending employee acknowledgement)
          -- Manager should see warnings as soon as they are issued
          AND wn.status IN ('PENDING_ACKNOWLEDGMENT', 'ACTIVE', 'REFUSED')
          -- Manager has not acknowledged yet
          AND (wn.manager_acknowledged = false OR wn.manager_acknowledged IS NULL)
          -- Not the manager's own warning
          AND wn.employee_id != ${userId}
        ORDER BY wn.created_at DESC
        LIMIT 10
      `;

      console.log(`📋 Found ${pendingWarnings.length} pending warnings for manager acknowledgement`);

      return successResponse({
        success: true,
        data: pendingWarnings,
        manager: {
          id: manager.id,
          department_id: manager.department_id,
          is_department_manager: manager.is_department_manager
        }
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Manager pending warnings error:', error);
    return errorResponse(error.message || 'Failed to fetch pending warnings', 500);
  }
});

export { handler };
