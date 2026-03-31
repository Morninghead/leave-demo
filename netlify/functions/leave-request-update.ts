import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { canUserApprove, getNextStage, getApprovalFlow } from './utils/approval-flow';
import {
  sendLeaveRequestApproved,
  sendLeaveRequestRejected,
  areEmailAlertsEnabled,
} from './utils/email-service';
import { logReject, logApprove, logUpdate } from './utils/audit-logger';
import { logger } from './utils/logger';
import { deleteLeaveAttachments } from './utils/storage-cleanup';
import { sendLeaveRequestNotification } from './utils/line-notify';
import { sendTelegramLeaveNotification } from './utils/telegram-notify';
import { getAttachmentCount } from './utils/attachment-helper';

const updateLeaveRequest = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  const requestId = event.path.split('/').pop();
  if (!requestId) {
    return errorResponse('Request ID is required', 400);
  }

  const userId = event.user?.userId;
  if (!userId) {
    return errorResponse('User not authenticated', 401);
  }

  try {
    // ✅ Extensive logging
    logger.log('=== [BACKEND] UPDATE LEAVE REQUEST ===');
    logger.log('Method:', event.httpMethod);
    logger.log('Path:', event.path);
    logger.log('Request ID:', requestId);
    logger.log('User ID:', userId);
    logger.log('Raw Body:', event.body);
    logger.log('Body Type:', typeof event.body);
    logger.log('Body Length:', event.body?.length);

    // ✅ Handle empty body
    if (!event.body || event.body.trim() === '') {
      logger.error('❌ [BACKEND] Empty request body');
      return errorResponse('Request body is required', 400);
    }

    let body;
    try {
      body = JSON.parse(event.body);
      logger.log('✅ [BACKEND] Parsed Body:', JSON.stringify(body, null, 2));
    } catch (parseError: any) {
      logger.error('❌ [BACKEND] JSON Parse Error:', parseError.message);
      return errorResponse('Invalid JSON in request body', 400);
    }

    const { action, rejection_reason } = body;

    // ✅ Detailed validation
    logger.log('Action received:', action);
    logger.log('Rejection reason:', rejection_reason);

    if (!action) {
      logger.error('❌ [BACKEND] Missing action field');
      return errorResponse('Action field is required', 400);
    }

    if (!['approve', 'reject', 'cancel'].includes(action)) {
      logger.error('❌ [BACKEND] Invalid action:', action);
      return errorResponse(
        'Invalid action. Must be "approve", "reject", or "cancel"',
        400
      );
    }

    logger.log('✅ [BACKEND] Action validation passed:', action);

    // Fetch current leave request
    const leaveRequestResult = await query(
      `SELECT 
        lr.*,
        e.department_id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       WHERE lr.id = $1`,
      [requestId]
    );

    if (leaveRequestResult.length === 0) {
      logger.error('❌ [BACKEND] Leave request not found:', requestId);
      return errorResponse('Leave request not found', 404);
    }

    const leaveRequest = leaveRequestResult[0];
    logger.log('✅ [BACKEND] Leave request found:', {
      id: leaveRequest.id,
      employee_id: leaveRequest.employee_id,
      status: leaveRequest.status,
      current_approval_stage: leaveRequest.current_approval_stage,
    });

    // ==========================================
    // ✅ HANDLE CANCEL ACTION (AMERICAN ENGLISH)
    // ==========================================
    if (action === 'cancel') {
      logger.log('🔵 [BACKEND] Processing CANCEL action');

      // Check ownership
      if (leaveRequest.employee_id !== userId) {
        logger.error('❌ [BACKEND] Unauthorized cancel attempt:', {
          employee_id: leaveRequest.employee_id,
          userId,
        });
        return errorResponse('You can only cancel your own leave requests', 403);
      }

      // Check if cancellable
      if (leaveRequest.status !== 'pending') {
        logger.error('❌ [BACKEND] Cannot cancel non-pending request:', {
          status: leaveRequest.status,
        });
        return errorResponse(
          `Only pending requests can be canceled. Current status: ${leaveRequest.status}`,
          400
        );
      }

      logger.log('✅ [BACKEND] Cancel validation passed, updating database...');

      // ✅ PROFESSIONAL HRM: Release pending balance when canceled
      const currentYear = new Date().getFullYear();

      // First update the request status
      await query(
        `UPDATE leave_requests
         SET status = 'canceled',
             canceled_by = $1,
             canceled_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [userId, requestId]
      );

      // Then release the pending balance (use GREATEST to prevent negative values)
      // Note: remaining_days is a GENERATED column, so we don't update it directly
      await query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(0, pending_days - $1),
             updated_at = NOW()
         WHERE employee_id = $2
           AND leave_type_id = $3
           AND year = $4`,
        [leaveRequest.total_days, leaveRequest.employee_id, leaveRequest.leave_type_id, currentYear]
      );

      logger.log(`✅ [BACKEND] Leave request canceled and ${leaveRequest.total_days} days released from pending balance`);

      // 🗑️ Delete attachments from storage (non-blocking) - DISABLED TO PRESERVE HISTORY
      // if (leaveRequest.attachment_urls && leaveRequest.attachment_urls.length > 0) {
      //   try {
      //     const cleanupResult = await deleteLeaveAttachments(leaveRequest.attachment_urls);
      //     logger.log('🗑️ [BACKEND] Attachment cleanup result:', cleanupResult);
      //   } catch (cleanupErr: any) {
      //     logger.warn('⚠️ [BACKEND] Attachment cleanup failed (non-critical):', cleanupErr.message);
      //   }
      // }

      // Fetch updated request
      const updatedRequest = await query(
        `SELECT 
          lr.*,
          e.employee_code,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
          d.name_th as department_name_th,
          d.name_en as department_name_en,
          lt.code as leave_type_code,
          lt.name_th as leave_type_name_th,
          lt.name_en as leave_type_name_en
         FROM leave_requests lr
         LEFT JOIN employees e ON lr.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.id = $1`,
        [requestId]
      );

      logger.log('✅ [BACKEND] Returning canceled request');

      // Send Notifications (LINE & Telegram)
      try {
        const cancelAttachmentCount = getAttachmentCount(updatedRequest[0].attachment_urls);
        const notificationParams = {
          action: 'canceled' as const,
          employeeName: updatedRequest[0].employee_name_th || updatedRequest[0].employee_name_en,
          departmentName: updatedRequest[0].department_name_en || updatedRequest[0].department_name_th,
          leaveTypeName: updatedRequest[0].leave_type_name_th || updatedRequest[0].leave_type_name_en,
          startDate: updatedRequest[0].start_date,
          endDate: updatedRequest[0].end_date,
          totalDays: updatedRequest[0].total_days,
          // Hourly leave info
          isHourlyLeave: updatedRequest[0].is_hourly_leave,
          leaveMinutes: updatedRequest[0].leave_minutes,
          leaveStartTime: updatedRequest[0].leave_start_time,
          leaveEndTime: updatedRequest[0].leave_end_time,
          // Attachment info
          hasAttachments: cancelAttachmentCount > 0,
          attachmentCount: cancelAttachmentCount,
        };

        await sendLeaveRequestNotification(notificationParams);
        await sendTelegramLeaveNotification(notificationParams);
      } catch (notifyError) {
        logger.error('[NOTIFY] Failed to send cancel notification:', notifyError);
      }

      return successResponse({
        leave_request: updatedRequest[0],
        message: 'Leave request canceled successfully',
      });
    }

    // ==========================================
    // HANDLE APPROVE/REJECT ACTIONS
    // ==========================================
    logger.log('🔵 [BACKEND] Processing', action.toUpperCase(), 'action');

    if (leaveRequest.status !== 'pending') {
      logger.error('❌ [BACKEND] Cannot process non-pending request:', {
        status: leaveRequest.status,
      });
      return errorResponse(
        `Cannot ${action} a request with status: ${leaveRequest.status}`,
        400
      );
    }

    const canApprove = await canUserApprove(
      userId,
      leaveRequest.employee_id,
      leaveRequest.department_id,
      leaveRequest.current_approval_stage
    );

    if (!canApprove.allowed) {
      logger.error('❌ [BACKEND] Not authorized to approve:', canApprove.reason);
      return errorResponse(canApprove.reason || 'Not authorized to approve', 403);
    }

    const currentStage = leaveRequest.current_approval_stage;
    logger.log('✅ [BACKEND] Approval authorization passed, stage:', currentStage);
    logger.log('🔍 [APPROVAL] HR bypass flag:', canApprove.shouldBypassToFinal);

    // REJECT action
    if (action === 'reject') {
      if (!rejection_reason || rejection_reason.trim() === '') {
        logger.error('❌ [BACKEND] Missing rejection reason');
        return errorResponse('Rejection reason is required', 400);
      }

      logger.log('🔵 [BACKEND] Rejecting request with reason:', rejection_reason);

      const currentYear = new Date().getFullYear();

      // First update request status
      await query(
        `UPDATE leave_requests
         SET status = 'rejected',
             rejection_stage = $1,
             rejection_reason_th = $2,
             rejection_reason_en = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [
          currentStage === 1 || currentStage === 2 ? 'department' : 'hr',
          rejection_reason,
          requestId,
        ]
      );

      // ✅ PROFESSIONAL HRM: Release pending balance when rejected (use GREATEST to prevent negative values)
      // Note: remaining_days is a GENERATED column, so we don't update it directly
      await query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(0, pending_days - $1),
             updated_at = NOW()
         WHERE employee_id = $2
           AND leave_type_id = $3
           AND year = $4`,
        [leaveRequest.total_days, leaveRequest.employee_id, leaveRequest.leave_type_id, currentYear]
      );

      logger.log(`✅ [BACKEND] Request rejected and ${leaveRequest.total_days} days released from pending balance`);

      // ===== AUDIT LOG =====
      await logReject(
        userId,
        'leave_request',
        requestId,
        event,
        { rejection_reason, rejection_stage: currentStage }
      );

      const rejectedRequest = await query(
        `SELECT
          lr.*,
          e.employee_code,
          e.email,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
          d.name_th as department_name_th,
          d.name_en as department_name_en,
          lt.code as leave_type_code,
          lt.name_th as leave_type_name_th,
          lt.name_en as leave_type_name_en
         FROM leave_requests lr
         LEFT JOIN employees e ON lr.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.id = $1`,
        [requestId]
      );

      // Send rejection email to employee
      const emailsEnabled = await areEmailAlertsEnabled();
      if (emailsEnabled && rejectedRequest[0]?.email) {
        try {
          // Get rejector name
          const rejectorResult = await query(
            `SELECT CONCAT(first_name_en, ' ', last_name_en) as name_en,
                    CONCAT(first_name_th, ' ', last_name_th) as name_th
             FROM employees WHERE id = $1`,
            [userId]
          );

          await sendLeaveRequestRejected(
            rejectedRequest[0].employee_name_en || rejectedRequest[0].employee_name_th,
            rejectedRequest[0].email,
            rejectedRequest[0].leave_type_name_en || rejectedRequest[0].leave_type_name_th,
            rejectedRequest[0].start_date,
            rejectedRequest[0].end_date,
            rejectorResult[0]?.name_en || rejectorResult[0]?.name_th || 'Manager',
            rejection_reason
          );
        } catch (emailError) {
          logger.error('[EMAIL] Failed to send rejection notification:', emailError);
        }
      }

      // Send Notifications (LINE & Telegram) for rejection
      try {
        // Get rejector name for notification
        const rejectorForNotify = await query(
          `SELECT CONCAT(first_name_th, ' ', last_name_th) as name_th
           FROM employees WHERE id = $1`,
          [userId]
        );

        const rejectAttachmentCount = getAttachmentCount(rejectedRequest[0].attachment_urls);
        const notificationParams = {
          action: 'rejected' as const,
          employeeName: rejectedRequest[0].employee_name_th || rejectedRequest[0].employee_name_en,
          departmentName: rejectedRequest[0].department_name_en || rejectedRequest[0].department_name_th,
          leaveTypeName: rejectedRequest[0].leave_type_name_th || rejectedRequest[0].leave_type_name_en,
          startDate: rejectedRequest[0].start_date,
          endDate: rejectedRequest[0].end_date,
          totalDays: rejectedRequest[0].total_days,
          approverName: rejectorForNotify[0]?.name_th || 'ผู้อนุมัติ',
          rejectionReason: rejection_reason,
          // Hourly leave info
          isHourlyLeave: rejectedRequest[0].is_hourly_leave,
          leaveMinutes: rejectedRequest[0].leave_minutes,
          leaveStartTime: rejectedRequest[0].leave_start_time,
          leaveEndTime: rejectedRequest[0].leave_end_time,
          // Attachment info
          hasAttachments: rejectAttachmentCount > 0,
          attachmentCount: rejectAttachmentCount,
        };

        await sendLeaveRequestNotification(notificationParams);
        await sendTelegramLeaveNotification(notificationParams);
      } catch (notifyError) {
        logger.error('[NOTIFY] Failed to send rejection notification:', notifyError);
      }

      return successResponse({
        leave_request: rejectedRequest[0],
        message: 'Leave request rejected',
      });
    }

    // APPROVE action
    logger.log('🔵 [BACKEND] Approving request at stage:', currentStage);

    // ✅ FIX BUG #1: Get approval flow to determine total stages
    const approvalFlow = await getApprovalFlow(leaveRequest.employee_id);

    // ✅ IMPORTANT: Declare nextStage in outer scope so it's accessible later
    let nextStage: number | null = null;
    let isFinalStage = false;

    // ✅ HR BYPASS: If HR is approving and should bypass to final, set isFinalStage to true
    if (canApprove.shouldBypassToFinal) {
      logger.log('⭐ [APPROVAL] HR BYPASS DETECTED - Immediately approving request!');
      isFinalStage = true;
    } else {
      // ✅ NEW: Check for skipped stages and find next non-skipped stage
      const skippedStagesArray = leaveRequest.skipped_stages
        ? (typeof leaveRequest.skipped_stages === 'string'
          ? JSON.parse(leaveRequest.skipped_stages)
          : leaveRequest.skipped_stages)
        : [];

      logger.log('🔍 [APPROVAL] Skipped stages:', skippedStagesArray);

      // Find next non-skipped stage
      nextStage = getNextStage(currentStage, approvalFlow.totalStages);
      while (nextStage && skippedStagesArray.includes(nextStage)) {
        logger.log(`⏭️  [APPROVAL] Stage ${nextStage} is skipped, moving to next...`);
        nextStage = getNextStage(nextStage, approvalFlow.totalStages);
      }

      logger.log('📍 [APPROVAL] Next stage:', nextStage || 'FINAL (approved)');

      // Determine if this is the final stage
      isFinalStage = nextStage === null;
    }

    let updateQuery = '';
    let updateParams: any[] = [];

    if (currentStage === 1) {
      // Stage 1: Department Manager (or equivalent)
      if (isFinalStage) {
        // ⭐ HR BYPASS: Also set HR approval fields if HR is bypassing
        if (canApprove.shouldBypassToFinal) {
          logger.log('⭐ [APPROVAL] HR BYPASS at stage 1 - Setting both manager and HR approval fields');
          updateQuery = `
            UPDATE leave_requests
            SET department_manager_approved_by = $1,
                department_manager_approved_at = NOW(),
                hr_approved_by = $1,
                hr_approved_at = NOW(),
                status = 'approved',
                updated_at = NOW()
            WHERE id = $2
          `;
          updateParams = [userId, requestId];
        } else {
          // Should not happen in 2-stage flow unless flow is shortened
          updateQuery = `
            UPDATE leave_requests
            SET department_manager_approved_by = $1,
                department_manager_approved_at = NOW(),
                status = 'approved',
                updated_at = NOW()
            WHERE id = $2
          `;
          updateParams = [userId, requestId];
        }
      } else {
        // Move to Stage 2 (HR Confirmation)
        updateQuery = `
          UPDATE leave_requests
          SET department_manager_approved_by = $1,
              department_manager_approved_at = NOW(),
              current_approval_stage = $2,
              updated_at = NOW()
          WHERE id = $3
        `;
        updateParams = [userId, nextStage, requestId];
      }
    } else if (currentStage === 2) {
      // Stage 2: HR Confirmation (Always Final)
      updateQuery = `
        UPDATE leave_requests
        SET hr_approved_by = $1,
            hr_approved_at = NOW(),
            status = 'approved',
            updated_at = NOW()
        WHERE id = $2
      `;
      updateParams = [userId, requestId];
    } else if (currentStage === 3) {
      // Fallback for legacy requests or HR bypass if somehow reached
      updateQuery = `
        UPDATE leave_requests
        SET hr_approved_by = $1,
            hr_approved_at = NOW(),
            status = 'approved',
            updated_at = NOW()
        WHERE id = $2
      `;
      updateParams = [userId, requestId];
    }

    await query(updateQuery, updateParams);
    logger.log('✅ [BACKEND] Request approved successfully');

    // ===== AUDIT LOG =====
    await logApprove(
      userId,
      'leave_request',
      requestId,
      event,
      {
        approval_stage: currentStage,
        is_final_stage: isFinalStage,
        next_stage: nextStage || 'completed',
      }
    );

    // ✅ PROFESSIONAL HRM: Update leave balance if this is the FINAL stage
    if (isFinalStage) {
      const currentYear = new Date().getFullYear();

      // Enhanced hourly leave tracking
      if (leaveRequest.is_hourly_leave) {
        logger.log('⏱️ [BACKEND] Processing hourly leave approval:', {
          leave_minutes: leaveRequest.leave_minutes,
          leave_hours: leaveRequest.leave_hours,
          converted_to_days: leaveRequest.total_days,
          leave_start_time: leaveRequest.leave_start_time,
          leave_end_time: leaveRequest.leave_end_time,
        });

        // Check if this leave type supports minute tracking and update minute usage
        const leaveTypeResult = await query(
          `SELECT allow_hourly_leave FROM leave_types WHERE id = $1`,
          [leaveRequest.leave_type_id]
        );

        if (leaveTypeResult.length > 0 && leaveTypeResult[0].allow_hourly_leave) {
          logger.log('📊 [BACKEND] Updating minute-based balance for hourly leave type');

          // Note: We don't need to update minute balances separately since the
          // leave-balance API calculates remaining_minutes dynamically based on
          // approved hourly leave requests. This ensures consistency.
          logger.log('✅ [BACKEND] Hourly leave balance will be calculated dynamically in balance queries');
        }
      }

      // ✅ PROFESSIONAL HRM: Move from pending to used when approved
      // First check if balance exists
      const balanceCheck = await query(
        `SELECT id, pending_days, used_days, total_days, remaining_days
         FROM leave_balances
         WHERE employee_id = $1
           AND leave_type_id = $2
           AND year = $3`,
        [leaveRequest.employee_id, leaveRequest.leave_type_id, currentYear]
      );

      if (balanceCheck.length > 0) {
        const currentBalance = balanceCheck[0];
        logger.log('📊 [BACKEND] Current balance before update:', {
          pending_days: currentBalance.pending_days,
          used_days: currentBalance.used_days,
          total_days: currentBalance.total_days,
          remaining_days: currentBalance.remaining_days,
          days_to_approve: leaveRequest.total_days,
        });

        // ✅ Use GREATEST to prevent negative pending_days
        // Note: remaining_days is a GENERATED column, auto-calculated as: total_days - used_days - pending_days
        await query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(0, pending_days - $1),
               used_days = used_days + $1,
               updated_at = NOW()
           WHERE employee_id = $2
             AND leave_type_id = $3
             AND year = $4`,
          [
            leaveRequest.total_days,
            leaveRequest.employee_id,
            leaveRequest.leave_type_id,
            currentYear,
          ]
        );

        logger.log('✅ [BACKEND] Leave balance updated:', {
          employee_id: leaveRequest.employee_id,
          is_hourly_leave: leaveRequest.is_hourly_leave || false,
          moved_from_pending: leaveRequest.total_days,
          moved_to_used: leaveRequest.total_days,
          leave_minutes: leaveRequest.leave_minutes,
        });
      } else {
        logger.warn('⚠️ [BACKEND] No leave balance found for approval update:', {
          employee_id: leaveRequest.employee_id,
          leave_type_id: leaveRequest.leave_type_id,
          year: currentYear,
        });
      }
    }

    // Get updated request with all fields
    const updatedRequestResult = await query(
      `SELECT
        lr.*,
        e.employee_code,
        e.email,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.id = $1`,
      [requestId]
    );

    const finalStatus = isFinalStage
      ? 'approved and finalized'
      : 'approved to next stage';

    // Send approval email to employee (only on final approval)
    if (isFinalStage) {
      const emailsEnabled = await areEmailAlertsEnabled();
      if (emailsEnabled && updatedRequestResult[0]?.email) {
        try {
          // Get approver name
          const approverResult = await query(
            `SELECT CONCAT(first_name_en, ' ', last_name_en) as name_en,
                    CONCAT(first_name_th, ' ', last_name_th) as name_th
             FROM employees WHERE id = $1`,
            [userId]
          );

          await sendLeaveRequestApproved(
            updatedRequestResult[0].employee_name_en || updatedRequestResult[0].employee_name_th,
            updatedRequestResult[0].email,
            updatedRequestResult[0].leave_type_name_en || updatedRequestResult[0].leave_type_name_th,
            updatedRequestResult[0].start_date,
            updatedRequestResult[0].end_date,
            updatedRequestResult[0].total_days,
            approverResult[0]?.name_en || approverResult[0]?.name_th || 'HR'
          );
        } catch (emailError) {
          logger.error('[EMAIL] Failed to send approval notification:', emailError);
        }
      }
    }

    logger.log('✅ [BACKEND] Returning approved request');

    // Send Notifications (LINE & Telegram) for approval (only on final stage)
    if (isFinalStage) {
      try {
        // Get approver name for notification
        const approverForNotify = await query(
          `SELECT CONCAT(first_name_th, ' ', last_name_th) as name_th
           FROM employees WHERE id = $1`,
          [userId]
        );

        const approveAttachmentCount = getAttachmentCount(updatedRequestResult[0].attachment_urls);
        const notificationParams = {
          action: 'approved' as const,
          employeeName: updatedRequestResult[0].employee_name_th || updatedRequestResult[0].employee_name_en,
          departmentName: updatedRequestResult[0].department_name_en || updatedRequestResult[0].department_name_th,
          leaveTypeName: updatedRequestResult[0].leave_type_name_th || updatedRequestResult[0].leave_type_name_en,
          startDate: updatedRequestResult[0].start_date,
          endDate: updatedRequestResult[0].end_date,
          totalDays: updatedRequestResult[0].total_days,
          approverName: approverForNotify[0]?.name_th || 'ผู้อนุมัติ',
          // Hourly leave info
          isHourlyLeave: updatedRequestResult[0].is_hourly_leave,
          leaveMinutes: updatedRequestResult[0].leave_minutes,
          leaveStartTime: updatedRequestResult[0].leave_start_time,
          leaveEndTime: updatedRequestResult[0].leave_end_time,
          // Attachment info
          hasAttachments: approveAttachmentCount > 0,
          attachmentCount: approveAttachmentCount,
        };

        await sendLeaveRequestNotification(notificationParams);
        await sendTelegramLeaveNotification(notificationParams);
      } catch (notifyError) {
        logger.error('[NOTIFY] Failed to send approval notification:', notifyError);
      }
    }

    return successResponse({
      leave_request: updatedRequestResult[0],
      message: `Leave request ${finalStatus}`,
    });
  } catch (error: any) {
    logger.error('❌ [BACKEND] Update leave request error:', {
      message: error.message,
      stack: error.stack,
    });
    return errorResponse(error.message || 'Failed to update leave request', 500);
  }
};

export const handler: Handler = requireAuth(updateLeaveRequest);
