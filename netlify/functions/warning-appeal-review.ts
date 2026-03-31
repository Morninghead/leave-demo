// netlify/functions/warning-appeal-review.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent, canManageSettings } from './utils/auth-middleware';

/**
 * Warning Appeal Review API
 * PUT: Review and decide on employee appeal (HR/Admin only)
 */

interface ReviewAppealRequest {
  appeal_id: number;
  review_decision: 'UPHELD' | 'MODIFIED' | 'OVERTURNED';
  review_decision_th: string;
  review_decision_en: string;
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'PUT') {
      // Only HR/Admin can review appeals
      if (!canManageSettings(event)) {
        return errorResponse('Only HR and Admin can review appeals', 403);
      }

      const body: ReviewAppealRequest = JSON.parse(event.body || '{}');
      const userId = event.user?.userId;

      // Validation
      if (!body.appeal_id) {
        return errorResponse('Appeal ID is required', 400);
      }

      if (!body.review_decision || !['UPHELD', 'MODIFIED', 'OVERTURNED'].includes(body.review_decision)) {
        return errorResponse('Invalid review decision. Must be UPHELD, MODIFIED, or OVERTURNED', 400);
      }

      if (!body.review_decision_th || !body.review_decision_en) {
        return errorResponse('Review decision explanation (Thai/English) is required', 400);
      }

      // Get appeal
      const [appeal] = await sql`
        SELECT * FROM warning_appeals WHERE id = ${body.appeal_id}
      `;

      if (!appeal) {
        return errorResponse('Appeal not found', 404);
      }

      // Check if already reviewed
      if (appeal.status !== 'PENDING') {
        return errorResponse('Appeal has already been reviewed', 400);
      }

      // Update appeal
      await sql`
        UPDATE warning_appeals
        SET
          status = 'UNDER_REVIEW',
          reviewed_by = ${userId},
          review_decision = ${body.review_decision},
          review_decision_th = ${body.review_decision_th},
          review_decision_en = ${body.review_decision_en},
          reviewed_at = NOW()
        WHERE id = ${body.appeal_id}
      `;

      // Update warning notice status based on decision
      let warningStatus: string;
      let warningIsActive: boolean;

      switch (body.review_decision) {
        case 'UPHELD':
          // Appeal rejected - warning becomes active and enforceable
          warningStatus = 'ACTIVE';
          warningIsActive = true;
          break;
        case 'MODIFIED':
          // Warning modified - remains active but with changes
          warningStatus = 'ACTIVE';
          warningIsActive = true;
          break;
        case 'OVERTURNED':
          // Appeal approved - warning is cancelled and void
          warningStatus = 'APPEAL_APPROVED';
          warningIsActive = false;
          break;
        default:
          warningStatus = 'ACTIVE';
          warningIsActive = true;
      }

      await sql`
        UPDATE warning_notices
        SET
          status = ${warningStatus},
          is_active = ${warningIsActive},
          updated_at = NOW(),
          ${body.review_decision === 'OVERTURNED' ? sql`voided_at = NOW(), voided_by = ${userId}` : sql``}
        WHERE id = ${appeal.warning_notice_id}
      `;

      // Log audit trail
      const notesTh = 'HR พิจารณาอุทธรณ์: ' + body.review_decision;
      const notesEn = 'HR reviewed appeal: ' + body.review_decision;
      await sql`
        INSERT INTO warning_audit_logs (
          warning_notice_id,
          action,
          performed_by,
          ip_address,
          changes,
          notes
        ) VALUES (
          ${appeal.warning_notice_id},
          'APPEAL_REVIEWED',
          ${userId},
          ${event.headers['x-forwarded-for'] || 'unknown'},
          ${JSON.stringify({ appeal_id: appeal.id, decision: body.review_decision })}::jsonb,
          ${notesTh + '\n---\n' + notesEn}
        )
      `;

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
          ${appeal.employee_id},
          'ผลการพิจารณาอุทธรณ์',
          'Appeal review decision',
          ${'การอุทธรณ์ของคุณได้รับการพิจารณาแล้ว ผลการตัดสินใจ: ' + body.review_decision},
          ${'Your appeal has been reviewed. Decision: ' + body.review_decision},
          'system',
          'warning_appeal',
          ${appeal.id},
          false
            'warning_appeal_reviewed'
        )
      `;

      // Mark appeal as reviewed (final status)
      await sql`
        UPDATE warning_appeals
        SET status = ${body.review_decision === 'UPHELD' ? 'REJECTED' : 'APPROVED'}
        WHERE id = ${body.appeal_id}
      `;

      return successResponse({
        message: 'Appeal reviewed successfully',
        appeal: {
          id: appeal.id,
          decision: body.review_decision,
          status: body.review_decision === 'UPHELD' ? 'REJECTED' : 'APPROVED',
        },
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Review appeal error:', error);
    return errorResponse(error.message || 'Failed to review appeal', 500);
  }
});

export { handler };
