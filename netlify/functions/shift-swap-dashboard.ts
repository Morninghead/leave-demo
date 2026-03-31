// netlify/functions/shift-swap-dashboard.ts - Get shift swap stats for dashboard with all statuses
import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

const getShiftSwapDashboard = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const userId = event.user?.userId;
        const params = event.queryStringParameters || {};
        const status = params.status || 'all';

        logger.log('=== GET SHIFT SWAP DASHBOARD ===');
        logger.log('User ID:', userId);
        logger.log('Status Filter:', status);

        // Get current user's own shift swap requests with the specified status
        let sql = `
      SELECT
        ssr.*,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM shift_swap_requests ssr
      LEFT JOIN employees e ON ssr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE ssr.employee_id = $1
    `;

        const queryParams: any[] = [userId];

        // Apply status filter
        if (status !== 'all') {
            sql += ` AND ssr.status = $2`;
            queryParams.push(status);
        }

        sql += ` ORDER BY ssr.created_at DESC`;

        logger.log('SQL Query:', sql);
        logger.log('Params:', queryParams);

        const requests = await query(sql, queryParams);

        logger.log(`📊 Found ${requests.length} shift swap requests`);

        return successResponse({
            success: true,
            shift_swap_requests: requests,
            count: requests.length
        });

    } catch (error: any) {
        logger.error('❌ Get shift swap dashboard error:', error);
        return errorResponse(error.message || 'Failed to get shift swap dashboard', 500);
    }
};

export const handler: Handler = requireAuth(getShiftSwapDashboard);
