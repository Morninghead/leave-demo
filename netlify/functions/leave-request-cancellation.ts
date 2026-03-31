/**
 * Leave Request Cancellation API
 * 
 * Allows employees to REQUEST cancellation of their approved leave.
 * - For PENDING requests: Cancel immediately (existing behavior)
 * - For APPROVED requests: Create cancellation request → HR must approve
 * 
 * Requirements:
 * - Must be 24+ hours before start_date (Thailand timezone GMT+7)
 * - Reason is mandatory
 * - HR will be notified
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { logUpdate } from './utils/audit-logger';
import { sendLeaveRequestNotification } from './utils/line-notify';
import { sendTelegramLeaveNotification } from './utils/telegram-notify';

// Thailand timezone offset (UTC+7)
const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

const requestCancellation = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    const userId = event.user?.userId;
    if (!userId) {
        return errorResponse('User not authenticated', 401);
    }

    try {
        logger.log('=== [BACKEND] LEAVE CANCELLATION REQUEST ===');

        if (!event.body) {
            return errorResponse('Request body is required', 400);
        }

        const body = JSON.parse(event.body);
        const { request_id, cancellation_reason } = body;

        if (!request_id) {
            return errorResponse('request_id is required', 400);
        }

        if (!cancellation_reason || cancellation_reason.trim().length < 5) {
            return errorResponse(
                'cancellation_reason is required (minimum 5 characters)',
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
            employee_id: leaveRequest.employee_id,
            status: leaveRequest.status,
            start_date: leaveRequest.start_date,
        });

        // Check ownership
        if (leaveRequest.employee_id !== userId) {
            return errorResponse('You can only cancel your own leave requests', 403);
        }

        // Check if cancellable status
        const cancellableStatuses = ['pending', 'approved'];
        if (!cancellableStatuses.includes(leaveRequest.status)) {
            return errorResponse(
                `Cannot request cancellation for status: ${leaveRequest.status}`,
                400
            );
        }

        // =============================================
        // PENDING requests: Cancel immediately (existing behavior)
        // =============================================
        if (leaveRequest.status === 'pending') {
            logger.log('📋 Canceling PENDING request immediately');

            const currentYear = new Date().getFullYear();

            // Update status to canceled
            await query(
                `UPDATE leave_requests
                 SET status = 'canceled',
                     canceled_by = $1,
                     canceled_at = NOW(),
                     cancellation_reason = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [userId, cancellation_reason, request_id]
            );

            // Release pending balance
            await query(
                `UPDATE leave_balances
                 SET pending_days = GREATEST(0, pending_days - $1),
                     updated_at = NOW()
                 WHERE employee_id = $2
                   AND leave_type_id = $3
                   AND year = $4`,
                [leaveRequest.total_days, leaveRequest.employee_id, leaveRequest.leave_type_id, currentYear]
            );

            logger.log(`✅ Pending request canceled, ${leaveRequest.total_days} days released`);

            // Audit log
            await logUpdate(
                userId,
                'leave_request',
                request_id,
                { status: 'pending' },
                { status: 'canceled', cancellation_reason },
                event,
                { action: 'cancel_pending', reason: cancellation_reason }
            ).catch(err => logger.warn('Audit log failed:', err?.message));

            return successResponse({
                success: true,
                message: 'Leave request canceled successfully',
                status: 'canceled',
                requires_hr_approval: false,
            });
        }

        // =============================================
        // APPROVED requests: Check 24hr constraint + Create cancellation request
        // =============================================
        logger.log('📋 Processing cancellation request for APPROVED leave');

        // Calculate Thailand time
        const thaiNow = new Date(Date.now() + THAILAND_OFFSET_MS);
        const startDate = new Date(leaveRequest.start_date);
        startDate.setHours(0, 0, 0, 0);

        const hoursUntilStart = (startDate.getTime() - thaiNow.getTime()) / (1000 * 60 * 60);

        logger.log('Time check:', {
            thai_now: thaiNow.toISOString(),
            start_date: startDate.toISOString(),
            hours_until_start: hoursUntilStart,
        });

        if (hoursUntilStart < 24) {
            return errorResponse(
                'ไม่สามารถขอยกเลิกได้ ต้องขอล่วงหน้าอย่างน้อย 24 ชั่วโมงก่อนวันลา / Cannot request cancellation less than 24 hours before leave starts',
                400
            );
        }

        // Update status to cancellation_pending
        await query(
            `UPDATE leave_requests
             SET status = 'cancellation_pending',
                 cancellation_requested_at = NOW(),
                 cancellation_requested_by = $1,
                 cancellation_reason = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [userId, cancellation_reason, request_id]
        );

        logger.log('✅ Cancellation request created, waiting for HR approval');

        // Audit log
        await logUpdate(
            userId,
            'leave_request',
            request_id,
            { status: 'approved' },
            { status: 'cancellation_pending', cancellation_reason },
            event,
            { action: 'request_cancellation', reason: cancellation_reason }
        ).catch(err => logger.warn('Audit log failed:', err?.message));

        // Send notification to HR
        try {
            const notificationParams = {
                action: 'cancellation_requested' as const,
                employeeName: leaveRequest.employee_name_th || leaveRequest.employee_name_en,
                departmentName: leaveRequest.department_name_th || leaveRequest.department_name_en,
                leaveTypeName: leaveRequest.leave_type_name_th || leaveRequest.leave_type_name_en,
                startDate: leaveRequest.start_date,
                endDate: leaveRequest.end_date,
                totalDays: leaveRequest.total_days,
                cancellationReason: cancellation_reason,
            };

            // These will need to be updated to handle the new action type
            await sendLeaveRequestNotification(notificationParams as any);
            await sendTelegramLeaveNotification(notificationParams as any);
        } catch (notifyError) {
            logger.error('[NOTIFY] Failed to send cancellation request notification:', notifyError);
        }

        return successResponse({
            success: true,
            message: 'Cancellation request submitted. Waiting for HR approval.',
            message_th: 'ส่งคำขอยกเลิกแล้ว รอ HR อนุมัติ',
            status: 'cancellation_pending',
            requires_hr_approval: true,
        });

    } catch (error: any) {
        logger.error('❌ [BACKEND] Cancellation request error:', error);
        return errorResponse(error.message || 'Failed to process cancellation request', 500);
    }
};

export const handler: Handler = requireAuth(requestCancellation);
