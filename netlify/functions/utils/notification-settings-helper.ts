import { query } from './db';
import { logger } from './logger';

/**
 * Notification Settings Helper
 * 
 * Provides functions to check if specific notifications are enabled
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

// Cache for notification settings (refresh every 5 minutes)
let cachedSettings: NotificationSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get notification settings from database with caching
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
    const now = Date.now();

    // Return cached settings if still valid
    if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedSettings;
    }

    try {
        const result = await query(
            `SELECT setting_value FROM company_settings WHERE setting_key = 'notification_settings'`
        );

        if (result.length > 0 && result[0].setting_value) {
            try {
                const settings = JSON.parse(result[0].setting_value);
                cachedSettings = { ...defaultSettings, ...settings };
                cacheTimestamp = now;
                return cachedSettings!;
            } catch {
                return defaultSettings;
            }
        }

        return defaultSettings;
    } catch (error) {
        logger.warn('⚠️ Failed to fetch notification settings, using defaults');
        return defaultSettings;
    }
}

/**
 * Check if LINE notification is enabled for a specific event
 */
export async function isLineNotificationEnabled(
    eventType: 'leave_created' | 'leave_approved' | 'leave_rejected' | 'leave_canceled' | 'leave_voided' | 'warning_issued' | 'low_balance_alert'
): Promise<boolean> {
    const settings = await getNotificationSettings();

    // Check global LINE enable first
    if (!settings.line_enabled) {
        return false;
    }

    // Check specific event setting
    const key = `${eventType}_line` as keyof NotificationSettings;
    return settings[key] as boolean;
}

/**
 * Check if Email notification is enabled for a specific event
 */
export async function isEmailNotificationEnabled(
    eventType: 'leave_created' | 'leave_approved' | 'leave_rejected' | 'leave_canceled' | 'leave_voided' | 'warning_issued' | 'low_balance_alert'
): Promise<boolean> {
    const settings = await getNotificationSettings();

    // Check global email enable first
    if (!settings.email_enabled) {
        return false;
    }

    // Check specific event setting
    const key = `${eventType}_email` as keyof NotificationSettings;
    return settings[key] as boolean;
}

/**
 * Clear cached settings (call when settings are updated)
 */
export function clearNotificationSettingsCache() {
    cachedSettings = null;
    cacheTimestamp = 0;
}

/**
 * Check if Telegram notification is enabled for a specific event
 */
export async function isTelegramNotificationEnabled(
    eventType: 'leave_created' | 'leave_approved' | 'leave_rejected' | 'leave_canceled' | 'leave_voided' | 'warning_issued' | 'low_balance_alert'
): Promise<boolean> {
    const settings = await getNotificationSettings();

    // Check global Telegram enable first
    if (!settings.telegram_enabled) {
        return false;
    }

    // Check specific event setting
    const key = `${eventType}_telegram` as keyof NotificationSettings;
    return settings[key] as boolean;
}
