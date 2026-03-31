import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { clearConfigCache } from './utils/channel-config-helper';

/**
 * Notification Channel Configuration API
 * 
 * Manages configuration for notification channels (Email, LINE, Telegram)
 * Stores in company_settings table, falls back to environment variables
 */

interface ChannelConfig {
    email: {
        provider: string;
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

// Mask sensitive tokens for display (show first 8 and last 4 chars)
const maskToken = (token: string | undefined | null): string => {
    if (!token) return '';
    if (token.length <= 12) return '●'.repeat(token.length);
    return token.substring(0, 8) + '●'.repeat(Math.min(token.length - 12, 20)) + token.substring(token.length - 4);
};

// Get config from DB, with fallback to environment variables
const getChannelConfig = async (): Promise<ChannelConfig> => {
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
                logger.warn('Failed to parse notification channel config from DB');
            }
        }

        // Merge DB config with environment variables (DB takes priority)
        return {
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
    } catch (error) {
        logger.error('Failed to get channel config:', error);
        // Return env vars as fallback
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
};

const notificationChannelConfigHandler = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const userId = event.user?.userId;
    const userRole = event.user?.role?.toLowerCase();

    if (!userId) {
        return errorResponse('User not authenticated', 401);
    }

    // Only HR and Admin can manage notification channel configs
    if (!['hr', 'admin'].includes(userRole || '')) {
        return errorResponse('Only HR and Admin can manage notification channel configuration', 403);
    }

