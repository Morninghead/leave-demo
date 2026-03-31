// netlify/functions/warning-notice-detail.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Warning Notice Detail API
 * GET: Get full details of a warning notice including witnesses, acknowledgements, appeals
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'GET') {
      const warningId = event.path.split('/').pop();

      if (!warningId || isNaN(parseInt(warningId, 10))) {
        return errorResponse('Invalid warning ID', 400);
      }

      const userId = event.user?.userId;
      const userRole = event.user?.role;

      // Get warning notice
      const [warning] = await sql`
        SELECT
          wn.*,
          e.employee_code,
          e.first_name_th,
          e.last_name_th,
          e.first_name_en,
          e.last_name_en,
          e.department_id,
          e.position_th,
          e.position_en,
          issuer.employee_code as issuer_code,
          issuer.first_name_th as issuer_first_name_th,
          issuer.last_name_th as issuer_last_name_th,
          issuer.first_name_en as issuer_first_name_en,
          issuer.last_name_en as issuer_last_name_en,
          ot.code as offense_code,
          ot.name_th as offense_name_th,
          ot.name_en as offense_name_en,
          ot.severity_level,
          hr_reviewer.first_name_th as hr_reviewer_first_name_th,
          hr_reviewer.last_name_th as hr_reviewer_last_name_th
        FROM warning_notices wn
        LEFT JOIN employees e ON wn.employee_id = e.id
        LEFT JOIN employees issuer ON wn.issued_by = issuer.id
        LEFT JOIN disciplinary_offense_types ot ON wn.offense_type_id = ot.id
        LEFT JOIN employees hr_reviewer ON wn.hr_reviewed_by = hr_reviewer.id
        WHERE wn.id = ${warningId}
      `;

      if (!warning) {
        return errorResponse('Warning notice not found', 404);
      }

      // Check access permission
      let hasAccess = false;

      if (userRole === 'admin' || userRole === 'hr') {
        hasAccess = true;
      } else if (String(warning.employee_id).trim() === String(userId).trim()) {
        // Employee can see their own warnings (using string comparison for UUIDs)
        hasAccess = true;
      } else {
        // Check if manager of same department
        const [employee] = await sql`
          SELECT department_id, is_department_manager, is_department_admin
          FROM employees
          WHERE id = ${userId}
        `;

        if (employee && (employee.is_department_manager || employee.is_department_admin)) {
          if (employee.department_id === warning.department_id) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        return errorResponse('Access denied', 403);
      }

      // Get witnesses
      const witnesses = await sql`
        SELECT
          w.*,
          e.employee_code as witness_employee_code,
          e.first_name_th as witness_first_name_th,
          e.last_name_th as witness_last_name_th
        FROM warning_witnesses w
        LEFT JOIN employees e ON w.witness_employee_id = e.id
        WHERE w.warning_notice_id = ${warningId}
        ORDER BY w.created_at ASC
      `;

      // Get acknowledgements
      const acknowledgements = await sql`
        SELECT
          wa.*,
          e.employee_code,
          e.first_name_th,
          e.last_name_th
        FROM warning_acknowledgements wa
        LEFT JOIN employees e ON wa.employee_id = e.id
        WHERE wa.warning_notice_id = ${warningId}
        ORDER BY wa.created_at DESC
      `;

      // Get appeals
      const appeals = await sql`
        SELECT
          a.*,
          e.employee_code,
          e.first_name_th,
          e.last_name_th,
          reviewer.first_name_th as reviewer_first_name_th,
          reviewer.last_name_th as reviewer_last_name_th
        FROM warning_appeals a
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN employees reviewer ON a.reviewed_by = reviewer.id
        WHERE a.warning_notice_id = ${warningId}
        ORDER BY a.submitted_at DESC
      `;

      // Get audit logs (only for HR/Admin)
      let auditLogs = [];
      if (userRole === 'admin' || userRole === 'hr') {
        auditLogs = await sql`
          SELECT
            al.*,
            e.employee_code,
            e.first_name_th,
            e.last_name_th
          FROM warning_audit_logs al
          LEFT JOIN employees e ON al.performed_by = e.id
          WHERE al.warning_notice_id = ${warningId}
          ORDER BY al.created_at DESC
        `;
      }

      return successResponse({
        warning,
        witnesses,
        acknowledgements,
        appeals,
        auditLogs,
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Warning detail error:', error);
    return errorResponse(error.message || 'Failed to retrieve warning details', 500);
  }
});

export { handler };
