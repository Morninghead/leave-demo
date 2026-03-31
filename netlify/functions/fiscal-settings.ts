// netlify/functions/fiscal-settings.ts
// API endpoint for managing fiscal year settings
// Only HR and Dev (admin) roles can modify settings

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface FiscalSettings {
    id: string;
    cycle_start_day: number;
    cycle_type: 'day_of_month' | 'calendar' | 'thai_government';
    fiscal_year_start_month: number;
    filter_pending_by_year: boolean;
    description_th: string;
    description_en: string;
    updated_at: string;
    updated_by: string | null;
}

const fiscalSettingsHandler = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const userId = event.user?.userId;
    const userRole = event.user?.role?.toLowerCase();

    // GET - Anyone can read fiscal settings
    if (event.httpMethod === 'GET') {
        try {
            const result = await query(`
        SELECT 
          fs.*,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as updated_by_name_th,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as updated_by_name_en
        FROM fiscal_settings fs
        LEFT JOIN employees e ON fs.updated_by = e.id
        ORDER BY fs.updated_at DESC
        LIMIT 1
      `);

            if (result.length === 0) {
                // Return default settings if none exist
                return successResponse({
                    settings: {
                        id: null,
                        cycle_start_day: 26,
                        cycle_type: 'day_of_month',
                        fiscal_year_start_month: 10,
                        filter_pending_by_year: false,
                        description_th: 'รอบการทำงาน วันที่ 26 - 25 ของเดือน',
                        description_en: 'Payroll cycle: 26th to 25th of each month',
                        updated_at: null,
                        updated_by: null,
                    },
                    is_default: true,
                });
            }

            return successResponse({
                settings: result[0],
                is_default: false,
            });
        } catch (error: any) {
            console.error('❌ Get fiscal settings error:', error);
            return errorResponse(error.message || 'Failed to get fiscal settings', 500);
        }
    }

    // PUT - Only HR and Admin (Dev) can modify
    if (event.httpMethod === 'PUT') {
        // Check authorization
        if (!['hr', 'admin'].includes(userRole || '')) {
            return errorResponse('Only HR and Admin can modify fiscal settings', 403);
        }

        try {
            const body = JSON.parse(event.body || '{}');
            const {
                cycle_start_day,
                cycle_type,
                fiscal_year_start_month,
                filter_pending_by_year,
                description_th,
                description_en,
            } = body;

            // Validate inputs
            if (cycle_start_day && (cycle_start_day < 1 || cycle_start_day > 28)) {
                return errorResponse('cycle_start_day must be between 1 and 28', 400);
            }

            if (cycle_type && !['day_of_month', 'calendar', 'thai_government'].includes(cycle_type)) {
                return errorResponse('Invalid cycle_type. Must be: day_of_month, calendar, or thai_government', 400);
            }

            if (fiscal_year_start_month && (fiscal_year_start_month < 1 || fiscal_year_start_month > 12)) {
                return errorResponse('fiscal_year_start_month must be between 1 and 12', 400);
            }

            // Check if settings exist
            const existing = await query(`SELECT id FROM fiscal_settings LIMIT 1`);

            let result;
            if (existing.length > 0) {
                // Update existing settings
                result = await query(`
          UPDATE fiscal_settings SET
            cycle_start_day = COALESCE($1, cycle_start_day),
            cycle_type = COALESCE($2, cycle_type),
            fiscal_year_start_month = COALESCE($3, fiscal_year_start_month),
            filter_pending_by_year = COALESCE($4, filter_pending_by_year),
            description_th = COALESCE($5, description_th),
            description_en = COALESCE($6, description_en),
            updated_at = NOW(),
            updated_by = $7
          WHERE id = $8
          RETURNING *
        `, [
                    cycle_start_day,
                    cycle_type,
                    fiscal_year_start_month,
                    filter_pending_by_year,
                    description_th,
                    description_en,
                    userId,
                    existing[0].id,
                ]);
            } else {
                // Insert new settings
                result = await query(`
          INSERT INTO fiscal_settings (
            cycle_start_day,
            cycle_type,
            fiscal_year_start_month,
            filter_pending_by_year,
            description_th,
            description_en,
            updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
                    cycle_start_day || 26,
                    cycle_type || 'day_of_month',
                    fiscal_year_start_month || 10,
                    filter_pending_by_year ?? false,
                    description_th || 'รอบการทำงาน',
                    description_en || 'Payroll cycle',
                    userId,
                ]);
            }

            console.log(`✅ Fiscal settings updated by user ${userId}:`, result[0]);

            return successResponse({
                message: 'Fiscal settings updated successfully',
                settings: result[0],
            });
        } catch (error: any) {
            console.error('❌ Update fiscal settings error:', error);
            return errorResponse(error.message || 'Failed to update fiscal settings', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
};

export const handler: Handler = requireAuth(fiscalSettingsHandler);
