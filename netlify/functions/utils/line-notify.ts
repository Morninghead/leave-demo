import { Client, TextMessage, FlexMessage, FlexBubble } from '@line/bot-sdk';
import { logger } from './logger';
import { isLineNotificationEnabled as checkLineSettingEnabled } from './notification-settings-helper';
import { getLineConfig } from './channel-config-helper';

/**
 * LINE Notification Utility
 * 
 * Sends notifications to LINE group via LINE Bot SDK
 * Configuration is read from DB first, falls back to environment variables
 */

// Cache LINE client instance
let lineClientInstance: Client | null = null;
let cachedToken: string = '';

/**
 * Get or create LINE client with current config
 */
async function getLineClient(): Promise<Client | null> {
    const config = await getLineConfig();

    if (!config.channelAccessToken) {
        logger.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN not configured');
        return null;
    }

    // Recreate client if token changed
    if (lineClientInstance && cachedToken === config.channelAccessToken) {
        return lineClientInstance;
    }

    lineClientInstance = new Client({ channelAccessToken: config.channelAccessToken });
    cachedToken = config.channelAccessToken;
    return lineClientInstance;
}

/**
 * Check if LINE notifications are configured
 */
export async function isLineNotificationEnabled(): Promise<boolean> {
    const config = await getLineConfig();
    return !!(config.channelAccessToken && config.groupId);
}

/**
 * Send a text message to LINE group
 */
export async function sendLineTextMessage(message: string): Promise<boolean> {
    const config = await getLineConfig();
    const client = await getLineClient();

    if (!client || !config.groupId) {
        logger.warn('⚠️ LINE notification skipped - not configured');
        return false;
    }

    try {
        const textMessage: TextMessage = {
            type: 'text',
            text: message,
        };

        await client.pushMessage(config.groupId, textMessage);
        logger.log('✅ LINE notification sent successfully');
        return true;
    } catch (error: any) {
        logger.error('❌ LINE notification failed:', error.message);
        return false;
    }
}

/**
 * Send leave request notification to LINE group
 */
