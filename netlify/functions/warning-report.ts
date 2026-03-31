// netlify/functions/warning-report.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Warning Report API
 * GET: Generate individual employee warning report
 * Shows all warnings (active and inactive) with full timeline
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'GET') {
      const userId = event.user?.userId;
      const userRole = event.user?.role;

      if (!userId) {
        console.error('❌ Missing userId in authenticated request');
        return errorResponse('User ID not found in token', 401);
      }

      const params = event.queryStringParameters || {};
      // Use employeeId from params or default to userId
      // Note: employeeId could be either UUID string or integer depending on DB schema
      const requestedEmployeeId = params.employee_id;
      const employeeId = requestedEmployeeId || userId;

      // Validate employeeId is provided
      if (!employeeId) {
        console.error('❌ Missing employeeId');
        return errorResponse('Employee ID is required', 400);
      }

      console.log('🔍 Warning report request:', {
        userId,
        userRole,
        employeeId,
        requestedEmployeeId: params.employee_id,
        employeeIdType: typeof employeeId
      });

      // Access control
      let hasAccess = false;

      if (userRole === 'admin' || userRole === 'hr') {
        hasAccess = true;
      } else if (employeeId === userId) {
        // Employee accessing their own report
        hasAccess = true;
      } else {
        // Check if manager of same department
        // Cast to text to handle both UUID and INTEGER types
        const [employee] = await sql`
          SELECT department_id, is_department_manager, is_department_admin
          FROM employees WHERE id::text = ${userId}::text
        `;

        if (employee && (employee.is_department_manager || employee.is_department_admin)) {
          const [targetEmployee] = await sql`
            SELECT department_id FROM employees WHERE id::text = ${employeeId}::text
          `;

          if (targetEmployee && targetEmployee.department_id === employee.department_id) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        return errorResponse('Access denied', 403);
      }

      // Get employee info
      const [employee] = await sql`
        SELECT
          e.*,
          d.name_th as department_name_th,
          d.name_en as department_name_en
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.id::text = ${employeeId}::text
      `;

      if (!employee) {
        return errorResponse('Employee not found', 404);
      }

      // Get all warnings (active and inactive)
      const warnings = await sql`
        SELECT
          wn.*,
          ot.code as offense_code,
          ot.name_th as offense_name_th,
          ot.name_en as offense_name_en,
          ot.severity_level,
          issuer.employee_code as issuer_code,
          issuer.first_name_th as issuer_first_name_th,
          issuer.last_name_th as issuer_last_name_th,
          (
            SELECT json_build_object(
              'acknowledged_at', wa.acknowledged_at,
              'action_type', wa.action_type,
              'signature_refused', wa.signature_refused,
              'time_spent_seconds', wa.time_spent_seconds
            )
            FROM warning_acknowledgements wa
            WHERE wa.warning_notice_id = wn.id
            LIMIT 1
          ) as acknowledgement,
          (
            SELECT json_build_object(
              'appeal_id', wap.id,
              'status', wap.status,
              'review_decision', wap.review_decision,
              'submitted_at', wap.submitted_at,
              'reviewed_at', wap.reviewed_at
            )
            FROM warning_appeals wap
            WHERE wap.warning_notice_id = wn.id
            LIMIT 1
          ) as appeal
        FROM warning_notices wn
        LEFT JOIN disciplinary_offense_types ot ON wn.offense_type_id = ot.id
        LEFT JOIN employees issuer ON wn.issued_by::text = issuer.id::text
        WHERE wn.employee_id::text = ${employeeId}::text
        ORDER BY wn.created_at DESC
      `;

      // Categorize warnings
      const activeWarnings = warnings.filter(w => w.is_active);
      const inactiveWarnings = warnings.filter(w => !w.is_active);

      // Get summary statistics
      const stats = {
        total_warnings: warnings.length,
        active_warnings: activeWarnings.length,
        inactive_warnings: inactiveWarnings.length,
        by_type: {} as Record<string, number>,
        by_severity: {} as Record<number, number>,
        total_acknowledged: warnings.filter(w => w.status === 'ACKNOWLEDGED').length,
        total_appealed: warnings.filter(w => w.status === 'APPEALED').length,
        total_refused_signature: warnings.filter(w => w.status === 'SIGNATURE_REFUSED').length,
      };

      warnings.forEach(w => {
        // Count by type
        stats.by_type[w.warning_type] = (stats.by_type[w.warning_type] || 0) + 1;

        // Count by severity
        if (w.severity_level) {
          stats.by_severity[w.severity_level] = (stats.by_severity[w.severity_level] || 0) + 1;
        }
      });

      // Get warning timeline (all actions)
      const timeline = await sql`
        SELECT
          al.action,
          al.created_at,
          al.notes,
          wn.notice_number,
          wn.warning_type,
          e.first_name_th,
          e.last_name_th
        FROM warning_audit_logs al
        JOIN warning_notices wn ON al.warning_notice_id = wn.id
        LEFT JOIN employees e ON al.performed_by::text = e.id::text
        WHERE wn.employee_id::text = ${employeeId}::text
        ORDER BY al.created_at DESC
        LIMIT 50
      `;

      return successResponse({
        employee: {
          id: employee.id,
          employee_code: employee.employee_code,
          first_name_th: employee.first_name_th,
          last_name_th: employee.last_name_th,
          first_name_en: employee.first_name_en,
          last_name_en: employee.last_name_en,
          department_name_th: employee.department_name_th,
          department_name_en: employee.department_name_en,
          position_th: employee.position_th,
          position_en: employee.position_en,
          hire_date: employee.hire_date,
        },
        statistics: stats,
        active_warnings: activeWarnings,
        inactive_warnings: inactiveWarnings,
        timeline,
        generated_at: new Date().toISOString(),
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Warning report error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      userId: event.user?.userId,
      queryParams: event.queryStringParameters,
      fullError: JSON.stringify(error, null, 2)
    });

    // Provide more specific error messages
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      return errorResponse(
        'Warning system tables not found. Please run the warning system migration first.',
        500
      );
    }

    if (error.message?.includes('foreign key') || error.message?.includes('type')) {
      return errorResponse(
        'Database type mismatch. Please check warning system migration compatibility.',
        500
      );
    }

    return errorResponse(error.message || 'Failed to generate warning report', 500);
  }
});

export { handler };
