import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { logUpdate } from './utils/audit-logger';
import { deleteLeaveAttachments } from './utils/storage-cleanup';
import { sendLeaveRequestNotification } from './utils/line-notify';
import { sendTelegramLeaveNotification } from './utils/telegram-notify';
import { getAttachmentCount } from './utils/attachment-helper';

/**
 * Void Approved Leave Request API
 * 
 * This endpoint allows HR/Admin to void an approved leave request.
 * When voided:
 * 1. The leave request status is changed to 'voided'
 * 2. The used_days are returned to the employee's leave balance
 * 3. An audit log is created
 * 
 * Use case: Employee didn't actually take the leave they requested
 */

const voidLeaveRequest = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    const userId = event.user?.userId;
    const userRole = event.user?.role;

    if (!userId) {
        return errorResponse('User not authenticated', 401);
    }

    // Only HR and Admin can void approved requests (case-insensitive)
    const normalizedRole = (userRole || '').toLowerCase();
    if (!['hr', 'admin'].includes(normalizedRole)) {
        return errorResponse('Only HR and Admin can void approved leave requests', 403);
    }

    try {
        logger.log('=== [BACKEND] VOID LEAVE REQUEST ===');
        logger.log('User ID:', userId, 'Role:', userRole, 'Normalized:', normalizedRole);

        if (!event.body) {
            return errorResponse('Request body is required', 400);
        }

        const body = JSON.parse(event.body);
        const { request_id, void_reason } = body;

        if (!request_id) {
            return errorResponse('request_id is required', 400);
        }

        if (!void_reason || void_reason.trim().length < 5) {
            return errorResponse('void_reason is required (minimum 5 characters)', 400);
        }

        logger.log('Voiding request:', request_id);
        logger.log('Reason:', void_reason);
        logger.log('By user:', userId, 'Role:', userRole);

        // Fetch the leave request
        const leaveRequestResult = await query(
            `SELECT 
        lr.*,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.id = $1`,
            [request_id]
        );

        if (leaveRequestResult.length === 0) {
            return errorResponse('Leave request not found', 404);
        }

        const leaveRequest = leaveRequestResult[0];

        logger.log('Leave request found:', {
            id: leaveRequest.id,
            employee_code: leaveRequest.employee_code,
            status: leaveRequest.status,
            total_days: leaveRequest.total_days,
            leave_type: leaveRequest.leave_type_code,
        });

        // Only approved requests can be voided
        if (leaveRequest.status !== 'approved') {
            return errorResponse(
                `Only approved requests can be voided. Current status: ${leaveRequest.status}`,
                400
            );
        }

        // Determine the year of the leave request
        const requestYear = new Date(leaveRequest.start_date).getFullYear();

        // Begin transaction-like operations
        logger.log('📊 Restoring leave balance...');

        // 1. Check current balance
        const balanceCheck = await query(
            `SELECT id, used_days, pending_days, total_days, remaining_days
       FROM leave_balances
       WHERE employee_id = $1
         AND leave_type_id = $2
         AND year = $3`,
            [leaveRequest.employee_id, leaveRequest.leave_type_id, requestYear]
        );

        if (balanceCheck.length > 0) {
            const currentBalance = balanceCheck[0];

            logger.log('Current balance before restoration:', {
                used_days: currentBalance.used_days,
                total_days: currentBalance.total_days,
                remaining_days: currentBalance.remaining_days,
                days_to_restore: leaveRequest.total_days,
            });

            // 2. Restore the balance (subtract from used_days)
            // remaining_days is a GENERATED column and will auto-update
            await query(
                `UPDATE leave_balances
         SET used_days = GREATEST(0, used_days - $1),
             updated_at = NOW()
         WHERE employee_id = $2
           AND leave_type_id = $3
           AND year = $4`,
                [
                    leaveRequest.total_days,
                    leaveRequest.employee_id,
                    leaveRequest.leave_type_id,
                    requestYear,
                ]
            );

            // Verify the update
            const updatedBalance = await query(
                `SELECT id, used_days, total_days, remaining_days
         FROM leave_balances
         WHERE employee_id = $1
           AND leave_type_id = $2
           AND year = $3`,
                [leaveRequest.employee_id, leaveRequest.leave_type_id, requestYear]
            );

            if (updatedBalance.length > 0) {
                logger.log('✅ Balance restored:', {
                    new_used_days: updatedBalance[0].used_days,
                    new_remaining_days: updatedBalance[0].remaining_days,
                    restored: leaveRequest.total_days,
                });
            }
        } else {
            logger.warn('⚠️ No leave balance found to restore for:', {
                employee_id: leaveRequest.employee_id,
                leave_type_id: leaveRequest.leave_type_id,
                year: requestYear,
            });
        }

        // 3. Update the leave request status to 'voided'
        await query(
            `UPDATE leave_requests
       SET status = 'voided',
           void_reason = $1,
           voided_by = $2,
           voided_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
            [void_reason, userId, request_id]
        );

        logger.log('✅ Leave request voided successfully');

        // 4. Audit log (non-blocking - don't let it break the main operation)
        try {
            logUpdate(
                userId,
                'leave_request',
                request_id,
                { status: 'approved' },
                { status: 'voided', void_reason },
                event,
                {
                    action: 'void',
                    void_reason,
                    days_restored: leaveRequest.total_days,
                    employee_id: leaveRequest.employee_id,
                    leave_type: leaveRequest.leave_type_code,
                    original_status: 'approved',
                    new_status: 'voided',
                }
            ).catch((err: any) => logger.warn('Audit log failed:', err?.message));
        } catch (auditError: any) {
            logger.warn('Audit log error (non-fatal):', auditError?.message);
        }

        // 5. Delete attachments from storage (non-blocking) - DISABLED TO PRESERVE HISTORY
        // if (leaveRequest.attachment_urls && leaveRequest.attachment_urls.length > 0) {
        //     try {
        //         const cleanupResult = await deleteLeaveAttachments(leaveRequest.attachment_urls);
        //         logger.log('🗑️ Attachment cleanup result:', cleanupResult);
        //     } catch (cleanupErr: any) {
        //         logger.warn('⚠️ Attachment cleanup failed (non-critical):', cleanupErr.message);
        //     }
        // }

        // 6. Fetch updated request
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
            [request_id]
        );

        // Send Notifications (LINE & Telegram) for void
        try {
            const voidAttachmentCount = getAttachmentCount(updatedRequest[0].attachment_urls);
            const notificationParams = {
                action: 'voided' as const,
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
                hasAttachments: voidAttachmentCount > 0,
                attachmentCount: voidAttachmentCount,
            };

            await sendLeaveRequestNotification(notificationParams);
            await sendTelegramLeaveNotification(notificationParams);
        } catch (notifyError) {
            logger.error('[NOTIFY] Failed to send void notification:', notifyError);
        }

        return successResponse({
            success: true,
            leave_request: updatedRequest[0],
            balance_restored: leaveRequest.total_days,
            message: `Leave request voided successfully. ${leaveRequest.total_days} day(s) restored to balance.`,
        });

    } catch (error: any) {
        logger.error('❌ [BACKEND] Void leave request error:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
        });
        // Return detailed error for debugging
        return errorResponse(
            `Void failed: ${error.message}${error.code ? ` (Code: ${error.code})` : ''}`,
            500
        );
    }
};

export const handler: Handler = requireAuth(voidLeaveRequest);
