// netlify/functions/warning-appeal-submit.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Warning Appeal Submission API
 * POST: Submit appeal for warning notice
 */

interface AppealRequest {
  warning_notice_id: number;
  appeal_reason_th: string;
  appeal_reason_en: string;
  evidence_urls?: string[];
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'POST') {
      const body: AppealRequest = JSON.parse(event.body || '{}');
      const userId = event.user?.userId;

      // Validation
      if (!body.warning_notice_id) {
        return errorResponse('Warning notice ID is required', 400);
      }

      // Validate appeal reason - at least one language required
      if (!body.appeal_reason_th && !body.appeal_reason_en) {
        return errorResponse('Appeal reason is required (Thai or English)', 400);
      }

      // Auto-fill missing language with provided language
      if (body.appeal_reason_th && !body.appeal_reason_en) {
        body.appeal_reason_en = body.appeal_reason_th;
      }
      if (body.appeal_reason_en && !body.appeal_reason_th) {
        body.appeal_reason_th = body.appeal_reason_en;
      }

      // Get warning notice
      const [warning] = await sql`
        SELECT * FROM warning_notices WHERE id = ${body.warning_notice_id}
      `;

      if (!warning) {
        return errorResponse('Warning notice not found', 404);
      }

      // Check if user is the employee
      // Note: Both userId (from JWT) and employee_id (from DB) are UUID strings
      const userIdStr = String(userId).trim();
      const warningEmployeeIdStr = String(warning.employee_id).trim();

      console.log('🔍 Appeal Employee ID Check:', {
        userId: userIdStr,
        warningEmployeeId: warningEmployeeIdStr,
        warningStatus: warning.status,
        warningNoticeNumber: warning.notice_number
      });

      if (warningEmployeeIdStr !== userIdStr) {
        console.error('❌ Appeal: Employee ID mismatch:', { warningEmployeeId: warningEmployeeIdStr, userId: userIdStr });
        return errorResponse('You can only appeal your own warning notices', 403);
      }

      // Check if warning can be appealed
      // Allow appeal if status is: PENDING_ACKNOWLEDGEMENT, ACKNOWLEDGED, or REFUSED
      // Accept both spellings: PENDING_ACKNOWLEDGEMENT and PENDING_ACKNOWLEDGMENT
      // Do NOT allow if already APPEALED or VOIDED
      const appealableStatuses = ['PENDING_ACKNOWLEDGEMENT', 'PENDING_ACKNOWLEDGMENT', 'ACKNOWLEDGED', 'REFUSED'];

      console.log('📋 Appeal check:', {
        warningId: warning.id,
        status: warning.status,
        isAppealable: appealableStatuses.includes(warning.status),
        effectiveDate: warning.effective_date
      });

      if (!appealableStatuses.includes(warning.status)) {
        if (warning.status === 'APPEALED') {
          return errorResponse('This warning has already been appealed', 400);
        }
        if (warning.status === 'VOIDED') {
          return errorResponse('Cannot appeal a voided warning', 400);
        }
        return errorResponse(`This warning cannot be appealed in its current status (${warning.status})`, 400);
      }

      // Check if already appealed
      const [existingAppeal] = await sql`
        SELECT * FROM warning_appeals WHERE warning_notice_id = ${body.warning_notice_id}
      `;

      if (existingAppeal) {
        return errorResponse('Appeal already submitted for this warning notice', 400);
      }

      // Get appeal deadline days from settings
      const [appealDeadlineSetting] = await sql`
        SELECT setting_value FROM warning_system_settings WHERE setting_key = 'appeal_deadline_days'
      `;
      const appealDeadlineDays = parseInt(appealDeadlineSetting?.setting_value || '30', 10);

      // Calculate appeal deadline from effective date (not acknowledgement date)
      // This allows employees to appeal before acknowledging
      const effectiveDate = new Date(warning.effective_date);
      const appealDeadline = new Date(effectiveDate);
      appealDeadline.setDate(appealDeadline.getDate() + appealDeadlineDays);

      // Debug logging for date calculation
      const now = new Date();
      console.log('⏰ Appeal Deadline Debug:', {
        rawEffectiveDate: warning.effective_date,
        parsedEffectiveDate: effectiveDate.toISOString(),
        deadlineDays: appealDeadlineDays,
        appealDeadline: appealDeadline.toISOString(),
        currentTime: now.toISOString(),
        isPastDeadline: now > appealDeadline,
        diffInMs: now.getTime() - appealDeadline.getTime(),
        diffInDays: Math.ceil((now.getTime() - appealDeadline.getTime()) / (1000 * 60 * 60 * 24))
      });

      // Check if within deadline
      if (now > appealDeadline) {
        const deadlineDateStr = appealDeadline.toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const daysPassed = Math.ceil((now.getTime() - appealDeadline.getTime()) / (1000 * 60 * 60 * 24));
        return errorResponse(
          `ไม่สามารถอุทธรณ์ได้ เนื่องจากเลยกำหนดเวลาอุทธรณ์แล้ว (หมดเขต ${deadlineDateStr} - เลยกำหนด ${daysPassed} วัน) / Appeal deadline has passed. Deadline was ${appealDeadline.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysPassed} day(s) ago)`,
          400
        );
      }

      // Insert appeal
      const [appeal] = await sql`
        INSERT INTO warning_appeals (
          warning_notice_id,
          employee_id,
          appeal_reason_th,
          appeal_reason_en,
          evidence_urls,
          status,
          appeal_deadline
        ) VALUES (
          ${body.warning_notice_id},
          ${userId},
          ${body.appeal_reason_th},
          ${body.appeal_reason_en},
          ${body.evidence_urls ? JSON.stringify(body.evidence_urls) : null}::text[],
          'PENDING',
          ${appealDeadline.toISOString().split('T')[0]}
        )
        RETURNING *
      `;

      // Update warning status
      await sql`
        UPDATE warning_notices
        SET
          status = 'APPEALED',
          updated_at = NOW()
        WHERE id = ${body.warning_notice_id}
      `;

      // Log audit trail
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
          'APPEALED',
          ${userId},
          ${event.headers['x-forwarded-for'] || 'unknown'},
          ${JSON.stringify({ appeal_id: appeal.id })}::jsonb,
          ${'พนักงานยื่นอุทธรณ์ใบเตือน\n---\nEmployee submitted appeal'}
        )
      `;

      // Notify HR
      const hrUsers = await sql`
        SELECT id FROM employees WHERE role = 'hr'
      `;

      for (const hrUser of hrUsers) {
        await sql`
          INSERT INTO notifications (
            recipient_id,
            title_th,
            title_en,
            message_th,
            message_en,
            type
          ) VALUES (
            ${hrUser.id},
            'การอุทธรณ์ใบเตือนใหม่',
            'New warning appeal submitted',
            ${'พนักงานยื่นอุทธรณ์ใบเตือนเลขที่ ' + warning.notice_number},
            ${'Employee submitted appeal for warning notice ' + warning.notice_number},
            'system'
          )
        `;
      }

      return successResponse({
        message: 'Appeal submitted successfully',
        appeal: {
          id: appeal.id,
          status: 'PENDING',
          appeal_deadline: appealDeadline.toISOString().split('T')[0],
        },
      }, 201);
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Submit appeal error:', error);
    return errorResponse(error.message || 'Failed to submit appeal', 500);
  }
});

export { handler };
