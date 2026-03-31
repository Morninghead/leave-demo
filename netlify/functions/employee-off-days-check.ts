// netlify/functions/employee-off-days-check.ts
// Quick check API to determine if employee has scheduled off-days
// Used by Navbar to conditionally show "My Off-Days" menu item

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const checkEmployeeOffDays = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const userId = event.user?.userId;

        if (!userId) {
            return errorResponse('User ID not found', 400);
        }

        // Quick check: Does this employee have any scheduled off-days?
        const sql = `
      SELECT 
        COUNT(*) as count,
        MIN(off_date) as earliest_off_day,
        MAX(off_date) as latest_off_day
      FROM employee_off_days
      WHERE employee_id = $1
    `;

        const result = await query(sql, [userId]);
        const count = parseInt(result[0]?.count || '0');
        const hasOffDays = count > 0;

        return successResponse({
            hasOffDays,
            count,
            earliestOffDay: result[0]?.earliest_off_day || null,
            latestOffDay: result[0]?.latest_off_day || null,
        });

    } catch (error: any) {
        console.error('Check employee off-days error:', error);
        return errorResponse(error.message || 'Failed to check off-days', 500);
    }
};

export const handler: Handler = requireAuth(checkEmployeeOffDays);