    try {
        // GET - Retrieve channel configuration (with masked tokens)
        if (event.httpMethod === 'GET') {
            logger.log('📡 Fetching notification channel configuration...');

            const config = await getChannelConfig();

            // Return masked version for display
            const maskedConfig = {
                email: {
                    provider: config.email.provider,
                    provider_configured: config.email.provider !== 'console',
                    smtp_host: config.email.smtp_host,
                    smtp_host_configured: !!config.email.smtp_host,
                    smtp_port: config.email.smtp_port,
                    smtp_user: config.email.smtp_user,
                    smtp_user_configured: !!config.email.smtp_user,
                    smtp_pass: maskToken(config.email.smtp_pass),
                    smtp_pass_configured: !!config.email.smtp_pass,
                    sendgrid_api_key: maskToken(config.email.sendgrid_api_key),
                    sendgrid_api_key_configured: !!config.email.sendgrid_api_key,
                    sender_email: config.email.sender_email,
                    sender_name: config.email.sender_name,
                    reply_to_email: config.email.reply_to_email,
                },
                line: {
                    channel_access_token: maskToken(config.line.channel_access_token),
                    channel_access_token_configured: !!config.line.channel_access_token,
                    group_id: config.line.group_id,
                    group_id_configured: !!config.line.group_id,
                },
                telegram: {
                    bot_token: maskToken(config.telegram.bot_token),
                    bot_token_configured: !!config.telegram.bot_token,
                    chat_id: config.telegram.chat_id,
                    chat_id_configured: !!config.telegram.chat_id,
                },
            };

            return successResponse({ config: maskedConfig });
        }

        // POST - Update channel configuration
        if (event.httpMethod === 'POST') {
            logger.log('💾 Updating notification channel configuration...');

            if (!event.body) {
                return errorResponse('Request body is required', 400);
            }

            const body = JSON.parse(event.body);
            const { config } = body;

            if (!config) {
                return errorResponse('Config object is required', 400);
            }

            // Get existing config
            const existingConfig = await getChannelConfig();

            // Merge new values (only update non-empty values for sensitive fields)
            const updatedConfig: ChannelConfig = {
                email: {
                    provider: config.email?.provider !== undefined
                        ? config.email.provider
                        : existingConfig.email.provider,
                    smtp_host: config.email?.smtp_host !== undefined
                        ? config.email.smtp_host
                        : existingConfig.email.smtp_host,
                    smtp_port: config.email?.smtp_port !== undefined
                        ? config.email.smtp_port
                        : existingConfig.email.smtp_port,
                    smtp_user: config.email?.smtp_user !== undefined
                        ? config.email.smtp_user
                        : existingConfig.email.smtp_user,
                    smtp_pass: config.email?.smtp_pass !== undefined && config.email.smtp_pass !== ''
                        ? config.email.smtp_pass
                        : existingConfig.email.smtp_pass,
                    sendgrid_api_key: config.email?.sendgrid_api_key !== undefined && config.email.sendgrid_api_key !== ''
                        ? config.email.sendgrid_api_key
                        : existingConfig.email.sendgrid_api_key,
                    sender_email: config.email?.sender_email !== undefined
                        ? config.email.sender_email
                        : existingConfig.email.sender_email,
                    sender_name: config.email?.sender_name !== undefined
                        ? config.email.sender_name
                        : existingConfig.email.sender_name,
                    reply_to_email: config.email?.reply_to_email !== undefined
                        ? config.email.reply_to_email
                        : existingConfig.email.reply_to_email,
                },
                line: {
                    channel_access_token: config.line?.channel_access_token !== undefined && config.line.channel_access_token !== ''
                        ? config.line.channel_access_token
                        : existingConfig.line.channel_access_token,
                    group_id: config.line?.group_id !== undefined
                        ? config.line.group_id
                        : existingConfig.line.group_id,
                },
                telegram: {
                    bot_token: config.telegram?.bot_token !== undefined && config.telegram.bot_token !== ''
                        ? config.telegram.bot_token
                        : existingConfig.telegram.bot_token,
                    chat_id: config.telegram?.chat_id !== undefined
                        ? config.telegram.chat_id
                        : existingConfig.telegram.chat_id,
                },
            };

            const configJson = JSON.stringify(updatedConfig);

            // Upsert the config
            await query(
                `INSERT INTO company_settings (setting_key, setting_value, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (setting_key) 
                 DO UPDATE SET setting_value = $2, updated_at = NOW()`,
                [SETTING_KEY, configJson]
            );

            // Clear cache so new config is used immediately
            clearConfigCache();

            logger.log('✅ Notification channel configuration saved successfully');

            // Return masked version
            const maskedConfig = {
                email: {
                    provider: updatedConfig.email.provider,
                    provider_configured: updatedConfig.email.provider !== 'console',
                    smtp_host: updatedConfig.email.smtp_host,
                    smtp_host_configured: !!updatedConfig.email.smtp_host,
                    smtp_port: updatedConfig.email.smtp_port,
                    smtp_user: updatedConfig.email.smtp_user,
                    smtp_user_configured: !!updatedConfig.email.smtp_user,
                    smtp_pass: maskToken(updatedConfig.email.smtp_pass),
                    smtp_pass_configured: !!updatedConfig.email.smtp_pass,
                    sendgrid_api_key: maskToken(updatedConfig.email.sendgrid_api_key),
                    sendgrid_api_key_configured: !!updatedConfig.email.sendgrid_api_key,
                    sender_email: updatedConfig.email.sender_email,
                    sender_name: updatedConfig.email.sender_name,
                    reply_to_email: updatedConfig.email.reply_to_email,
                },
                line: {
                    channel_access_token: maskToken(updatedConfig.line.channel_access_token),
                    channel_access_token_configured: !!updatedConfig.line.channel_access_token,
                    group_id: updatedConfig.line.group_id,
                    group_id_configured: !!updatedConfig.line.group_id,
                },
                telegram: {
                    bot_token: maskToken(updatedConfig.telegram.bot_token),
                    bot_token_configured: !!updatedConfig.telegram.bot_token,
                    chat_id: updatedConfig.telegram.chat_id,
                    chat_id_configured: !!updatedConfig.telegram.chat_id,
                },
            };

            return successResponse({
                message: 'Notification channel configuration saved successfully',
                config: maskedConfig
            });
        }

        return errorResponse('Method not allowed', 405);

    } catch (error: any) {
        logger.error('❌ Notification channel config error:', error);
        return errorResponse(error.message || 'Failed to manage notification channel configuration', 500);
    }
};

export const handler: Handler = requireAuth(notificationChannelConfigHandler);
