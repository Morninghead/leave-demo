// netlify/functions/settings-warning-system.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent, canManageSettings } from './utils/auth-middleware';

/**
 * Warning System Settings API
 * GET: Retrieve current settings
 * PUT: Update settings (HR/Admin only)
 */

// Interface for settings
interface WarningSystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  value_type: 'BOOLEAN' | 'INTEGER' | 'STRING' | 'JSON';
  description_th: string;
  description_en: string;
  updated_by?: number;
  updated_at: string;
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    // GET: Retrieve settings
    if (event.httpMethod === 'GET') {
      const settings = (await sql`
        SELECT
          id,
          setting_key,
          setting_value,
          value_type,
          description_th,
          description_en,
          updated_by,
          updated_at
        FROM warning_system_settings
        ORDER BY
          CASE setting_key
            WHEN 'system_enabled' THEN 1
            WHEN 'appeal_deadline_days' THEN 2
            WHEN 'warning_expiry_months' THEN 3
            WHEN 'require_signature' THEN 4
            WHEN 'allow_signature_refusal' THEN 5
            WHEN 'min_scroll_percentage' THEN 6
            WHEN 'auto_send_email' THEN 7
            WHEN 'email_provider' THEN 8
            ELSE 99
          END
      `) as WarningSystemSetting[];

      // Convert settings to key-value object
      const settingsObject: Record<string, any> = {};
      const settingsArray: any[] = [];

      settings.forEach((setting) => {
        const value = (() => {
          switch (setting.value_type) {
            case 'BOOLEAN':
              return setting.setting_value === 'true';
            case 'INTEGER':
              return parseInt(setting.setting_value, 10);
            case 'JSON':
              try {
                return JSON.parse(setting.setting_value);
              } catch {
                return setting.setting_value;
              }
            default:
              return setting.setting_value;
          }
        })();

        settingsObject[setting.setting_key] = value;

        settingsArray.push({
          key: setting.setting_key,
          value,
          type: setting.value_type,
          description_th: setting.description_th,
          description_en: setting.description_en,
          updated_at: setting.updated_at,
        });
      });

      return successResponse({
        settings: settingsObject,
        settingsDetail: settingsArray,
      });
    }

    // PUT: Update settings (HR/Admin only)
    if (event.httpMethod === 'PUT') {
      console.log('🔧 Warning settings update requested by:', event.user?.userId, event.user?.role);

      // Check permissions
      if (!canManageSettings(event)) {
        console.error('❌ Permission denied - user role:', event.user?.role);
        return errorResponse('Only HR and Admin can update warning system settings. Your role: ' + event.user?.role, 403);
      }

      const body = JSON.parse(event.body || '{}');
      const { settings } = body;

      console.log('📝 Settings to update:', settings);

      if (!settings || typeof settings !== 'object') {
        return errorResponse('Invalid settings object', 400);
      }

      const userId = event.user?.userId;
      const updatedSettings: any[] = [];

      // Validate and update each setting
      for (const [key, value] of Object.entries(settings)) {
        // Get current setting to validate type
        const [currentSetting] = (await sql`
          SELECT * FROM warning_system_settings WHERE setting_key = ${key}
        `) as WarningSystemSetting[];

        if (!currentSetting) {
          console.warn(`⚠️  Unknown setting key: ${key}`);
          continue;
        }

        // Convert value to string based on type
        let stringValue: string;
        switch (currentSetting.value_type) {
          case 'BOOLEAN':
            if (typeof value !== 'boolean') {
              return errorResponse(`Setting '${key}' must be a boolean`, 400);
            }
            stringValue = value.toString();
            break;
          case 'INTEGER':
            const numValue = parseInt(value as string, 10);
            if (isNaN(numValue)) {
              return errorResponse(`Setting '${key}' must be an integer`, 400);
            }
            // Validate ranges
            if (key === 'appeal_deadline_days' && (numValue < 7 || numValue > 30)) {
              return errorResponse('Appeal deadline must be between 7-30 days', 400);
            }
            if (key === 'warning_expiry_months' && (numValue < 1 || numValue > 60)) {
              return errorResponse('Warning expiry must be between 1-60 months', 400);
            }
            if (key === 'min_scroll_percentage' && (numValue < 0 || numValue > 100)) {
              return errorResponse('Scroll percentage must be between 0-100', 400);
            }
            stringValue = numValue.toString();
            break;
          case 'JSON':
            stringValue = JSON.stringify(value);
            break;
          default:
            stringValue = String(value);
        }

        // Update or Insert setting (UPSERT)
        await sql`
          INSERT INTO warning_system_settings (
            setting_key,
            setting_value,
            value_type,
            description_th,
            description_en,
            updated_by
          ) VALUES (
            ${key},
            ${stringValue},
            ${currentSetting.value_type},
            ${currentSetting.description_th},
            ${currentSetting.description_en},
            ${userId}
          )
          ON CONFLICT (setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `;

        updatedSettings.push({
          key,
          value,
          updated_at: new Date().toISOString(),
        });
      }

      // Log audit trail
      await sql`
        INSERT INTO warning_audit_logs (
          warning_notice_id,
          action,
          performed_by,
          ip_address,
          changes,
          notes
        ) VALUES (
          NULL,
          'SETTINGS_UPDATED',
          ${userId},
          ${event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'},
          ${JSON.stringify({ settings: updatedSettings })}::jsonb,
          ${'อัพเดทการตั้งค่าระบบใบเตือน\n---\nUpdated warning system settings'}
        )
      `;

      console.log('✅ Settings updated successfully:', updatedSettings.length, 'settings');

      return successResponse({
        message: 'Settings updated successfully',
        updated: updatedSettings,
        count: updatedSettings.length,
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Settings error:', error);
    return errorResponse(error.message || 'Failed to process settings', 500);
  }
});

export { handler };
