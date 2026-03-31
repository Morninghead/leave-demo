/**
 * Leave Request Cancellation Review API
 * 
 * HR endpoint to approve or reject employee cancellation requests.
 * 
 * - Approve: Status → 'canceled', restore used_days to balance
 * - Reject: Status → 'approved' (revert), record rejection reason
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { logUpdate } from './utils/audit-logger';
import { sendLeaveRequestNotification } from './utils/line-notify';
import { sendTelegramLeaveNotification } from './utils/telegram-notify';

const reviewCancellation = async (event: AuthenticatedEvent) => {
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

    // Only HR and Admin can review cancellation requests
    const normalizedRole = (userRole || '').toLowerCase();
    if (!['hr', 'admin'].includes(normalizedRole)) {
        return errorResponse('Only HR and Admin can review cancellation requests', 403);
    }

    try {
        logger.log('=== [BACKEND] CANCELLATION REVIEW ===');
        logger.log('Reviewer:', userId, 'Role:', userRole);

        if (!event.body) {
            return errorResponse('Request body is required', 400);
        }

        const body = JSON.parse(event.body);
        const { request_id, action, rejection_reason } = body;

        if (!request_id) {
            return errorResponse('request_id is required', 400);
        }

        if (!action || !['approve', 'reject'].includes(action)) {
            return errorResponse('action must be "approve" or "reject"', 400);
        }

        if (action === 'reject' && (!rejection_reason || rejection_reason.trim().length < 5)) {
            return errorResponse(
                'rejection_reason is required when rejecting (minimum 5 characters)',
                400
            );
        }

        // Fetch the leave request
        const leaveRequestResult = await query(
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
             JOIN employees e ON lr.employee_id = e.id
             LEFT JOIN departments d ON e.department_id = d.id
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
            status: leaveRequest.status,
            cancellation_reason: leaveRequest.cancellation_reason,
        });

        // Must be in cancellation_pending status
        if (leaveRequest.status !== 'cancellation_pending') {
            return errorResponse(
                `Cannot review cancellation for status: ${leaveRequest.status}. Must be 'cancellation_pending'.`,
                400
            );
        }

        // Get HR reviewer name for notifications
        const reviewerResult = await query(
            `SELECT 
                CONCAT(first_name_th, ' ', last_name_th) as name_th,
                CONCAT(first_name_en, ' ', last_name_en) as name_en
             FROM employees WHERE id = $1`,
            [userId]
        );
        const reviewerName = reviewerResult[0]?.name_th || reviewerResult[0]?.name_en || 'HR';

        // =============================================
        // APPROVE Cancellation
        // =============================================
        if (action === 'approve') {
            logger.log('✅ Approving cancellation request');

            // Determine the year of the leave request for balance update
            const requestYear = new Date(leaveRequest.start_date).getFullYear();

            // Update status to canceled
            await query(
                `UPDATE leave_requests
                 SET status = 'canceled',
                     cancellation_approved_at = NOW(),
                     cancellation_approved_by = $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [userId, request_id]
            );

            // Restore used_days to balance
            const balanceCheck = await query(
                `SELECT id, used_days, total_days, remaining_days
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
                    days_to_restore: leaveRequest.total_days,
                });

                await query(
                    `UPDATE leave_balances
                     SET used_days = GREATEST(0, used_days - $1),
                         updated_at = NOW()
                     WHERE employee_id = $2
                       AND leave_type_id = $3
                       AND year = $4`,
                    [leaveRequest.total_days, leaveRequest.employee_id, leaveRequest.leave_type_id, requestYear]
                );

                logger.log(`✅ Restored ${leaveRequest.total_days} days to balance`);
            } else {
                logger.warn('⚠️ No balance found to restore');
            }

            // Audit log
            await logUpdate(
                userId,
                'leave_request',
                request_id,
                { status: 'cancellation_pending' },
                { status: 'canceled' },
                event,
                {
                    action: 'approve_cancellation',
                    days_restored: leaveRequest.total_days,
                    approved_by: reviewerName,
                }
            ).catch(err => logger.warn('Audit log failed:', err?.message));

            // Notify employee
            try {
                const notificationParams = {
                    action: 'cancellation_approved' as const,
                    employeeName: leaveRequest.employee_name_th || leaveRequest.employee_name_en,
                    departmentName: leaveRequest.department_name_th || leaveRequest.department_name_en,
                    leaveTypeName: leaveRequest.leave_type_name_th || leaveRequest.leave_type_name_en,
                    startDate: leaveRequest.start_date,
                    endDate: leaveRequest.end_date,
                    totalDays: leaveRequest.total_days,
                    approverName: reviewerName,
                };

                await sendLeaveRequestNotification(notificationParams as any);
                await sendTelegramLeaveNotification(notificationParams as any);
            } catch (notifyError) {
                logger.error('[NOTIFY] Failed to send approval notification:', notifyError);
            }

            return successResponse({
                success: true,
                message: 'Cancellation approved. Leave balance restored.',
                message_th: 'อนุมัติการยกเลิกแล้ว คืนวันลาเรียบร้อย',
                status: 'canceled',
                days_restored: leaveRequest.total_days,
            });
        }

        // =============================================
        // REJECT Cancellation
        // =============================================
        logger.log('❌ Rejecting cancellation request');
        logger.log('Rejection reason:', rejection_reason);

        // Revert status back to approved
        await query(
            `UPDATE leave_requests
             SET status = 'approved',
                 cancellation_rejected_at = NOW(),
                 cancellation_rejected_by = $1,
                 cancellation_rejection_reason = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [userId, rejection_reason, request_id]
        );

        logger.log('✅ Cancellation rejected, status reverted to approved');

        // Audit log
        await logUpdate(
            userId,
            'leave_request',
            request_id,
            { status: 'cancellation_pending' },
            { status: 'approved', cancellation_rejection_reason: rejection_reason },
            event,
            {
                action: 'reject_cancellation',
                rejection_reason,
                rejected_by: reviewerName,
            }
        ).catch(err => logger.warn('Audit log failed:', err?.message));

        // Notify employee
        try {
            const notificationParams = {
                action: 'cancellation_rejected' as const,
                employeeName: leaveRequest.employee_name_th || leaveRequest.employee_name_en,
                departmentName: leaveRequest.department_name_th || leaveRequest.department_name_en,
                leaveTypeName: leaveRequest.leave_type_name_th || leaveRequest.leave_type_name_en,
                startDate: leaveRequest.start_date,
                endDate: leaveRequest.end_date,
                totalDays: leaveRequest.total_days,
                rejectionReason: rejection_reason,
                approverName: reviewerName,
            };

            await sendLeaveRequestNotification(notificationParams as any);
            await sendTelegramLeaveNotification(notificationParams as any);
        } catch (notifyError) {
            logger.error('[NOTIFY] Failed to send rejection notification:', notifyError);
        }

        return successResponse({
            success: true,
            message: 'Cancellation rejected. Leave remains approved.',
            message_th: 'ไม่อนุมัติการยกเลิก การลายังคงมีผล',
            status: 'approved',
            rejection_reason,
        });

    } catch (error: any) {
        logger.error('❌ [BACKEND] Cancellation review error:', error);
        return errorResponse(error.message || 'Failed to process cancellation review', 500);
    }
};

export const handler: Handler = requireAuth(reviewCancellation);