export async function sendLeaveRequestNotification(params: {
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
    const isEnabled = await checkLineSettingEnabled(eventType);

    if (!isEnabled) {
        logger.log(`📵 LINE notification for ${params.action} is disabled in settings`);
        return false;
    }

    // Get config and client
    const config = await getLineConfig();
    const client = await getLineClient();

    if (!client || !config.groupId) {
        logger.warn('⚠️ LINE notification skipped - not configured');
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
        let headerColor = '#1DB446'; // Green default

        switch (params.action) {
            case 'created':
                emoji = '📝';
                title = 'คำขอลาใหม่';
                headerColor = '#3B82F6'; // Blue
                break;
            case 'approved':
                emoji = '✅';
                title = 'อนุมัติการลา';
                headerColor = '#22C55E'; // Green
                break;
            case 'rejected':
                emoji = '❌';
                title = 'ไม่อนุมัติการลา';
                headerColor = '#EF4444'; // Red
                break;
            case 'canceled':
                emoji = '🚫';
                title = 'ยกเลิกคำขอลา';
                headerColor = '#6B7280'; // Gray
                break;
            case 'voided':
                emoji = '⚠️';
                title = 'ยกเลิกใบลา (Void)';
                headerColor = '#F97316'; // Orange
                break;
        }

        // Build Flex Message
        const bubble: FlexBubble = {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: headerColor,
                paddingAll: 'md',
                contents: [
                    {
                        type: 'text',
                        text: `${emoji} ${title}`,
                        color: '#FFFFFF',
                        weight: 'bold',
                        size: 'lg',
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: '👤 พนักงาน',
                                color: '#666666',
                                size: 'sm',
                                flex: 0,
                            },
                            {
                                type: 'text',
                                text: params.employeeName,
                                color: '#333333',
                                size: 'sm',
                                weight: 'bold',
                                align: 'end',
                                flex: 1,
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: '🏢 แผนก',
                                color: '#666666',
                                size: 'sm',
                                flex: 0,
                            },
                            {
                                type: 'text',
                                text: params.departmentName || '-',
                                color: '#333333',
                                size: 'sm',
                                align: 'end',
                                flex: 1,
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: '📋 ประเภท',
                                color: '#666666',
                                size: 'sm',
                                flex: 0,
                            },
                            {
                                type: 'text',
                                text: params.leaveTypeName,
                                color: '#333333',
                                size: 'sm',
                                align: 'end',
                                flex: 1,
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: '📅 วันที่',
                                color: '#666666',
                                size: 'sm',
                                flex: 0,
                            },
                            {
                                type: 'text',
                                text: dateRange,
                                color: '#333333',
                                size: 'sm',
                                align: 'end',
                                flex: 1,
                                wrap: true,
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: '⏱️ จำนวน',
                                color: '#666666',
                                size: 'sm',
                                flex: 0,
                            },
                            {
                                type: 'text',
                                // Display hours for hourly leave, days for regular leave
                                text: params.isHourlyLeave && params.leaveMinutes
                                    ? `${(params.leaveMinutes / 60).toFixed(1)} ชม.`
                                    : params.totalDays === 0.5
                                        ? 'ครึ่งวัน'
                                        : `${params.totalDays} วัน`,
                                color: '#333333',
                                size: 'sm',
                                weight: 'bold',
                                align: 'end',
                                flex: 1,
                            },
                        ],
                    },
                ],
            },
        };

        // Add time range for hourly leave
        if (params.isHourlyLeave && params.leaveStartTime && params.leaveEndTime) {
            // Format time to HH:MM
            const formatTime = (time: string) => {
                if (!time) return '';
                // Handle both HH:MM:SS and HH:MM formats
                return time.substring(0, 5);
            };

            bubble.body!.contents.push({
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: '🕐 ช่วงเวลา',
                        color: '#666666',
                        size: 'sm',
                        flex: 0,
                    },
                    {
                        type: 'text',
                        text: `${formatTime(params.leaveStartTime)} - ${formatTime(params.leaveEndTime)}`,
                        color: '#3B82F6',
                        size: 'sm',
                        weight: 'bold',
                        align: 'end',
                        flex: 1,
                    },
                ],
            } as any);
        }

        // Add attachment indicator
        if (params.hasAttachments) {
            bubble.body!.contents.push({
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: '📎 ไฟล์แนบ',
                        color: '#666666',
                        size: 'sm',
                        flex: 0,
                    },
                    {
                        type: 'text',
                        text: params.attachmentCount
                            ? `${params.attachmentCount} ไฟล์`
                            : 'มี',
                        color: '#10B981',
                        size: 'sm',
                        weight: 'bold',
                        align: 'end',
                        flex: 1,
                    },
                ],
            } as any);
        }

        // Add reason if provided
        if (params.reason && params.action === 'created') {
            bubble.body!.contents.push({
                type: 'separator',
                margin: 'md',
            } as any);
            bubble.body!.contents.push({
                type: 'text',
                text: `💬 ${params.reason}`,
                color: '#666666',
                size: 'xs',
                wrap: true,
                margin: 'md',
            } as any);
        }

        // Add approver name for approved/rejected
        if (params.approverName && (params.action === 'approved' || params.action === 'rejected')) {
            bubble.body!.contents.push({
                type: 'separator',
                margin: 'md',
            } as any);
            bubble.body!.contents.push({
                type: 'text',
                text: `👔 โดย: ${params.approverName}`,
                color: '#666666',
                size: 'xs',
                margin: 'md',
            } as any);
        }

        // Add rejection reason
        if (params.rejectionReason && params.action === 'rejected') {
            bubble.body!.contents.push({
                type: 'text',
                text: `❌ เหตุผล: ${params.rejectionReason}`,
                color: '#EF4444',
                size: 'xs',
                wrap: true,
                margin: 'sm',
            } as any);
        }

        // Add footer with timestamp (Thailand timezone UTC+7)
        const formattedTime = new Date().toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok',
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

        bubble.footer = {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: formattedTime,
                    color: '#AAAAAA',
                    size: 'xxs',
                    align: 'end',
                },
            ],
        };

        const flexMessage: FlexMessage = {
            type: 'flex',
            altText: `${emoji} ${title}: ${params.employeeName} - ${params.leaveTypeName} (${params.totalDays} วัน)`,
            contents: bubble,
        };

        await client.pushMessage(config.groupId, flexMessage);
        logger.log('✅ LINE leave notification sent successfully');
        return true;
    } catch (error: any) {
        logger.error('❌ LINE leave notification failed:', error.message);
        return false;
    }
}

/**
 * Send a simple notification for testing
 */
export async function sendLineTestNotification(): Promise<boolean> {
    return sendLineTextMessage('🔔 ทดสอบการแจ้งเตือน LINE Bot สำเร็จ!');
}
