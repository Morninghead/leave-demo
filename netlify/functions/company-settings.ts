import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const getSettings = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod === 'GET') {
    try {
      const settings = await query(
        'SELECT setting_key, setting_value, description FROM company_settings'
      );

      // Convert to object for easier access
      const settingsObj = settings.reduce((acc: any, row: any) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});

      return successResponse({ settings: settingsObj });
    } catch (error: any) {
      console.error('Get settings error:', error);
      return errorResponse(error.message || 'Failed to get settings', 500);
    }
  }

  if (event.httpMethod === 'PUT') {
    const userRole = event.user?.role;
    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    try {
      const body = JSON.parse(event.body || '{}');
      const { setting_key, setting_value } = body;

      if (!setting_key || !setting_value) {
        return errorResponse('Missing required fields', 400);
      }

      const result = await query(
        `
        UPDATE company_settings 
        SET 
          setting_value = $1,
          updated_by = $2,
          updated_at = NOW()
        WHERE setting_key = $3
        RETURNING *
        `,
        [setting_value, event.user?.userId, setting_key]
      );

      if (result.length === 0) {
        return errorResponse('Setting not found', 404);
      }

      return successResponse({
        setting: result[0],
        message: 'Setting updated successfully',
      });
    } catch (error: any) {
      console.error('Update setting error:', error);
      return errorResponse(error.message || 'Failed to update setting', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
};

export const handler: Handler = requireAuth(getSettings);
