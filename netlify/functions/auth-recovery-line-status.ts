import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { errorResponse, handleCORS, successResponse } from './utils/response';
import { getConfiguredLineChannelIds, getConfiguredLineLiffId } from './utils/line-auth';

export const handler: Handler = async (event) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const settings = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value
       FROM company_settings
       WHERE setting_key IN ($1, $2)`,
      ['line_login_enabled', 'line_link_enabled']
    );

    const settingsMap = settings.reduce<Record<string, string>>((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    const enabled = settingsMap.line_login_enabled === 'true';
    const liffId = getConfiguredLineLiffId();
    const channelId = getConfiguredLineChannelIds()[0] || null;

    return successResponse({
      enabled,
      ready: enabled && !!liffId && !!channelId,
      liffId: liffId || null,
      channelId,
      message: enabled
        ? undefined
        : 'LINE Login is disabled in company settings',
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get LINE login status', 500);
  }
};
