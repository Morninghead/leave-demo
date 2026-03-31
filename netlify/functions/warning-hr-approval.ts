// netlify/functions/warning-hr-approval.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent, isHROrAdmin } from './utils/auth-middleware';

/**
 * Warning HR Approval API
 * PUT: Approve or reject warning notice (HR only, for SUSPENSION/TERMINATION)
 */

interface HRApprovalRequest {
  warning_notice_id: number;
  action: 'APPROVE' | 'REJECT';
  hr_review_notes_th?: string;
  hr_review_notes_en?: string;
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'PUT') {
      // Only HR and Dev can approve warnings (Admin is read-only)
      const userRole = event.user?.role;
      if (userRole !== 'hr' && userRole !== 'dev') {
        return errorResponse('Only HR can approve warning notices', 403);
      }

      const body: HRApprovalRequest = JSON.parse(event.body || '{}');
      const userId = event.user?.userId;

      // Validation
      if (!body.warning_notice_id) {
        return errorResponse('Warning notice ID is required', 400);
      }

      if (!body.action || !['APPROVE', 'REJECT'].includes(body.action)) {
        return errorResponse('Invalid action. Must be APPROVE or REJECT', 400);
      }

      // Get warning notice
      const [warning] = await sql`
        SELECT * FROM warning_notices WHERE id = ${body.warning_notice_id}
      ` as any;

      if (!warning) {
        return errorResponse('Warning notice not found', 404);
      }

      // Check if requires HR approval
      if (!warning.requires_hr_approval) {
        return errorResponse('This warning notice does not require HR approval', 400);
      }

      // Check if already reviewed
      if (warning.hr_approval_status !== 'PENDING_HR_REVIEW') {
        return errorResponse('Warning notice has already been reviewed by HR', 400);
      }

      const newHRStatus = body.action === 'APPROVE' ? 'HR_APPROVED' : 'HR_REJECTED';
      // After HR approval, warning stays PENDING_ACKNOWLEDGMENT until employee acknowledges
      // If rejected, warning is VOIDED and inactive
      const newWarningStatus = body.action === 'APPROVE' ? 'PENDING_ACKNOWLEDGMENT' : 'VOIDED';

      // Update warning notice
      await sql`
        UPDATE warning_notices
        SET
          hr_approval_status = ${newHRStatus},
          hr_reviewed_by = ${userId},
          hr_review_notes_th = ${body.hr_review_notes_th || null},
          hr_review_notes_en = ${body.hr_review_notes_en || null},
          hr_reviewed_at = NOW(),
          status = ${newWarningStatus},
          ${body.action === 'REJECT' ? sql`voided_at = NOW(), voided_by = ${userId}` : sql``},
          updated_at = NOW()
        WHERE id = ${body.warning_notice_id}
      `;

      // Log audit trail
      const notesTh = body.action === 'APPROVE' ? 'HR อนุมัติใบเตือน' : 'HR ปฏิเสธใบเตือน';
      const notesEn = body.action === 'APPROVE' ? 'HR approved warning notice' : 'HR rejected warning notice';
      await sql`
        INSERT INTO warning_audit_logs (
          warning_notice_id,
          action,
          performed_by,
          ip_address,
          changes,
          notes
        ) VALUES (
          ${body.warning_notice_id},
          ${body.action === 'APPROVE' ? 'HR_APPROVED' : 'HR_REJECTED'},
          ${userId},
          ${event.headers['x-forwarded-for'] || 'unknown'},
          ${JSON.stringify({ action: body.action })}::jsonb,
          ${notesTh + '\n---\n' + notesEn}
        )
      `;

      if (body.action === 'APPROVE') {
        // Notify employee
        await sql`
          INSERT INTO notifications (
            employee_id,
            title_th,
            title_en,
            message_th,
            message_en,
            notification_type,
            related_type,
            related_id,
            is_read
          ) VALUES (
            ${warning.employee_id},
            'คุณได้รับใบเตือน',
            'You have received a warning notice',
            ${'คุณได้รับใบเตือน ' + warning.warning_type + ' (เลขที่ ' + warning.notice_number + ') กรุณาเข้าสู่ระบบเพื่ออ่านและรับทราบ'},
            ${'You have received a ' + warning.warning_type + ' (Notice No. ' + warning.notice_number + '). Please login to read and acknowledge.'},
            'system',
            'warning_notice',
            ${warning.id},
            false
          )
        `;
      }

      // Notify issuer
      await sql`
        INSERT INTO notifications (
          employee_id,
          title_th,
          title_en,
          message_th,
          message_en,
          notification_type,
          related_type,
          related_id,
          is_read
        ) VALUES (
          ${warning.issued_by},
          ${body.action === 'APPROVE' ? 'HR อนุมัติใบเตือน' : 'HR ปฏิเสธใบเตือน'},
          ${body.action === 'APPROVE' ? 'HR approved warning notice' : 'HR rejected warning notice'},
          ${body.action === 'APPROVE'
          ? `HR อนุมัติใบเตือนเลขที่ ${warning.notice_number} แล้ว`
          : `HR ปฏิเสธใบเตือนเลขที่ ${warning.notice_number}`},
          ${body.action === 'APPROVE'
          ? `HR has approved warning notice ${warning.notice_number}`
          : `HR has rejected warning notice ${warning.notice_number}`},
          'system',
          'warning_notice',
          ${warning.id},
          false
        )
      `;

      return successResponse({
        message: body.action === 'APPROVE'
          ? 'Warning notice approved successfully'
          : 'Warning notice rejected successfully',
        warning: {
          id: warning.id,
          notice_number: warning.notice_number,
          hr_approval_status: newHRStatus,
          status: newWarningStatus,
        },
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ HR approval error:', error);
    return errorResponse(error.message || 'Failed to process HR approval', 500);
  }
});

export { handler };
