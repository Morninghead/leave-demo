import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const updateEmployee = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;
  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  const employeeId = event.path.split('/').pop();
  if (!employeeId) {
    return errorResponse('Employee ID is required', 400);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      first_name_th,
      last_name_th,
      first_name_en,
      last_name_en,
      email,
      phone_number,
      department_id,
      position_th,
      position_en,
      role,
      birth_date,
      hire_date,
      national_id,
      address_th,
      address_en,
      emergency_contact_name,
      emergency_contact_phone,
      status,
      is_department_admin,
      is_department_manager,
    } = body;

    // ตรวจสอบ email ซ้ำ (ยกเว้น employee คนนี้)
    if (email) {
      const checkEmailSql = `SELECT id FROM employees WHERE email = $1 AND id != $2`;
      const existingEmail = await query(checkEmailSql, [email, employeeId]);
      if (existingEmail.length > 0) {
        return errorResponse('Email already exists', 400);
      }
    }

    // สร้าง dynamic SQL update
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = {
      first_name_th,
      last_name_th,
      first_name_en,
      last_name_en,
      email,
      phone_number,
      department_id,
      position_th,
      position_en,
      role,
      birth_date,
      hire_date,
      national_id,
      address_th,
      address_en,
      emergency_contact_name,
      emergency_contact_phone,
      status,
      is_department_admin,
      is_department_manager,
    };

    // เพิ่มเฉพาะ fields ที่มีค่า
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    // เพิ่ม updated_at
    updates.push(`updated_at = NOW()`);

    // เพิ่ม employee_id
    values.push(employeeId);

    const updateSql = `
      UPDATE employees
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateSql, values);

    if (result.length === 0) {
      return errorResponse('Employee not found', 404);
    }

    return successResponse({
      employee: result[0],
      message: 'Employee updated successfully',
    });
  } catch (error: any) {
    console.error('Update employee error:', error);
    return errorResponse(error.message || 'Failed to update employee', 500);
  }
};

export const handler: Handler = requireAuth(updateEmployee);
