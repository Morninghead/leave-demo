import { query } from './db';
import { logger } from './logger';

/**
 * Notification Channel Configuration Helper
 * 
 * Provides configuration for notification channels (Email, LINE, Telegram)
 * Reads from database first, falls back to environment variables
 */

export interface ChannelConfig {
    email: {
        provider: string; // 'console', 'sendgrid', 'ses', 'smtp'
        smtp_host: string;
        smtp_port: number;
        smtp_user: string;
        smtp_pass: string;
        sendgrid_api_key: string;
        sender_email: string;
        sender_name: string;
        reply_to_email: string;
    };
    line: {
        channel_access_token: string;
        group_id: string;
    };
    telegram: {
        bot_token: string;
        chat_id: string;
    };
}

const SETTING_KEY = 'notification_channel_config';

// Cache for channel config (5 minute TTL)
let configCache: ChannelConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get notification channel configuration
 * Reads from DB first, falls back to environment variables
 */
export async function getChannelConfig(): Promise<ChannelConfig> {
    // Check cache first
    if (configCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
        return configCache;
    }

    try {
        const result = await query(
            `SELECT setting_value FROM company_settings WHERE setting_key = $1`,
            [SETTING_KEY]
        );

        let dbConfig: Partial<ChannelConfig> = {};
        if (result.length > 0 && result[0].setting_value) {
            try {
                dbConfig = JSON.parse(result[0].setting_value);
            } catch {
                logger.warn('[CHANNEL_CONFIG] Failed to parse notification channel config from DB');
            }
        }

        // Merge DB config with environment variables (DB takes priority)
        configCache = {
            email: {
                provider: dbConfig.email?.provider || process.env.EMAIL_PROVIDER || 'console',
                smtp_host: dbConfig.email?.smtp_host || process.env.SMTP_HOST || '',
                smtp_port: dbConfig.email?.smtp_port || parseInt(process.env.SMTP_PORT || '587'),
                smtp_user: dbConfig.email?.smtp_user || process.env.SMTP_USER || '',
                smtp_pass: dbConfig.email?.smtp_pass || process.env.SMTP_PASS || '',
                sendgrid_api_key: dbConfig.email?.sendgrid_api_key || process.env.SENDGRID_API_KEY || '',
                sender_email: dbConfig.email?.sender_email || process.env.EMAIL_SENDER || 'noreply@company.com',
                sender_name: dbConfig.email?.sender_name || process.env.EMAIL_SENDER_NAME || 'HR Leave System',
                reply_to_email: dbConfig.email?.reply_to_email || process.env.EMAIL_REPLY_TO || 'hr@company.com',
            },
            line: {
                channel_access_token: dbConfig.line?.channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
                group_id: dbConfig.line?.group_id || process.env.LINE_GROUP_ID || '',
            },
            telegram: {
                bot_token: dbConfig.telegram?.bot_token || process.env.TELEGRAM_BOT_TOKEN || '',
                chat_id: dbConfig.telegram?.chat_id || process.env.TELEGRAM_CHAT_ID || '',
            },
        };
        cacheTimestamp = Date.now();

        return configCache;
    } catch (error) {
        logger.error('[CHANNEL_CONFIG] Failed to get channel config:', error);

        // Return env vars as fallback (don't cache errors)
        return {
            email: {
                provider: process.env.EMAIL_PROVIDER || 'console',
                smtp_host: process.env.SMTP_HOST || '',
                smtp_port: parseInt(process.env.SMTP_PORT || '587'),
                smtp_user: process.env.SMTP_USER || '',
                smtp_pass: process.env.SMTP_PASS || '',
                sendgrid_api_key: process.env.SENDGRID_API_KEY || '',
                sender_email: process.env.EMAIL_SENDER || 'noreply@company.com',
                sender_name: process.env.EMAIL_SENDER_NAME || 'HR Leave System',
                reply_to_email: process.env.EMAIL_REPLY_TO || 'hr@company.com',
            },
            line: {
                channel_access_token: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
                group_id: process.env.LINE_GROUP_ID || '',
            },
            telegram: {
                bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
                chat_id: process.env.TELEGRAM_CHAT_ID || '',
            },
        };
    }
}

/**
 * Get Email configuration specifically
 */
export async function getEmailConfig(): Promise<{
    provider: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    sendgridApiKey: string;
    senderEmail: string;
    senderName: string;
    replyToEmail: string;
}> {
    const config = await getChannelConfig();
    return {
        provider: config.email.provider,
        smtpHost: config.email.smtp_host,
        smtpPort: config.email.smtp_port,
        smtpUser: config.email.smtp_user,
        smtpPass: config.email.smtp_pass,
        sendgridApiKey: config.email.sendgrid_api_key,
        senderEmail: config.email.sender_email,
        senderName: config.email.sender_name,
        replyToEmail: config.email.reply_to_email,
    };
}

/**
 * Get LINE configuration specifically
 */
export async function getLineConfig(): Promise<{ channelAccessToken: string; groupId: string }> {
    const config = await getChannelConfig();
    return {
        channelAccessToken: config.line.channel_access_token,
        groupId: config.line.group_id,
    };
}

/**
 * Get Telegram configuration specifically
 */
export async function getTelegramConfig(): Promise<{ botToken: string; chatId: string }> {
    const config = await getChannelConfig();
    return {
        botToken: config.telegram.bot_token,
        chatId: config.telegram.chat_id,
    };
}

/**
 * Clear the config cache (useful after updates)
 */
export function clearConfigCache(): void {
    configCache = null;
    cacheTimestamp = 0;
}
