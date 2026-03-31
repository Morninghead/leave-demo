import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { sendTelegramTextMessage } from './utils/telegram-notify';
import { logger } from './utils/logger';

/**
 * Resend Telegram notification for specific leave requests
 * POST /api/leave-request-resend-notification
 * Body: { request_ids: string[], custom_note?: string }
 */
const resendNotification = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const userId = event.user?.userId;
        const userRole = event.user?.role;

        // Only HR and Admin can resend notifications
        if (!userRole || !['hr', 'admin'].includes(userRole.toLowerCase())) {
            return errorResponse('Only HR and Admin can resend notifications', 403);
        }

        const { request_ids, custom_note } = JSON.parse(event.body || '{}');

        if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
            return errorResponse('request_ids array is required', 400);
        }

        // Get leave request details
        const placeholders = request_ids.map((_, i) => `$${i + 1}`).join(', ');
        const leaveRequests = await query(
            `SELECT 
        lr.id,
        lr.request_number,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status,
        lr.is_hourly_leave,
        lr.leave_minutes,
        lr.leave_start_time,
        lr.leave_end_time,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name,
        d.name_th as department_name,
        lt.name_th as leave_type_name
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id IN (${placeholders})`,
            request_ids
        );

        if (leaveRequests.length === 0) {
            return errorResponse('No leave requests found', 404);
        }

        // Format dates helper
        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        };

        // Escape HTML helper
        const escapeHtml = (text: string | undefined | null): string => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        // Build Telegram message
        let message = `<b>🔔 แจ้งเตือนคำขอลา (Resend)</b>\n\n`;

        // Add custom note if provided
        if (custom_note) {
            message += `<b>📌 หมายเหตุ:</b> ${escapeHtml(custom_note)}\n\n`;
        }

        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (const req of leaveRequests) {
            const dateRange = req.start_date === req.end_date
                ? formatDate(req.start_date)
                : `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;

            const durationText = req.is_hourly_leave && req.leave_minutes
                ? `${(req.leave_minutes / 60).toFixed(1)} ชม.`
                : req.total_days === 0.5
                    ? 'ครึ่งวัน'
                    : `${req.total_days} วัน`;

            message += `<b>👤 ${escapeHtml(req.employee_name)}</b>\n`;
            message += `🏢 แผนก: ${escapeHtml(req.department_name)}\n`;
            message += `📋 ประเภท: ${escapeHtml(req.leave_type_name)}\n`;
            message += `📅 วันที่: ${dateRange}\n`;
            message += `⏱️ จำนวน: ${durationText}\n`;
            message += `📝 สถานะ: ${req.status === 'pending' ? 'รออนุมัติ' : req.status}\n`;

            if (req.reason) {
                message += `💬 เหตุผล: ${escapeHtml(req.reason)}\n`;
            }

            message += `\n`;
        }

        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📊 รวม ${leaveRequests.length} คำขอ`;

        // Send to Telegram
        const success = await sendTelegramTextMessage(message);

        if (success) {
            logger.log(`✅ Resent Telegram notification for ${leaveRequests.length} requests`);
            return successResponse({
                message: `Successfully sent notification for ${leaveRequests.length} request(s)`,
                sent_count: leaveRequests.length,
            });
        } else {
            return errorResponse('Failed to send Telegram notification', 500);
        }

    } catch (error: any) {
        logger.error('Error resending notification:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
};

export const handler: Handler = requireAuth(resendNotification);
