// netlify/functions/warning-acknowledge.ts
import { Handler } from '@netlify/functions';
import { sql, supabase } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Warning Notice Acknowledgement API
 * POST: Acknowledge or refuse to sign warning notice
 */

interface AcknowledgeRequest {
  warning_notice_id: number;
  action_type: 'ACKNOWLEDGED' | 'REFUSED';
  scroll_completed: boolean;
  scroll_percentage: number;
  time_spent_seconds: number;
  signature_data?: string; // Base64 canvas signature
  pdpa_consent?: boolean; // PDPA consent for signature storage
  employee_comment?: string;
  refuse_reason?: string; // Required if action_type = REFUSED
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'POST') {
      const body: AcknowledgeRequest = JSON.parse(event.body || '{}');
      const userId = event.user?.userId;
      const ipAddress = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
      const userAgent = event.headers['user-agent'] || '';

      // Validation
      if (!body.warning_notice_id) {
        return errorResponse('Warning notice ID is required', 400);
      }

      if (!body.action_type || !['ACKNOWLEDGED', 'REFUSED'].includes(body.action_type)) {
        return errorResponse('Invalid action type. Must be ACKNOWLEDGED or REFUSED', 400);
      }



      // Get warning notice
      const [warning] = await sql`
        SELECT * FROM warning_notices WHERE id = ${body.warning_notice_id}
      ` as any;

      if (!warning) {
        return errorResponse('Warning notice not found', 404);
      }

      // Check if user is the employee who received the warning
      // Note: Both userId (from JWT) and employee_id (from DB) are UUID strings
      const userIdStr = String(userId).trim();
      const warningEmployeeIdStr = String(warning.employee_id).trim();

      console.log('🔍 Employee ID Check:', {
        userId: userIdStr,
        warningEmployeeId: warningEmployeeIdStr,
        warningStatus: warning.status,
        warningNoticeNumber: warning.notice_number
      });

      if (warningEmployeeIdStr !== userIdStr) {
        console.error('❌ Employee ID mismatch:', { warningEmployeeId: warningEmployeeIdStr, userId: userIdStr });
        return errorResponse('You can only acknowledge your own warning notices', 403);
      }

      // Check if already acknowledged or refused
      const [existingAck] = await sql`
        SELECT * FROM warning_acknowledgements WHERE warning_notice_id = ${body.warning_notice_id}
      ` as any;

      if (existingAck) {
        return errorResponse('Warning notice already acknowledged or refused', 400);
      }

      // Check if warning is in PENDING_ACKNOWLEDGMENT status (note: no 'E' at the end)
      if (warning.status !== 'PENDING_ACKNOWLEDGMENT') {
        return errorResponse('Warning notice is not in pending acknowledgement status', 400);
      }

      // Get settings
      const [minScrollSetting] = await sql`
        SELECT setting_value FROM warning_system_settings WHERE setting_key = 'min_scroll_percentage'
      ` as any;
      const minScrollPercentage = parseInt(minScrollSetting?.setting_value || '100', 10);

      // Validate scroll percentage (only for ACKNOWLEDGED)
      if (body.action_type === 'ACKNOWLEDGED' && body.scroll_percentage < minScrollPercentage) {
        return errorResponse(
          `You must read the warning notice completely (minimum ${minScrollPercentage}% scroll)`,
          400
        );
      }

      // Auto-generate text signature using employee name if e-signature not provided
      let signatureData = body.signature_data;
      let signatureUrl: string | null = null;

      // If signature data is provided as base64, upload to Supabase Storage
      if (body.action_type === 'ACKNOWLEDGED' && signatureData && signatureData.startsWith('data:image')) {
        try {
          console.log('📝 Uploading signature to Supabase Storage...');

          // Convert base64 to buffer
          const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');

          // Generate unique filename
          const timestamp = Date.now();
          const filename = `warnings/${body.warning_notice_id}_${userId}_${timestamp}.png`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('Signature')
            .upload(filename, buffer, {
              contentType: 'image/png',
              upsert: true
            });

          if (uploadError) {
            console.error('❌ Signature upload error:', uploadError);
            // Continue with base64 signature as fallback
          } else {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('Signature')
              .getPublicUrl(filename);

            signatureUrl = urlData.publicUrl;
            signatureData = signatureUrl; // Store URL instead of base64
            console.log('✅ Signature uploaded:', signatureUrl);
          }
        } catch (uploadErr) {
          console.error('❌ Signature upload exception:', uploadErr);
          // Continue with original signature data
        }
      } else if (body.action_type === 'ACKNOWLEDGED' && !signatureData) {
        try {
          console.log('📝 Auto-generating signature for userId:', userId);
          // Get employee details for text signature
          const employees = await sql`
            SELECT first_name_th, last_name_th, first_name_en, last_name_en
            FROM employees
            WHERE id = ${userId}
          ` as any;

          const employee = employees[0];
          if (employee) {
            // Use Thai name for signature (format: "ชื่อ นามสกุล")
            signatureData = `${employee.first_name_th} ${employee.last_name_th}`;
            console.log('✅ Generated signature:', signatureData);
          } else {
            console.warn('⚠️ No employee found for userId:', userId);
          }
        } catch (sigError) {
          console.error('❌ Error generating signature:', sigError);
          // Continue without signature rather than failing entirely
        }
      }

      // Prepare timestamp values
      const currentTimestamp = new Date();
      const signatureTimestamp = body.action_type === 'ACKNOWLEDGED' ? currentTimestamp : null;
      const refusedTimestamp = body.action_type === 'REFUSED' ? currentTimestamp : null;

      // Insert acknowledgement record
      const [acknowledgement] = await sql`
        INSERT INTO warning_acknowledgements (
          warning_notice_id,
          employee_id,
          action_type,
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
          refused_at,
          refuse_reason_th,
          refuse_ip,
          employee_comment_th
        ) VALUES (
          ${body.warning_notice_id},
          ${userId},
          ${body.action_type},
          ${currentTimestamp},
          ${ipAddress},
          ${userAgent},
          ${body.scroll_completed || false},
          ${body.scroll_percentage || 0},
          ${body.time_spent_seconds || 0},
          ${signatureData || null},
          ${body.action_type === 'ACKNOWLEDGED' ? ipAddress : null},
          ${signatureTimestamp},
          ${body.action_type === 'REFUSED'},
          ${refusedTimestamp},
          ${body.refuse_reason || null},
          ${body.action_type === 'REFUSED' ? ipAddress : null},
          ${body.employee_comment || null}
        )
        RETURNING *
      ` as any;

      // Update warning status
      // ACKNOWLEDGED → ACTIVE (warning is now active and enforceable)
      // REFUSED → REFUSED (employee refused to sign, but warning is still enforceable)
      // Update warning status
      // ACKNOWLEDGED → ACKNOWLEDGED (warning is effective)
      // REFUSED → SIGNATURE_REFUSED (employee refused, but warning is effective)
      const newStatus = body.action_type === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'SIGNATURE_REFUSED';
      await sql`
        UPDATE warning_notices
        SET
          status = ${newStatus},
          is_active = true,
          updated_at = NOW()
        WHERE id = ${body.warning_notice_id}
      `;

      // Get appeal deadline from settings
      const [appealDeadlineSetting] = await sql`
        SELECT setting_value FROM warning_system_settings WHERE setting_key = 'appeal_deadline_days'
      ` as any;
      const appealDeadlineDays = parseInt(appealDeadlineSetting?.setting_value || '30', 10);
      const appealDeadline = new Date();
      appealDeadline.setDate(appealDeadline.getDate() + appealDeadlineDays);

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
          ${body.action_type === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'SIGNATURE_REFUSED'},
          ${userId},
          ${ipAddress},
          ${userAgent},
          ${JSON.stringify({
        scroll_percentage: body.scroll_percentage,
        time_spent_seconds: body.time_spent_seconds,
        has_signature: !!signatureData,
        signature_type: body.signature_data ? 'electronic' : 'text',
        has_comment: !!body.employee_comment,
      })}::jsonb,
          ${body.action_type === 'ACKNOWLEDGED'
          ? 'ดูแลพนักงาน: พนักงานรับทราบใบเตือนเรียบร้อยแล้ว'
          : 'ดูแลพนักงาน: พนักงานปฏิเสธการเซ็นชื่อ'}
        )
      `;

      // Notify issuer about acknowledgement/refusal
      try {
        await sql`
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
            ${warning.issued_by},
            ${body.action_type === 'ACKNOWLEDGED' ? 'พนักงานรับทราบใบเตือน' : 'พนักงานปฏิเสธเซ็นชื่อใบเตือน'},
            ${body.action_type === 'ACKNOWLEDGED' ? 'Employee acknowledged warning' : 'Employee refused to sign'},
            ${body.action_type === 'ACKNOWLEDGED'
            ? `พนักงานได้รับทราบใบเตือนเลขที่ ${warning.notice_number} แล้ว`
            : `พนักงานปฏิเสธการเซ็นชื่อใบเตือนเลขที่ ${warning.notice_number}`},
            ${body.action_type === 'ACKNOWLEDGED'
            ? `Employee has acknowledged warning notice ${warning.notice_number}`
            : `Employee refused to sign warning notice ${warning.notice_number}`},
            'warning',
            ${body.warning_notice_id},
            'warning_notice',
            false
          )
        ` as any;
        console.log('✅ Notification sent to issuer');
      } catch (notifError: any) {
        // Log error but don't fail the acknowledgement
        console.error('⚠️ Failed to send notification (non-critical):', notifError.message);
      }

      return successResponse({
        message: body.action_type === 'ACKNOWLEDGED'
          ? 'Warning notice acknowledged successfully'
          : 'Signature refusal recorded successfully',
        acknowledgement: {
          id: acknowledgement.id,
          action_type: body.action_type,
          appeal_deadline: appealDeadline.toISOString().split('T')[0],
          appeal_deadline_days: appealDeadlineDays,
        },
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Acknowledge warning error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    return errorResponse(error.message || 'Failed to acknowledge warning notice', 500);
  }
});

export { handler };
