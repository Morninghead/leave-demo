import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const updateLeaveType = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userRole = event.user?.role;

    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    const {
      id,
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

    if (!id) {
      return errorResponse('Missing required field: id', 400);
    }

    // Check if leave type exists
    const existing = await query(
      'SELECT * FROM leave_types WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return errorResponse('Leave type not found', 404);
    }

    // If code is being changed, check for duplicates
    if (code && code.toUpperCase() !== existing[0].code) {
      const duplicateCode = await query(
        'SELECT id FROM leave_types WHERE code = $1 AND id != $2',
        [code.toUpperCase(), id]
      );

      if (duplicateCode.length > 0) {
        return errorResponse('Leave type code already exists', 409);
      }
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (code !== undefined) {
      updates.push(`code = $${paramCount++}`);
      values.push(code.toUpperCase());
    }
    if (name_th !== undefined) {
      updates.push(`name_th = $${paramCount++}`);
      values.push(name_th);
    }
    if (name_en !== undefined) {
      updates.push(`name_en = $${paramCount++}`);
      values.push(name_en);
    }
    if (description_th !== undefined) {
      updates.push(`description_th = $${paramCount++}`);
      values.push(description_th || null);
    }
    if (description_en !== undefined) {
      updates.push(`description_en = $${paramCount++}`);
      values.push(description_en || null);
    }
    if (default_days !== undefined) {
      updates.push(`default_days = $${paramCount++}`);
      values.push(Number(default_days));
    }
    if (requires_attachment !== undefined) {
      updates.push(`requires_attachment = $${paramCount++}`);
      values.push(requires_attachment);
    }
    if (is_paid !== undefined) {
      updates.push(`is_paid = $${paramCount++}`);
      values.push(is_paid);
    }
    if (color_code !== undefined) {
      updates.push(`color_code = $${paramCount++}`);
      values.push(color_code);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (allow_hourly_leave !== undefined) {
      updates.push(`allow_hourly_leave = $${paramCount++}`);
      values.push(allow_hourly_leave);
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) { // Only updated_at
      return errorResponse('No fields to update', 400);
    }

    // Add id as the last parameter
    values.push(id);

    const updatedLeaveType = await query(
      `UPDATE leave_types
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    console.log('✅ [LEAVE TYPE] Updated leave type:', {
      id: updatedLeaveType[0].id,
      code: updatedLeaveType[0].code,
      name_th: updatedLeaveType[0].name_th,
      allow_hourly_leave: updatedLeaveType[0].allow_hourly_leave
    });

    return successResponse({
      success: true,
      leave_type: updatedLeaveType[0]
    });

  } catch (error: any) {
    console.error('Update leave type error:', error);
    return errorResponse(error.message || 'Failed to update leave type', 500);
  }
};

export const handler: Handler = requireAuth(updateLeaveType);
