import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

/**
 * Notification Settings API
 * 
 * Manages notification settings for Email and LINE across the system
 */

interface NotificationSettings {
    email_enabled: boolean;
    line_enabled: boolean;
    telegram_enabled: boolean;
    leave_created_email: boolean;
    leave_created_line: boolean;
    leave_created_telegram: boolean;
    leave_approved_email: boolean;
    leave_approved_line: boolean;
    leave_approved_telegram: boolean;
    leave_rejected_email: boolean;
    leave_rejected_line: boolean;
    leave_rejected_telegram: boolean;
    leave_canceled_email: boolean;
    leave_canceled_line: boolean;
    leave_canceled_telegram: boolean;
    leave_voided_email: boolean;
    leave_voided_line: boolean;
    leave_voided_telegram: boolean;
    warning_issued_email: boolean;
    warning_issued_line: boolean;
    warning_issued_telegram: boolean;
    low_balance_alert_email: boolean;
    low_balance_alert_line: boolean;
    low_balance_alert_telegram: boolean;
}

const defaultSettings: NotificationSettings = {
    email_enabled: true,
    line_enabled: true,
    telegram_enabled: true,
    leave_created_email: true,
    leave_created_line: true,
    leave_created_telegram: true,
    leave_approved_email: true,
    leave_approved_line: true,
    leave_approved_telegram: true,
    leave_rejected_email: true,
    leave_rejected_line: true,
    leave_rejected_telegram: true,
    leave_canceled_email: false,
    leave_canceled_line: true,
    leave_canceled_telegram: true,
    leave_voided_email: true,
    leave_voided_line: true,
    leave_voided_telegram: true,
    warning_issued_email: true,
    warning_issued_line: false,
    warning_issued_telegram: false,
    low_balance_alert_email: true,
    low_balance_alert_line: false,
    low_balance_alert_telegram: false,
};

const notificationSettingsHandler = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const userId = event.user?.userId;
    const userRole = event.user?.role?.toLowerCase();

    if (!userId) {
        return errorResponse('User not authenticated', 401);
    }

    // Only HR and Admin can manage notification settings
    if (!['hr', 'admin'].includes(userRole || '')) {
        return errorResponse('Only HR and Admin can manage notification settings', 403);
    }

    try {
        // GET - Retrieve notification settings
        if (event.httpMethod === 'GET') {
            logger.log('📬 Fetching notification settings...');

            const result = await query(
                `SELECT setting_value FROM company_settings WHERE setting_key = 'notification_settings'`
            );

            if (result.length > 0 && result[0].setting_value) {
                try {
                    const settings = JSON.parse(result[0].setting_value);
                    return successResponse({
                        settings: { ...defaultSettings, ...settings }
                    });
                } catch {
                    return successResponse({ settings: defaultSettings });
                }
            }

            return successResponse({ settings: defaultSettings });
        }

        // POST - Update notification settings
        if (event.httpMethod === 'POST') {
            logger.log('💾 Updating notification settings...');

            if (!event.body) {
                return errorResponse('Request body is required', 400);
            }

            const body = JSON.parse(event.body);
            const { settings } = body;

            if (!settings) {
                return errorResponse('Settings object is required', 400);
            }

            const settingsJson = JSON.stringify(settings);

            // Upsert the settings
            await query(
                `INSERT INTO company_settings (setting_key, setting_value, updated_at)
         VALUES ('notification_settings', $1, NOW())
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $1, updated_at = NOW()`,
                [settingsJson]
            );

            logger.log('✅ Notification settings saved successfully');

            return successResponse({
                message: 'Notification settings saved successfully',
                settings
            });
        }

        return errorResponse('Method not allowed', 405);

    } catch (error: any) {
        logger.error('❌ Notification settings error:', error);
        return errorResponse(error.message || 'Failed to manage notification settings', 500);
    }
};

export const handler: Handler = requireAuth(notificationSettingsHandler);
