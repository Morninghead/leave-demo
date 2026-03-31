// netlify/functions/warning-manager-acknowledge.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Manager Acknowledgement API for Warning Notices
 * POST: Manager acknowledges warning notice for employee in their department
 * 
 * Flow: 
 * 1. Employee receives warning -> acknowledges/refuses
 * 2. Manager gets notification -> acknowledges 
 * 3. HR gets notification about status change
 */

interface ManagerAcknowledgeRequest {
  warning_notice_id: string;
  signature_data?: string; // Optional signature
  comment?: string; // Manager's comment
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'POST') {
      const body: ManagerAcknowledgeRequest = JSON.parse(event.body || '{}');
      const userId = event.user?.userId;
      const ipAddress = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
      const userAgent = event.headers['user-agent'] || '';

      // Validation
      if (!body.warning_notice_id) {
        return errorResponse('Warning notice ID is required', 400);
      }

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

      if (!manager.is_department_manager && !manager.is_department_admin) {
        return errorResponse('Only department managers can acknowledge warnings', 403);
      }

      // Get warning notice
      const warningResult = await sql`
        SELECT wn.*, emp.department_id as employee_department_id
        FROM warning_notices wn
        JOIN employees emp ON wn.employee_id = emp.id
        WHERE wn.id = ${body.warning_notice_id}
      `;
      const warning = (warningResult as Record<string, any>[])[0];

      if (!warning) {
        return errorResponse('Warning notice not found', 404);
      }

      // Check if employee is in manager's department
      if (warning.employee_department_id !== manager.department_id) {
        return errorResponse('You can only acknowledge warnings for employees in your department', 403);
      }

      // Check if already acknowledged by manager
      if (warning.manager_acknowledged) {
        return errorResponse('Warning notice already acknowledged by manager', 400);
      }

      // Manager can acknowledge at any status (independent of employee acknowledgement)
      // Only check that the warning exists and is not voided
      if (warning.status === 'VOIDED') {
        return errorResponse('Cannot acknowledge a voided warning notice', 400);
      }

      const currentTimestamp = new Date();

      // Update warning notice with manager acknowledgement
      await sql`
        UPDATE warning_notices
        SET
          manager_acknowledged = true,
          manager_acknowledged_by = ${userId},
          manager_acknowledged_at = ${currentTimestamp},
          updated_at = NOW()
        WHERE id = ${body.warning_notice_id}
      `;

      // Insert manager acknowledgement record
      await sql`
        INSERT INTO warning_acknowledgements (
          warning_notice_id,
          employee_id,
          action_type,
          acknowledger_type,
          acknowledged_at,
          ip_address,
          user_agent,
          scroll_completed,
          scroll_percentage,
          time_spent_seconds,
          signature_data,
          signature_ip,
          signature_timestamp,
          signature_refused,
          employee_comment
        ) VALUES (
          ${body.warning_notice_id},
          ${userId},
          'ACKNOWLEDGED',
          'MANAGER',
          ${currentTimestamp},
          ${ipAddress},
          ${userAgent},
          true,
          100,
          0,
          ${body.signature_data || null},
          ${body.signature_data ? ipAddress : null},
          ${body.signature_data ? currentTimestamp : null},
          false,
          ${body.comment || null}
        )
      `;

      // Log audit trail
      await sql`
        INSERT INTO warning_audit_logs (
          warning_notice_id,
          action,
          performed_by,
          ip_address,
          user_agent,
          changes,
          notes
        ) VALUES (
          ${body.warning_notice_id},
          'MANAGER_ACKNOWLEDGED',
          ${userId},
          ${ipAddress},
          ${userAgent},
          ${JSON.stringify({
        manager_id: userId,
        manager_name: `${manager.first_name_th} ${manager.last_name_th}`,
        has_signature: !!body.signature_data,
        has_comment: !!body.comment
      })}::jsonb,
          'หัวหน้าแผนกรับทราบใบเตือนของพนักงานในแผนก'
        )
      `;

      // Get employee info for notification
      const [employee] = await sql`
        SELECT first_name_th, last_name_th, first_name_en, last_name_en, employee_code
        FROM employees WHERE id = ${warning.employee_id}
      `;

      // Notify HR about manager acknowledgement
      try {
        // Get all HR employees
        const hrEmployeesResult = await sql`
          SELECT id FROM employees 
          WHERE (is_hr = true OR role = 'hr') 
          AND status = 'active'
        `;
        const hrEmployees = hrEmployeesResult as Record<string, any>[];

        for (const hr of hrEmployees) {
          await sql`
            INSERT INTO notifications (
              recipient_id,
              sender_id,
              title_th,
              title_en,
              message_th,
              message_en,
              type,
              reference_id,
              reference_type
            ) VALUES (
              ${hr.id},
              ${userId},
              'หัวหน้าแผนกรับทราบใบเตือน',
              'Manager Acknowledged Warning',
              ${'หัวหน้าแผนก ' + manager.first_name_th + ' ' + manager.last_name_th + ' ได้รับทราบใบเตือนเลขที่ ' + warning.notice_number + ' ของพนักงาน ' + (employee?.first_name_th || '') + ' ' + (employee?.last_name_th || '')},
              ${'Manager ' + manager.first_name_en + ' ' + manager.last_name_en + ' acknowledged warning notice ' + warning.notice_number + ' for employee ' + (employee?.first_name_en || '') + ' ' + (employee?.last_name_en || '')},
              'warning_manager_ack',
              ${body.warning_notice_id},
              'warning_notice'
            )
          `;
        }
        console.log(`✅ Notifications sent to ${hrEmployees.length} HR employees`);
      } catch (notifError: any) {
        console.error('⚠️ Failed to send HR notification (non-critical):', notifError.message);
      }

      return successResponse({
        success: true,
        message: 'Warning notice acknowledged by manager successfully',
        data: {
          warning_notice_id: body.warning_notice_id,
          notice_number: warning.notice_number,
          manager_acknowledged_at: currentTimestamp.toISOString(),
          manager_name: `${manager.first_name_th} ${manager.last_name_th}`
        }
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Manager acknowledge warning error:', error);
    return errorResponse(error.message || 'Failed to acknowledge warning notice', 500);
  }
});

export { handler };
