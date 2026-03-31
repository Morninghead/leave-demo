import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const createLeaveType = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userRole = event.user?.role;

    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    const {
      code,
      name_th,
      name_en,
      description_th,
      description_en,
      default_days,
      requires_attachment,
      is_paid,
      color_code,
      is_active,
      color,
      allow_hourly_leave
    } = JSON.parse(event.body || '{}');

    if (!code || !name_th || !name_en) {
      return errorResponse('Missing required fields: code, name_th, name_en', 400);
    }

    const existing = await query(
      'SELECT id FROM leave_types WHERE code = $1',
      [code.toUpperCase()]
    );

    if (existing.length > 0) {
      return errorResponse('Leave type code already exists', 409);
    }

    const quota = default_days !== undefined ? Number(default_days) : 0;

    // 1. Insert new leave type (เก็บ quota ใน leave_types เผื่อใช้งานด้วย)
    const newLeaveType = await query(
      `INSERT INTO leave_types (
        code, name_th, name_en, description_th, description_en,
        default_days, requires_attachment, is_paid, color_code, is_active, color, allow_hourly_leave
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        code.toUpperCase(),
        name_th,
        name_en,
        description_th || null,
        description_en || null,
        quota,
        requires_attachment !== undefined ? requires_attachment : false,
        is_paid !== undefined ? is_paid : true,
        color_code || '#3B82F6',
        is_active !== undefined ? is_active : true,
        color || '#3B82F6',
        allow_hourly_leave !== undefined ? allow_hourly_leave : false
      ]
    );

    // 2. AUTO-SYNC: insert leave_policy for this type (ปีปัจจุบัน) ใช้ quota จริง
    const year = new Date().getFullYear();
    await query(`
      INSERT INTO leave_policies (
        leave_type_id, year, default_days, effective_from, is_active, notes, created_by, created_at, updated_at
      )
      SELECT
        id, ${year}, $2, '${year}-01-01', TRUE, 'Auto-added policy', $1, NOW(), NOW()
      FROM leave_types
      WHERE id NOT IN (
          SELECT leave_type_id FROM leave_policies WHERE year = ${year}
      )
      AND id = $3
    `, [event.user?.userId, quota, newLeaveType[0].id]);

    // 3. AUTO-SYNC: insert leave_balances สำหรับพนักงานทุกคน quota จริง
    await query(`
      INSERT INTO leave_balances (
        employee_id, leave_type_id, year, total_days, used_days, created_at, updated_at
      )
      SELECT 
        e.id, p.leave_type_id, p.year, p.default_days, 0, NOW(), NOW()
      FROM employees e
      JOIN leave_policies p ON p.leave_type_id = $1 AND p.year = $2
      WHERE NOT EXISTS (
        SELECT 1 FROM leave_balances lb
        WHERE lb.employee_id = e.id
          AND lb.leave_type_id = p.leave_type_id
          AND lb.year = p.year
      )
    `, [newLeaveType[0].id, year]);

    console.log('✅ [LEAVE TYPE] Created new leave type:', {
      code: newLeaveType[0].code,
      name_th: newLeaveType[0].name_th,
      allow_hourly_leave: newLeaveType[0].allow_hourly_leave
    });

    return successResponse({
      success: true,
      leave_type: newLeaveType[0]
    });

  } catch (error: any) {
    console.error('Create leave type error:', error);
    return errorResponse(error.message || 'Failed to create leave type', 500);
  }
};

export const handler: Handler = requireAuth(createLeaveType);
