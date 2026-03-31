// netlify/functions/branding-public.ts
// Public endpoint to get branding settings (logo) without authentication
// Used by the login page

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { handleCORS, successResponse, errorResponse } from './utils/response';

export const handler: Handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return handleCORS(event)!;
    }

    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        // Get company settings from key-value table
        const companySettings = await query<any>(
            'SELECT setting_key, setting_value FROM company_settings'
        );

        // Build settings object from key-value pairs
        const settingsObj: any = {};
        for (const row of companySettings || []) {
            settingsObj[row.setting_key] = row.setting_value;
        }

        // Parse branding settings JSON
        let brandingSettings: any = null;
        if (settingsObj.branding_settings) {
            try {
                brandingSettings = JSON.parse(settingsObj.branding_settings);
            } catch (e) {
                console.warn('Failed to parse branding_settings JSON');
            }
        }

        const logo = brandingSettings?.logo || null;

        console.log('📦 Branding settings:', {
            hasLogo: !!logo,
            logoType: logo?.type,
            logoPath: logo?.imagePath
        });

        return successResponse({
            success: true,
            branding: {
                company_name_th: settingsObj.company_name_th || 'บริษัท',
                company_name_en: settingsObj.company_name_en || 'Company',
                logo: logo ? {
                    type: logo.type,
                    imagePath: logo.imagePath,
                    iconName: logo.iconName,
                    backgroundColor: logo.backgroundColor,
                } : null
            }
        });

    } catch (error: any) {
        console.error('❌ Get public branding error:', error);
        return errorResponse(error.message || 'Failed to get branding', 500);
    }
};
