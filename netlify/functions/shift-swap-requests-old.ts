// netlify/functions/shift-swap-requests.ts

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const getShiftSwapRequests = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    const userRole = event.user?.role;
    const params = event.queryStringParameters || {};

    // ✅ SELECT ssr.* = ได้ข้อมูล Multi-stage Approval ครบ!
    let sql = `
      SELECT
        ssr.*,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM shift_swap_requests ssr
      LEFT JOIN employees e ON ssr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Filter by role
    if (!['hr', 'admin'].includes(userRole || '')) {
      if (userRole === 'manager') {
        // Managers see only their department
        const userDept = await query('SELECT department_id FROM employees WHERE id = $1', [userId]);
        if (userDept.length > 0 && userDept[0].department_id) {
          sql += ` AND e.department_id = $${paramIndex}`;
          queryParams.push(userDept[0].department_id);
          paramIndex++;
        }
      } else {
        // Regular employees see ONLY their own requests
        sql += ` AND ssr.employee_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }
    } else if (params.employee_id) {
      // HR/Admin can filter by specific employee
      sql += ` AND ssr.employee_id = $${paramIndex}`;
      queryParams.push(params.employee_id);
      paramIndex++;
    }

    // ✅ Filter by status if provided
    if (params.status && params.status !== 'all') {
      sql += ` AND ssr.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    sql += ` ORDER BY ssr.created_at DESC`;

    const requests = await query(sql, queryParams);

    // ✅ แก้: return { shift_swap_requests: [...] } แทน { requests: [...] }
    return successResponse({ 
      success: true,
      shift_swap_requests: requests 
    });

  } catch (error: any) {
    console.error('Get shift swap requests error:', error);
    return errorResponse(error.message || 'Failed to get shift swap requests', 500);
  }
};

export const handler: Handler = requireAuth(getShiftSwapRequests);
