
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Force Close Warning Notice API
 * POST: Manually close a pending warning (Treat as Refused)
 * Access: Admin, HR, or the Manager who issued it
 */

interface ForceCloseRequest {
  warning_notice_id: number;
  reason: string;
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: ForceCloseRequest = JSON.parse(event.body || '{}');
    const userId = event.user?.userId;
    const userRole = event.user?.role;

    if (!body.warning_notice_id || !body.reason) {
      return errorResponse('Warning ID and reason are required', 400);
    }

    // 1. Get Warning Notice
    const [warning] = await sql`
      SELECT id, notice_number, issued_by, employee_id, status 
      FROM warning_notices 
      WHERE id = ${body.warning_notice_id}
    ` as any;

    if (!warning) {
      return errorResponse('Warning notice not found', 404);
    }

    // 2. Check Permissions
    const isIssuer = String(warning.issued_by) === String(userId);
    const isAdminOrHR = userRole === 'admin' || userRole === 'hr' || userRole === 'dev';

    if (!isIssuer && !isAdminOrHR) {
      return errorResponse('You are not authorized to force close this warning', 403);
    }

    // 3. Validate Status
    if (warning.status !== 'PENDING_ACKNOWLEDGMENT') {
      return errorResponse('Only pending warnings can be force closed', 400);
    }

    // 4. Perform Close Action (Transactional)
    // 4. Perform Close Action (Sequential)
    const now = new Date();
    const refuseReason = `ผู้บังคับบัญชา/HR ปิดงาน: ${body.reason} (Force Closed by Manager/HR)`;

    // A. Insert refusal record
    await sql`
        INSERT INTO warning_acknowledgements (
          warning_notice_id,
          employee_id,
          action_type,
          refused_at,
          refuse_reason_th,
          signature_refused,
          ip_address,
          user_agent
        ) VALUES (
          ${warning.id},
          ${warning.employee_id},
          'REFUSED',
          ${now},
          ${refuseReason},
          true,
          ${event.headers['x-forwarded-for'] || 'unknown'},
          ${event.headers['user-agent'] || 'Manual-Action'}
        )
      ` as any;

    // B. Update Warning Status
    await sql`
        UPDATE warning_notices
        SET 
          status = 'SIGNATURE_REFUSED',
          is_active = true,
          updated_at = NOW()
        WHERE id = ${warning.id}
      ` as any;

    // C. Log Audit Trail
    await sql`
        INSERT INTO warning_audit_logs (
          warning_notice_id,
          action,
          performed_by,
          ip_address,
          changes,
          notes
        ) VALUES (
          ${warning.id},
          'FORCE_CLOSE',
          ${userId},
          ${event.headers['x-forwarded-for'] || 'unknown'},
          ${JSON.stringify({ reason: body.reason })}::jsonb,
          'ผู้บังคับบัญชา/HR บังคับปิดงาน (Force Close)'
        )
      ` as any;

    // D. Notification to Employee
    await sql`
        INSERT INTO notifications (
          employee_id,
          title_th,
          title_en,
          message_th,
          message_en,
          notification_type,
          related_id,
          related_type,
          is_read
        ) VALUES (
          ${warning.employee_id},
          'ใบเตือนถูกปิดงานโดยหัวหน้างาน',
          'Warning notice closed by manager',
          ${`ใบเตือนเลขที่ ${warning.notice_number} ถูกปิดงานโดยหัวหน้างาน/HR เนื่องจาก: ${body.reason}`},
          ${`Warning notice ${warning.notice_number} has been force closed by Manager/HR. Reason: ${body.reason}`},
          'warning',
          ${warning.id},
          'warning_notice',
          false
        )
      ` as any;

    return successResponse({
      message: 'Warning force closed successfully',
      status: 'SIGNATURE_REFUSED'
    });

  } catch (error: any) {
    console.error('❌ Force close error:', error);
    return errorResponse(error.message || 'Failed to force close warning', 500);
  }
});

export { handler };
