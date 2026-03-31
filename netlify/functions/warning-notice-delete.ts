// netlify/functions/warning-notice-delete.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { handleCORS, successResponse, errorResponse } from './utils/response';
import { verifyToken, getTokenFromHeader } from './utils/jwt';

// Note: This interface is not used in this function
// JWT token data is accessed directly from verifyToken() which returns JWTPayload
interface AuthenticatedEvent extends Omit<Parameters<Handler>[0], 'body'> {
  body: string;
}

/**
 * Delete (Void) a warning notice
 *
 * Authorization:
 * - Before acknowledgement: Issuer, HR, or Admin can delete
 * - After acknowledgement: Only HR or Admin can delete
 *
 * Soft Delete:
 * - Sets status to VOIDED
 * - Sets is_active to false
 * - Keeps record for audit trail
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleCORS(event);
  }

  if (event.httpMethod !== 'DELETE') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const token = getTokenFromHeader(event.headers.authorization || event.headers.Authorization);
    if (!token) {
      return errorResponse('Unauthorized - No token provided', 401);
    }

    const tokenData = verifyToken(token);
    if (!tokenData) {
      return errorResponse('Unauthorized - Invalid token', 401);
    }

    const warningId = event.queryStringParameters?.warning_id;

    console.log('🗑️ Delete warning request:', {
      warningId,
      userId: tokenData.userId,
      userRole: tokenData.role,
      queryParams: event.queryStringParameters
    });

    if (!warningId) {
      console.error('❌ Warning ID is missing from query parameters');
      return errorResponse('Warning ID is required', 400);
    }

    // Get existing warning
    const [existingWarning] = await sql`
      SELECT * FROM warning_notices WHERE id = ${warningId}
    `;

    if (!existingWarning) {
      return errorResponse('Warning notice not found', 404);
    }

    // Check if warning is already voided
    if (existingWarning.status === 'VOIDED') {
      return errorResponse('Warning is already voided', 400);
    }

    // Determine authorization based on warning status
    const wasAcknowledged = ['ACKNOWLEDGED', 'REFUSED', 'APPEALED'].includes(existingWarning.status);

    let canDelete = false;

    if (wasAcknowledged) {
      // After acknowledgement, only HR or Admin can delete
      canDelete = tokenData.role === 'hr' || tokenData.role === 'admin';
    } else {
      // Before acknowledgement, issuer, HR, or Admin can delete
      canDelete =
        tokenData.userId === existingWarning.issued_by ||
        tokenData.role === 'hr' ||
        tokenData.role === 'admin';
    }

    if (!canDelete) {
      return errorResponse(
        wasAcknowledged
          ? 'Only HR or Admin can delete acknowledged warnings'
          : 'You do not have permission to delete this warning',
        403
      );
    }

    // Get delete reason from request body (REQUIRED for legal/audit purposes)
    const body = event.body ? JSON.parse(event.body) : {};
    const deleteReason = body.reason?.trim() || '';

    // Validate that void reason is provided (mandatory for legal compliance)
    if (!deleteReason) {
      console.error('❌ Void reason is required but not provided');
      return errorResponse('Void reason is required for legal and audit purposes', 400);
    }



    console.log('✅ Void reason validated:', { length: deleteReason.length, preview: deleteReason.substring(0, 50) });

    // Soft delete: Set status to VOIDED and is_active to false
    const [voidedWarning] = await sql`
      UPDATE warning_notices
      SET
        status = 'VOIDED',
        is_active = false,
        void_reason = ${deleteReason},
        voided_by = ${tokenData.userId},
        voided_at = NOW(),
        updated_at = NOW()
      WHERE id = ${warningId}
      RETURNING *
    `;

    // Create audit log
    await sql`
      INSERT INTO warning_audit_logs (
        warning_notice_id,
        action,
        performed_by,
        changes,
        ip_address
      ) VALUES (
        ${warningId},
        'VOIDED',
        ${tokenData.userId},
        ${JSON.stringify({
      reason: deleteReason,
      previous_status: existingWarning.status,
      was_acknowledged: wasAcknowledged
    })}::jsonb,
        ${event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'}
      )
    `;

    // Notify the employee (non-critical, don't fail if notification fails)
    try {
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
          ${existingWarning.employee_id},
          ${tokenData.userId},
          'ใบเตือนของคุณถูกยกเลิก',
          'Your Warning Has Been Voided',
          ${`ใบเตือน ${existingWarning.notice_number} ของคุณถูกยกเลิก${deleteReason ? ': ' + deleteReason : ''}`},
          ${`Your warning ${existingWarning.notice_number} has been voided${deleteReason ? ': ' + deleteReason : ''}`},
          'warning_action',
          ${existingWarning.id},
          'warning_notice'
        )
      `;
    } catch (notifError: any) {
      console.error('⚠️ Failed to send notification to employee (non-critical):', notifError.message);
    }

    // If it was issued by someone else, notify the issuer
    if (tokenData.userId !== existingWarning.issued_by) {
      try {
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
            ${existingWarning.issued_by},
            ${tokenData.userId},
            'ใบเตือนที่คุณออกถูกยกเลิก',
            'Warning You Issued Has Been Voided',
            ${`ใบเตือน ${existingWarning.notice_number} ที่คุณออกถูกยกเลิกโดย ${tokenData.role === 'hr' ? 'HR' : 'Admin'}`},
            ${`Warning ${existingWarning.notice_number} you issued has been voided by ${tokenData.role === 'hr' ? 'HR' : 'Admin'}`},
            'warning_action',
            ${existingWarning.id},
            'warning_notice'
          )
        `;
      } catch (notifError: any) {
        console.error('⚠️ Failed to send notification to issuer (non-critical):', notifError.message);
      }
    }

    return successResponse({
      success: true,
      warning: voidedWarning,
      message: 'Warning notice voided successfully'
    });

  } catch (error: any) {
    console.error('Error deleting warning notice:', error);
    return errorResponse(error.message || 'Failed to delete warning notice', 500);
  }
};
