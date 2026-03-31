import { logger } from './logger';
import { isTelegramNotificationEnabled as checkTelegramSettingEnabled } from './notification-settings-helper';
import { getTelegramConfig } from './channel-config-helper';

/**
 * Telegram Notification Utility
 * 
 * Sends notifications to Telegram chat via Bot API
 * Configuration is read from DB first, falls back to environment variables
 */

/**
 * Check if Telegram notifications are configured
 */
export async function isTelegramNotificationEnabled(): Promise<boolean> {
    const config = await getTelegramConfig();
    return !!(config.botToken && config.chatId);
}

/**
 * Send a text message to Telegram chat
 */
export async function sendTelegramTextMessage(message: string): Promise<boolean> {
    const config = await getTelegramConfig();

    if (!config.botToken || !config.chatId) {
        logger.warn('⚠️ Telegram notification skipped - not configured');
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: config.chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });

        const data = await response.json() as any;

        if (!data.ok) {
            logger.error(`Telegram API Error: ${data.description}`);
            return false;
        }

        logger.log('✅ Telegram notification sent successfully');
        return true;
    } catch (error: any) {
        logger.error('❌ Telegram notification failed:', error.message);
        return false;
    }
}

/**
 * Send leave request notification to Telegram chat
 */
export async function sendTelegramLeaveNotification(params: {
    action: 'created' | 'approved' | 'rejected' | 'canceled' | 'voided';
    employeeName: string;
    departmentName?: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string;
    approverName?: string;
    rejectionReason?: string;
    // New parameters for hourly leave and attachments
    isHourlyLeave?: boolean;
    leaveMinutes?: number;
    leaveStartTime?: string;
    leaveEndTime?: string;
    hasAttachments?: boolean;
    attachmentCount?: number;
}): Promise<boolean> {
    // Map action to event type for settings check
    const actionToEvent: Record<string, 'leave_created' | 'leave_approved' | 'leave_rejected' | 'leave_canceled' | 'leave_voided'> = {
        created: 'leave_created',
        approved: 'leave_approved',
        rejected: 'leave_rejected',
        canceled: 'leave_canceled',
        voided: 'leave_voided',
    };

    // Check if this notification type is enabled in settings
    const eventType = actionToEvent[params.action];
    const isEnabled = await checkTelegramSettingEnabled(eventType);

    if (!isEnabled) {
        logger.log(`📵 Telegram notification for ${params.action} is disabled in settings`);
        return false;
    }

    // Check if Telegram is configured
    const config = await getTelegramConfig();
    if (!config.botToken || !config.chatId) {
        logger.warn('⚠️ Telegram notification skipped - not configured');
        return false;
    }

    try {
        // Format dates
        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        };

        const startDateFormatted = formatDate(params.startDate);
        const endDateFormatted = formatDate(params.endDate);
        const dateRange = params.startDate === params.endDate
            ? startDateFormatted
            : `${startDateFormatted} - ${endDateFormatted}`;

        // Determine emoji and title based on action
        let emoji = '';
        let title = '';

        switch (params.action) {
            case 'created':
                emoji = '📝';
                title = 'คำขอลาใหม่';
                break;
            case 'approved':
                emoji = '✅';
                title = 'อนุมัติการลา';
                break;
            case 'rejected':
                emoji = '❌';
                title = 'ไม่อนุมัติการลา';
                break;
            case 'canceled':
                emoji = '🚫';
                title = 'ยกเลิกคำขอลา';
                break;
            case 'voided':
                emoji = '⚠️';
                title = 'ยกเลิกใบลา (Void)';
                break;
        }

        // Helper to escape HTML characters for Telegram
        const escapeHtml = (text: string | undefined | null): string => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        // Construct HTML Message
        let message = `<b>${emoji} ${title}</b>\n\n`;
        message += `👤 <b>พนักงาน:</b> ${escapeHtml(params.employeeName)}\n`;
        message += `🏢 <b>แผนก:</b> ${escapeHtml(params.departmentName || '-')}\n`;
        message += `📋 <b>ประเภท:</b> ${escapeHtml(params.leaveTypeName)}\n`;
        message += `📅 <b>วันที่:</b> ${dateRange}\n`;

        // Display hours for hourly leave, days for regular leave
        const durationText = params.isHourlyLeave && params.leaveMinutes
            ? `${(params.leaveMinutes / 60).toFixed(1)} ชม.`
            : params.totalDays === 0.5
                ? 'ครึ่งวัน'
                : `${params.totalDays} วัน`;
        message += `⏱️ <b>จำนวน:</b> ${durationText}\n`;

        // Add time range for hourly leave
        if (params.isHourlyLeave && params.leaveStartTime && params.leaveEndTime) {
            const formatTime = (time: string) => time ? time.substring(0, 5) : '';
            message += `🕐 <b>ช่วงเวลา:</b> ${formatTime(params.leaveStartTime)} - ${formatTime(params.leaveEndTime)}\n`;
        }

        // Add attachment indicator
        if (params.hasAttachments) {
            const attachText = params.attachmentCount ? `${params.attachmentCount} ไฟล์` : 'มี';
            message += `📎 <b>ไฟล์แนบ:</b> ${attachText}\n`;
        }

        // Add reason if provided
        if (params.reason && params.action === 'created') {
            message += `\n💬 <b>เหตุผล:</b> ${escapeHtml(params.reason)}\n`;
        }

        // Add approver name
        if (params.approverName && (params.action === 'approved' || params.action === 'rejected')) {
            message += `\n👔 <b>โดย:</b> ${escapeHtml(params.approverName)}\n`;
        }

        // Add rejection reason
        if (params.rejectionReason && params.action === 'rejected') {
            message += `❌ <b>เหตุผล:</b> ${escapeHtml(params.rejectionReason)}\n`;
        }

        // Send to Telegram
        await sendTelegramTextMessage(message);

        return true;
    } catch (error: any) {
        logger.error('❌ Telegram leave notification failed:', error.message);
        return false;
    }
}

/**
 * Send a simple notification for testing
 */
export async function sendTelegramTestNotification(): Promise<boolean> {
    return sendTelegramTextMessage('🔔 ทดสอบการแจ้งเตือน Telegram Bot สำเร็จ!');
}
