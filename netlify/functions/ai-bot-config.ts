/**
 * AI Bot Config API
 * 
 * Get and save AI bot test configuration (DEV only)
 */

import { Handler } from '@netlify/functions';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse } from './utils/response';
import { logger } from './utils/logger';
import { query } from './utils/db';

const handleAIBotConfig = async (event: AuthenticatedEvent) => {
    const user = event.user;

    // Only allow DEV user
    if (!user || user.employeeCode !== '999999999') {
        return errorResponse('Access denied', 403);
    }

    if (event.httpMethod === 'GET') {
        try {
            const result = await query(`
                SELECT 
                    COALESCE(
                        (SELECT setting_value FROM company_settings WHERE setting_key = 'ai_bot_test_token'),
                        ''
                    ) as test_bot_token,
                    COALESCE(
                        (SELECT setting_value FROM company_settings WHERE setting_key = 'ai_bot_test_chat_id'),
                        ''
                    ) as test_chat_id,
                    COALESCE(
                        (SELECT setting_value FROM company_settings WHERE setting_key = 'gemini_api_key'),
                        ''
                    ) as gemini_api_key,
                    COALESCE(
                        (SELECT setting_value FROM company_settings WHERE setting_key = 'ai_bot_webhook_url'),
                        ''
                    ) as webhook_url,
                    COALESCE(
                        (SELECT setting_value FROM company_settings WHERE setting_key = 'ai_bot_production_enabled'),
                        'false'
                    ) as production_enabled,
                    COALESCE(
                        (SELECT setting_value FROM company_settings WHERE setting_key = 'gemini_model'),
                        'gemini-3-flash-preview'
                    ) as gemini_model
            `);

            return successResponse({
                config: {
                    test_bot_token: result[0]?.test_bot_token || '',
                    test_chat_id: result[0]?.test_chat_id || '',
                    gemini_api_key: result[0]?.gemini_api_key || '',
                    webhook_url: result[0]?.webhook_url || '',
                    production_enabled: result[0]?.production_enabled === 'true',
                    gemini_model: result[0]?.gemini_model || 'gemini-3-flash-preview',
                }
            });
        } catch (error: any) {
            logger.error('[AI-BOT-CONFIG] Get error:', error.message);
            return errorResponse('Failed to load config', 500);
        }
    }

    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { config } = body;

            // Upsert each setting
            const settings = [
                { key: 'ai_bot_test_token', value: config.test_bot_token || '' },
                { key: 'ai_bot_test_chat_id', value: config.test_chat_id || '' },
                { key: 'gemini_api_key', value: config.gemini_api_key || '' },
                { key: 'ai_bot_webhook_url', value: config.webhook_url || '' },
                { key: 'ai_bot_production_enabled', value: config.production_enabled ? 'true' : 'false' },
                { key: 'gemini_model', value: config.gemini_model || 'gemini-3-flash-preview' },
            ];

            for (const setting of settings) {
                await query(`
                    INSERT INTO company_settings (setting_key, setting_value, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (setting_key) 
                    DO UPDATE SET setting_value = $2, updated_at = NOW()
                `, [setting.key, setting.value]);
            }

            logger.log('[AI-BOT-CONFIG] Settings saved by DEV user');

            return successResponse({ success: true });
        } catch (error: any) {
            logger.error('[AI-BOT-CONFIG] Save error:', error.message);
            return errorResponse('Failed to save config', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
};

export const handler: Handler = requireAuth(handleAIBotConfig);
