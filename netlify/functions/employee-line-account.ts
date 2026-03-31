import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { errorResponse, handleCORS, successResponse } from './utils/response';
import { getConfiguredLineChannelIds, getConfiguredLineLiffId, verifyLineIdToken } from './utils/line-auth';

type LineAccountRow = {
  employee_id: string;
  line_user_id: string;
  line_display_name: string | null;
  picture_url: string | null;
  linked_at: string;
  updated_at: string;
};

function validateLineToken(lineIdToken: string): void {
  if (!lineIdToken) {
    throw new Error('LINE identity token is required');
  }

  if (lineIdToken.length > 5000) {
    throw new Error('LINE identity token is too long');
  }
}

function maskLineUserId(lineUserId: string | null): string | null {
  if (!lineUserId) {
    return null;
  }

  if (lineUserId.length <= 6) {
    return `${lineUserId.slice(0, 2)}***`;
  }

  return `${lineUserId.slice(0, 3)}***${lineUserId.slice(-3)}`;
}

async function getLineLinkSettings() {
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

  const enabled = settingsMap.line_link_enabled === 'true';
  const liffId = getConfiguredLineLiffId();
  const channelId = getConfiguredLineChannelIds()[0] || null;

  return {
    enabled,
    ready: enabled && !!liffId && !!channelId,
    liffId: liffId || null,
    channelId,
    loginEnabled: settingsMap.line_login_enabled === 'true',
  };
}

async function getCurrentLineAccount(userId: string): Promise<LineAccountRow | null> {
  const rows = await query<LineAccountRow>(
    `SELECT employee_id, line_user_id, line_display_name, picture_url, linked_at, updated_at
     FROM employee_line_accounts
     WHERE employee_id = $1
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

function buildStatusPayload(settings: Awaited<ReturnType<typeof getLineLinkSettings>>, account: LineAccountRow | null) {
  return {
    enabled: settings.enabled,
    ready: settings.ready,
    liffId: settings.liffId,
    channelId: settings.channelId,
    loginEnabled: settings.loginEnabled,
    linked: !!account,
    link: account
      ? {
          lineDisplayName: account.line_display_name,
          pictureUrl: account.picture_url,
          linkedAt: account.linked_at,
          updatedAt: account.updated_at,
          lineUserIdMasked: maskLineUserId(account.line_user_id),
        }
      : null,
    message: settings.enabled ? undefined : 'LINE account linking is disabled in company settings',
  };
}

const employeeLineAccountHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) {
    return corsResponse;
  }

  const userId = event.user?.userId;
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    if (event.httpMethod === 'GET') {
      const settings = await getLineLinkSettings();
      const account = await getCurrentLineAccount(userId);
      return successResponse(buildStatusPayload(settings, account));
    }

    if (event.httpMethod === 'POST') {
      const settings = await getLineLinkSettings();
      if (!settings.enabled) {
        return errorResponse('LINE account linking is disabled', 403);
      }

      const { line_id_token } = JSON.parse(event.body || '{}');
      validateLineToken(line_id_token);

      const lineProfile = await verifyLineIdToken(line_id_token);

      const existingLineUser = await query<{ employee_id: string }>(
        `SELECT employee_id
         FROM employee_line_accounts
         WHERE line_user_id = $1
         LIMIT 1`,
        [lineProfile.sub]
      );

      if (existingLineUser[0] && existingLineUser[0].employee_id !== userId) {
        return errorResponse('This LINE account is already linked to another employee', 409);
      }

      const upserted = await query<LineAccountRow>(
        `INSERT INTO employee_line_accounts (
           employee_id,
           line_user_id,
           line_display_name,
           picture_url,
           linked_at,
           updated_at,
           linked_by
         )
         VALUES ($1, $2, $3, $4, NOW(), NOW(), $1)
         ON CONFLICT (employee_id)
         DO UPDATE SET
           line_user_id = EXCLUDED.line_user_id,
           line_display_name = EXCLUDED.line_display_name,
           picture_url = EXCLUDED.picture_url,
           linked_at = NOW(),
           updated_at = NOW(),
           linked_by = EXCLUDED.linked_by
         RETURNING employee_id, line_user_id, line_display_name, picture_url, linked_at, updated_at`,
        [userId, lineProfile.sub, lineProfile.name || null, lineProfile.picture || null]
      );

      return successResponse({
        message: 'LINE account linked successfully',
        ...buildStatusPayload(settings, upserted[0] || null),
      });
    }

    if (event.httpMethod === 'DELETE') {
      const deleted = await query<LineAccountRow>(
        `DELETE FROM employee_line_accounts
         WHERE employee_id = $1
         RETURNING employee_id, line_user_id, line_display_name, picture_url, linked_at, updated_at`,
        [userId]
      );

      const settings = await getLineLinkSettings();

      return successResponse({
        message: deleted.length > 0
          ? 'LINE account unlinked successfully'
          : 'No linked LINE account was found',
        ...buildStatusPayload(settings, null),
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    const message = error.message || 'Failed to manage LINE account';
    const statusCode = message === 'LINE identity token is invalid or expired' ? 401 : 500;
    return errorResponse(message, statusCode);
  }
};

export const handler: Handler = requireAuth(employeeLineAccountHandler);
