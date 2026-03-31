import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface PasswordSettings {
  forcePasswordChangeOnFirstLogin: boolean;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays: number;
}

const getPasswordSettings = async (): Promise<PasswordSettings> => {
  try {
    const settings = await query(
      'SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN ($1, $2, $3, $4, $5, $6, $7)',
      [
        'force_password_change_on_first_login',
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_numbers',
        'password_require_special_chars',
        'password_expiry_days'
      ]
    );

    const settingsObj = settings.reduce((acc: any, row: any) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    return {
      forcePasswordChangeOnFirstLogin: settingsObj.force_password_change_on_first_login === 'true',
      minLength: parseInt(settingsObj.password_min_length) || 8,
      requireUppercase: settingsObj.password_require_uppercase === 'true',
      requireLowercase: settingsObj.password_require_lowercase === 'true',
      requireNumbers: settingsObj.password_require_numbers === 'true',
      requireSpecialChars: settingsObj.password_require_special_chars === 'true',
      expiryDays: parseInt(settingsObj.password_expiry_days) || 90,
    };
  } catch (error) {
    console.error('Error getting password settings:', error);
    // Return defaults
    return {
      forcePasswordChangeOnFirstLogin: false,
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expiryDays: 90,
    };
  }
};

const updatePasswordSettings = async (settings: Partial<PasswordSettings>): Promise<void> => {
  const updates = [];

  if (settings.forcePasswordChangeOnFirstLogin !== undefined) {
    updates.push(`('force_password_change_on_first_login', '${settings.forcePasswordChangeOnFirstLogin}')`);
  }
  if (settings.minLength !== undefined) {
    updates.push(`('password_min_length', '${settings.minLength}')`);
  }
  if (settings.requireUppercase !== undefined) {
    updates.push(`('password_require_uppercase', '${settings.requireUppercase}')`);
  }
  if (settings.requireLowercase !== undefined) {
    updates.push(`('password_require_lowercase', '${settings.requireLowercase}')`);
  }
  if (settings.requireNumbers !== undefined) {
    updates.push(`('password_require_numbers', '${settings.requireNumbers}')`);
  }
  if (settings.requireSpecialChars !== undefined) {
    updates.push(`('password_require_special_chars', '${settings.requireSpecialChars}')`);
  }
  if (settings.expiryDays !== undefined) {
    updates.push(`('password_expiry_days', '${settings.expiryDays}')`);
  }

  if (updates.length === 0) {
    return;
  }

  const valuesClause = updates.join(', ');

  await query(
    `INSERT INTO company_settings (setting_key, setting_value)
     VALUES ${valuesClause}
     ON CONFLICT (setting_key) DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       updated_at = CURRENT_TIMESTAMP`
  );
};

const passwordSettingsHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  console.log('🔐 Password Settings API:', {
    method: event.httpMethod,
    user: event.user?.employeeCode,
    role: event.user?.role
  });

  if (event.httpMethod === 'GET') {
    try {
      const settings = await getPasswordSettings();
      return successResponse({ settings });
    } catch (error: any) {
      console.error('Error getting password settings:', error);
      return errorResponse(error.message || 'Failed to get password settings', 500);
    }
  }

  if (event.httpMethod === 'POST') {
    // Permission check: Only HR and Admin can update password settings
    const userRole = event.user?.role;
    const isHR = event.user?.role === 'hr' || event.user?.role === 'admin';
    const hasPermission = isHR || ['hr', 'admin'].includes(userRole || '');

    if (!hasPermission) {
      console.log('❌ Permission denied for password settings update:', {
        role: userRole,
        isHR
      });
      return errorResponse('Permission denied. HR or Admin role required.', 403);
    }

    try {
      const body = JSON.parse(event.body || '{}');
      console.log('📝 Updating password settings:', body);

      await updatePasswordSettings(body);
      console.log('✅ Password settings updated successfully');

      const updatedSettings = await getPasswordSettings();
      return successResponse({
        message: 'Password settings updated successfully',
        settings: updatedSettings
      });
    } catch (error: any) {
      console.error('Error updating password settings:', error);
      return errorResponse(error.message || 'Failed to update password settings', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
};

export const handler: Handler = requireAuth(passwordSettingsHandler);
export { getPasswordSettings, updatePasswordSettings };