// netlify/functions/settings.ts
import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

/**
 * Settings API Handler
 * Manages system settings (company info, branding, work schedule)
 * 
 * Permissions:
 * - GET: All authenticated users
 * - PUT: HR, Admin, Developer only
 */
const settingsHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  console.log('🔵 Settings API:', {
    method: event.httpMethod,
    user: event.user?.employee_code,
    role: event.user?.role
  });

  // =============================================
  // GET - Retrieve Settings
  // =============================================
  if (event.httpMethod === 'GET') {
    try {
      // Query all company settings
      const companySettings = await query('SELECT setting_key, setting_value FROM company_settings');

      // Build settings object from company settings
      const settingsObj = companySettings.reduce((acc: any, row: any) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});

      // Construct the settings object in the expected format
      const settings = {
        id: 'default',
        company_name_th: settingsObj.company_name_th || 'บริษัท',
        company_name_en: settingsObj.company_name_en || 'Company',
        // Support both working_days_per_week and work_days_per_week (database inconsistency)
        working_days_per_week: parseInt(settingsObj.working_days_per_week || settingsObj.work_days_per_week) || 5,
        branding_settings: settingsObj.branding_settings ? JSON.parse(settingsObj.branding_settings) : {
          logo: {
            type: 'icon',
            iconName: 'Calendar',
            backgroundColor: '#2563eb',
            width: 64,
            height: 64,
            iconSize: 48,
            rounded: 'lg',
            imagePath: '',
          },
          primaryColor: '#2563eb',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      console.log('✅ Settings retrieved:', {
        found: Object.keys(settingsObj).length > 0,
        settingKeys: Object.keys(settingsObj)
      });

      return successResponse({ settings });
    } catch (error: any) {
      console.error('❌ Get settings error:', error);
      return errorResponse(error.message || 'Failed to get settings', 500);
    }
  }

  // =============================================
  // PUT - Update Settings
  // =============================================
  if (event.httpMethod === 'PUT') {
    // ✅ Permission check: HR or Admin only (NOT department admin)
    const userRole = event.user?.role;
    const isHR = event.user?.is_hr === true;

    const hasPermission = isHR || ['hr', 'admin'].includes(userRole || '');

    if (!hasPermission) {
      console.log('❌ Permission denied:', {
        role: userRole,
        isHR
      });
      return errorResponse('Permission denied. HR or Admin role required.', 403);
    }

    try {
      const body = JSON.parse(event.body || '{}');
      const { 
        company_name_th, 
        company_name_en, 
        working_days_per_week,
        branding_settings
      } = body;

      console.log('📝 Updating settings:', {
        company_name_th,
        company_name_en,
        working_days_per_week,
        has_branding: !!branding_settings
      });

      // ============================================
      // UPDATE company_settings table (key-value)
      // ============================================
      const updates: Array<{key: string, value: string}> = [];

      if (company_name_th !== undefined) {
        updates.push({ key: 'company_name_th', value: company_name_th });
      }

      if (company_name_en !== undefined) {
        updates.push({ key: 'company_name_en', value: company_name_en });
      }

      if (working_days_per_week !== undefined) {
        // Store with both key names for compatibility
        updates.push({ key: 'working_days_per_week', value: String(working_days_per_week) });
        updates.push({ key: 'work_days_per_week', value: String(working_days_per_week) });
      }

      if (branding_settings !== undefined) {
        updates.push({ key: 'branding_settings', value: JSON.stringify(branding_settings) });
      }

      if (updates.length === 0) {
        return errorResponse('No fields to update', 400);
      }

      // Use UPSERT to update or insert each setting
      for (const update of updates) {
        const upsertSql = `
          INSERT INTO company_settings (setting_key, setting_value)
          VALUES ($1, $2)
          ON CONFLICT (setting_key)
          DO UPDATE SET setting_value = EXCLUDED.setting_value
        `;

        await query(upsertSql, [update.key, update.value]);
      }

      console.log('✅ Settings updated successfully in company_settings table');

      // Fetch updated settings to return
      const updatedSettings = await query('SELECT setting_key, setting_value FROM company_settings');
      const settingsObj = updatedSettings.reduce((acc: any, row: any) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});

      const result = {
        id: 'default',
        company_name_th: settingsObj.company_name_th || 'บริษัท',
        company_name_en: settingsObj.company_name_en || 'Company',
        working_days_per_week: parseInt(settingsObj.working_days_per_week || settingsObj.work_days_per_week) || 5,
        branding_settings: settingsObj.branding_settings ? JSON.parse(settingsObj.branding_settings) : {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return successResponse({
        settings: result,
        message: 'Settings updated successfully',
      });

    } catch (error: any) {
      console.error('❌ Update settings error:', error);
      return errorResponse(error.message || 'Failed to update settings', 500);
    }
  }

  // =============================================
  // Invalid Method
  // =============================================
  return errorResponse('Method not allowed', 405);
};

// Export with authentication middleware
export const handler: Handler = requireAuth(settingsHandler);
