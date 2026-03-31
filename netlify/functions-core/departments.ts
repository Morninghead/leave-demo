import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const departmentsHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const userRole = event.user?.role;

  // GET - ดึงรายการแผนกทั้งหมด (รองรับ hierarchy)
  if (event.httpMethod === 'GET') {
    try {
      const { include_hierarchy } = event.queryStringParameters || {};

      if (include_hierarchy === 'true') {
        // Return hierarchical structure
        const sql = `
          SELECT
            d.id,
            d.department_code as code,
            d.name_th,
            d.name_en,
            d.description_th,
            d.description_en,
            d.parent_department_id,
            d.level,
            d.sort_order,
            d.is_active,
            d.created_at,
            CASE
              WHEN d.parent_department_id IS NULL THEN d.name_th
              ELSE parent_dept.name_th || ' > ' || d.name_th
            END as hierarchy_name,
            CASE
              WHEN d.parent_department_id IS NULL THEN 0
              ELSE 1
            END as hierarchy_depth,
            COALESCE(emp_count.employee_count, 0) as employee_count
          FROM departments d
          LEFT JOIN departments parent_dept ON d.parent_department_id::text = parent_dept.id::text
          LEFT JOIN (
            SELECT
              department_id,
              COUNT(DISTINCT id) as employee_count
            FROM employees
            WHERE is_active = true
            GROUP BY department_id
          ) emp_count ON d.id = emp_count.department_id
          ORDER BY d.level, d.sort_order, d.name_th
        `;
        const departments = await query(sql);
        return successResponse({ departments, hierarchical: true });
      } else {
        // Return flat structure (backward compatibility)
        const sql = `
          SELECT
            d.id,
            d.department_code as code,
            d.name_th,
            d.name_en,
            d.description_th,
            d.description_en,
            d.parent_department_id,
            d.level,
            d.sort_order,
            d.is_active,
            d.created_at,
            COUNT(DISTINCT e.id) as employee_count
          FROM departments d
          LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = true
          GROUP BY d.id, d.department_code, d.name_th, d.name_en, d.description_th, d.description_en, d.parent_department_id, d.level, d.sort_order, d.is_active, d.created_at
          ORDER BY d.level, d.sort_order, d.name_th
        `;
        const departments = await query(sql);
        return successResponse({ departments, hierarchical: false });
      }
    } catch (error: any) {
      console.error('Get departments error:', error);
      return errorResponse(error.message || 'Failed to get departments', 500);
    }
  }

  // POST - สร้างแผนกใหม่
  if (event.httpMethod === 'POST') {
    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    try {
      const body = JSON.parse(event.body || '{}');
      const { name_th, name_en, code, parent_department_id, level, sort_order } = body;

      if (!name_th || !code) {
        return errorResponse('Required fields are missing', 400);
      }

      // ตรวจสอบ code ซ้ำ
      const checkSql = `SELECT id FROM departments WHERE department_code = $1`;
      const existing = await query(checkSql, [code]);
      if (existing.length > 0) {
        return errorResponse('Department code already exists', 400);
      }

      const insertSql = `
        INSERT INTO departments (name_th, name_en, department_code, parent_department_id, level, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id, department_code as code, name_th, name_en, parent_department_id, level, sort_order, is_active, created_at
      `;
      const result = await query(insertSql, [
        name_th,
        name_en || name_th,
        code,
        parent_department_id || null,
        level || (parent_department_id ? 1 : 0),
        sort_order || 0
      ]);

      return successResponse({
        department: result[0],
        message: 'Department created successfully',
      });
    } catch (error: any) {
      console.error('Create department error:', error);
      return errorResponse(error.message || 'Failed to create department', 500);
    }
  }

  // PUT - แก้ไขแผนก
  if (event.httpMethod === 'PUT') {
    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    const departmentId = event.path.split('/').pop();
    if (!departmentId) {
      return errorResponse('Department ID is required', 400);
    }

    try {
      const body = JSON.parse(event.body || '{}');
      const { name_th, name_en, code, parent_department_id, level, sort_order } = body;

      // ตรวจสอบ code ซ้ำ (ยกเว้นตัวเอง)
      if (code) {
        const checkSql = `SELECT id FROM departments WHERE department_code = $1 AND id != $2`;
        const existing = await query(checkSql, [code, departmentId]);
        if (existing.length > 0) {
          return errorResponse('Department code already exists', 400);
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name_th !== undefined) {
        updates.push(`name_th = $${paramIndex}`);
        values.push(name_th);
        paramIndex++;
      }
      if (name_en !== undefined) {
        updates.push(`name_en = $${paramIndex}`);
        values.push(name_en);
        paramIndex++;
      }
      if (code !== undefined) {
        updates.push(`department_code = $${paramIndex}`);
        values.push(code);
        paramIndex++;
      }
      if (parent_department_id !== undefined) {
        updates.push(`parent_department_id = $${paramIndex}`);
        values.push(parent_department_id || null);
        paramIndex++;
      }
      if (level !== undefined) {
        updates.push(`level = $${paramIndex}`);
        values.push(level);
        paramIndex++;
      }
      if (sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex}`);
        values.push(sort_order);
        paramIndex++;
      }

      if (updates.length === 0) {
        return errorResponse('No fields to update', 400);
      }

      values.push(departmentId);
      const updateSql = `
        UPDATE departments
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, department_code as code, name_th, name_en, parent_department_id, level, sort_order, is_active, created_at
      `;

      const result = await query(updateSql, values);
      if (result.length === 0) {
        return errorResponse('Department not found', 404);
      }

      return successResponse({
        department: result[0],
        message: 'Department updated successfully',
      });
    } catch (error: any) {
      console.error('Update department error:', error);
      return errorResponse(error.message || 'Failed to update department', 500);
    }
  }

  // DELETE - ลบแผนก
  if (event.httpMethod === 'DELETE') {
    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    const departmentId = event.path.split('/').pop();
    if (!departmentId) {
      return errorResponse('Department ID is required', 400);
    }

    try {
      // ตรวจสอบว่ามีพนักงานในแผนกหรือไม่
      const checkSql = `SELECT COUNT(*) as count FROM employees WHERE department_id = $1`;
      const employeeCount = await query(checkSql, [departmentId]);

      if (parseInt(employeeCount[0]?.count || '0') > 0) {
        return errorResponse('Cannot delete department with employees', 400);
      }

      const deleteSql = `DELETE FROM departments WHERE id = $1`;
      await query(deleteSql, [departmentId]);

      return successResponse({ message: 'Department deleted successfully' });
    } catch (error: any) {
      console.error('Delete department error:', error);
      return errorResponse(error.message || 'Failed to delete department', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
};

export const handler: Handler = requireAuth(departmentsHandler);
