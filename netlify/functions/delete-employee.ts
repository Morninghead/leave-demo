import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logDelete, logUpdate } from './utils/audit-logger';

const deleteEmployee = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'DELETE') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;
  const userId = event.user?.userId;

  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  const employeeId = event.path.split('/').pop();
  if (!employeeId) {
    return errorResponse('Employee ID is required', 400);
  }

  // Get resignation info from query params
  const queryParams = event.queryStringParameters || {};
  const resignationDate = queryParams.resignation_date || null;
  const resignationReason = queryParams.resignation_reason || null;

  try {
    // ป้องกันไม่ให้ลบตัวเอง
    if (employeeId === userId) {
      return errorResponse('Cannot delete yourself', 400);
    }

    // ตรวจสอบว่า employee มีอยู่จริง
    const checkSql = `SELECT * FROM employees WHERE id = $1`;
    const existing = await query(checkSql, [employeeId]);

    if (existing.length === 0) {
      return errorResponse('Employee not found', 404);
    }

    const employeeData = existing[0];



    // ALWAYS Soft Delete (Resign) to preserve history
    // (Previously, new employees were hard deleted, causing confusion)

    // Update status to inactive
    const updateSql = `
      UPDATE employees 
      SET status = 'inactive', 
          is_active = false,
          resignation_date = $2,
          resignation_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(updateSql, [employeeId, resignationDate, resignationReason]);

    // ============================================================================
    // 🔒 AUDIT LOG: Track employee deactivation (resignation)
    // ============================================================================
    try {
      await logUpdate(
        event.user?.userId || 'system',
        'employee',
        employeeId,
        {
          employee_code: employeeData.employee_code,
          email: employeeData.email,
          is_active: employeeData.is_active,
          status: employeeData.status,
        },
        {
          employee_code: result[0].employee_code,
          email: result[0].email,
          is_active: false,
          status: 'inactive',
          resignation_date: result[0].resignation_date,
          resignation_reason: result[0].resignation_reason,
        },
        event,
        {
          action_type: 'deactivation',
          deactivated_by_employee_code: event.user?.employeeCode,
          reason: 'employee_resignation',
        }
      );
    } catch (auditError) {
      console.error('❌ [AUDIT] Failed to log employee deactivation:', auditError);
    }

    return successResponse({
      message: 'Employee resigned and deactivated successfully',
      employee: result[0],
    });
  } catch (error: any) {
    console.error('Delete employee error:', error);
    return errorResponse(error.message || 'Failed to delete employee', 500);
  }
};

export const handler: Handler = requireAuth(deleteEmployee);
