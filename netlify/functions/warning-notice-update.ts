// netlify/functions/warning-notice-update.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { handleCORS, successResponse, errorResponse } from './utils/response';
import { verifyToken, getTokenFromHeader } from './utils/jwt';

interface AuthenticatedEvent extends Omit<Parameters<Handler>[0], 'body'> {
  user?: {
    id: number;
    role: string;
    is_hr?: boolean;
  };
  body: string;
}

/**
 * Update a warning notice
 *
 * Authorization:
 * - Issuer can edit their own warnings
 * - HR can edit any warning
 * - Admin can edit any warning
 *
 * Re-approval Logic:
 * - If warning is already ACKNOWLEDGED or REFUSED, editing requires HR re-approval
 * - Status changes to DRAFT, requires_hr_approval = true
 * - New acknowledgement required after HR approves
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleCORS(event);
  }

  if (event.httpMethod !== 'PUT') {
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

    const user = {
      id: tokenData.userId,
      role: tokenData.role
    };
    const body = JSON.parse(event.body || '{}');
    const { warning_id, ...updateData } = body;

    if (!warning_id) {
      return errorResponse('Warning ID is required', 400);
    }

    // Get existing warning
    const [existingWarning] = await sql`
      SELECT * FROM warning_notices WHERE id = ${warning_id}
    `;

    if (!existingWarning) {
      return errorResponse('Warning notice not found', 404);
    }

    // Check authorization
    const canEdit =
      user.id === existingWarning.issued_by ||
      user.role === 'hr' ||
      user.role === 'admin';

    if (!canEdit) {
      return errorResponse('You do not have permission to edit this warning', 403);
    }

    // Determine if re-approval is needed
    const wasAcknowledged = ['ACKNOWLEDGED', 'REFUSED', 'APPEALED'].includes(existingWarning.status);
    const requiresReapproval = wasAcknowledged;

    // If warning was acknowledged and being edited, require HR re-approval
    let newStatus = existingWarning.status;
    let requiresHRApproval = existingWarning.requires_hr_approval;

    if (requiresReapproval) {
      newStatus = 'DRAFT';
      requiresHRApproval = true;
    }

    // Calculate expiry date (12 months from effective_date)
    const effectiveDate = updateData.effective_date || existingWarning.effective_date;
    const expiryDate = new Date(effectiveDate);

    // Prepare attachments - convert empty array to null for Postgres
    // Use explicit check for undefined to distinguish between "not provided" and "empty array"
    const rawAttachments = updateData.attachments_urls !== undefined
      ? updateData.attachments_urls
      : existingWarning.attachments_urls;
    const attachmentsArray = rawAttachments && rawAttachments.length > 0 ? rawAttachments : null;
    expiryDate.setMonth(expiryDate.getMonth() + 12);
    const autoInactiveDate = expiryDate.toISOString().split('T')[0];

    // Update warning notice
    const [updatedWarning] = await sql`
      UPDATE warning_notices
      SET
        warning_type = ${updateData.warning_type || existingWarning.warning_type},
        offense_type_id = ${updateData.offense_type_id || existingWarning.offense_type_id},
        incident_date = ${updateData.incident_date || existingWarning.incident_date},
        incident_description = ${updateData.incident_description || existingWarning.incident_description},
        incident_location = ${updateData.incident_location || existingWarning.incident_location},
        penalty_description = ${updateData.penalty_description || existingWarning.penalty_description},
        suspension_days = ${updateData.suspension_days || existingWarning.suspension_days},
        suspension_start_date = ${updateData.suspension_start_date || existingWarning.suspension_start_date},
        suspension_end_date = ${updateData.suspension_end_date || existingWarning.suspension_end_date},
        effective_date = ${effectiveDate},
        expiry_date = ${autoInactiveDate},
        auto_inactive_date = ${autoInactiveDate},
        status = ${newStatus},
        requires_hr_approval = ${requiresHRApproval},
        hr_approval_status = ${requiresReapproval ? null : existingWarning.hr_approval_status},
        attachments_urls = ${attachmentsArray},
        updated_at = NOW()
      WHERE id = ${warning_id}
      RETURNING *
    `;

    // Update witnesses if provided
    if (updateData.witnesses && Array.isArray(updateData.witnesses)) {
      // Delete existing witnesses
      await sql`DELETE FROM warning_witnesses WHERE warning_notice_id = ${warning_id}`;

      // Insert new witnesses
      for (const witness of updateData.witnesses) {
        if (witness.witness_name) {
          await sql`
            INSERT INTO warning_witnesses (
              warning_notice_id,
              witness_employee_id,
              witness_name,
              witness_position,
              statement
            ) VALUES (
              ${warning_id},
              ${(witness.witness_employee_id && witness.witness_employee_id !== "") ? witness.witness_employee_id : null},
              ${witness.witness_name},
              ${witness.witness_position || ''},
              ${witness.statement || ''}
            )
          `;
        }
      }
    }

    // Create audit log
    await sql`
      INSERT INTO warning_audit_logs (
        warning_notice_id,
        action,
        performed_by,
        changes,
        ip_address
      ) VALUES (
        ${warning_id},
        'EDITED',
        ${user.id},
        ${JSON.stringify({
      requires_reapproval: requiresReapproval,
      new_status: newStatus,
      previous_status: existingWarning.status,
      fields_updated: Object.keys(updateData)
    })}::jsonb,
        ${event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'}
      )
    `;

    // Send notification if re-approval is needed
    if (requiresReapproval) {
      // Notify HR for re-approval
      const hrUsers = await sql`
        SELECT id FROM employees WHERE role = 'hr' AND is_active = true
      `;

      for (const hr of hrUsers) {
        await sql`
          INSERT INTO notifications (
            employee_id,
            title_th,
            title_en,
            message_th,
            message_en,
            notification_type,
            action_url
          ) VALUES (
            ${hr.id},
            'ใบเตือนที่แก้ไขต้องการการอนุมัติ',
            'Edited Warning Requires Approval',
            ${`ใบเตือน ${updatedWarning.notice_number} ถูกแก้ไขและต้องการการอนุมัติจาก HR อีกครั้ง`},
            ${`Warning ${updatedWarning.notice_number} has been edited and requires HR re-approval`},
            'system',
            '/warnings'
          )
        `;
      }

      // Notify the employee that their warning was edited
      await sql`
        INSERT INTO notifications (
          employee_id,
          title_th,
          title_en,
          message_th,
          message_en,
          notification_type,
          action_url
        ) VALUES (
          ${existingWarning.employee_id},
          'ใบเตือนของคุณถูกแก้ไข',
          'Your Warning Has Been Edited',
          ${`ใบเตือน ${updatedWarning.notice_number} ของคุณถูกแก้ไขและต้องการการรับทราบอีกครั้ง`},
          ${`Your warning ${updatedWarning.notice_number} has been edited and requires re-acknowledgement`},
          'system',
          '/my-warnings'
        )
      `;
    }

    return successResponse({
      warning: updatedWarning,
      requires_reapproval: requiresReapproval,
      message: requiresReapproval
        ? 'Warning updated successfully. HR re-approval required.'
        : 'Warning updated successfully.'
    });

  } catch (error: any) {
    console.error('Error updating warning notice:', error);
    return errorResponse(error.message || 'Failed to update warning notice', 500);
  }
};
