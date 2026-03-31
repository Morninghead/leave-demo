import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

// GET: ดูประวัติการเปลี่ยนแปลงวันลา
const getLeaveBalanceHistory = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    const userRole = event.user?.role;
    const params = event.queryStringParameters || {};
    
    const employeeId = params.employee_id || userId;
    
    // Permission check
    if (employeeId !== userId && !['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Forbidden', 403);
    }

    const historyQuery = `
      SELECT 
        lbh.*,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name,
        admin.first_name_th || ' ' || admin.last_name_th as changed_by_name
      FROM leave_balance_history lbh
      LEFT JOIN leave_types lt ON lbh.leave_type_id = lt.id
      LEFT JOIN employees e ON lbh.employee_id = e.id
      LEFT JOIN employees admin ON lbh.changed_by = admin.id
      WHERE lbh.employee_id = $1
      ORDER BY lbh.changed_at DESC
      LIMIT 100
    `;

    const history = await query(historyQuery, [employeeId]);

    return successResponse({ history });
  } catch (error: any) {
    console.error('Get leave balance history error:', error);
    return errorResponse(error.message || 'Failed to get history', 500);
  }
};

export const handler: Handler = requireAuth(getLeaveBalanceHistory);
