import { Handler } from '@netlify/functions';
import { handleCORS, successResponse, errorResponse } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { query } from './utils/db';

interface DepartmentPermission {
    id: string;
    employee_id: string;
    department_id: string;
    department_name_th?: string;
    department_name_en?: string;
    permission_type: string;
    is_active: boolean;
}

const departmentPermissionsHandler = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const userId = event.user?.userId;
    const userRole = event.user?.role;

    if (!userId) {
        return errorResponse('Unauthorized', 401);
    }

    // Only HR and Admin can manage department permissions
    if (!['hr', 'admin'].includes(userRole || '')) {
        return errorResponse('Only HR and Admin can manage department permissions', 403);
    }

    try {
        // GET - Fetch permissions for an employee
        if (event.httpMethod === 'GET') {
            const employeeId = event.queryStringParameters?.employee_id;

            if (!employeeId) {
                return errorResponse('employee_id is required', 400);
            }

            const permissions = await query(
                `SELECT 
          edp.id,
          edp.employee_id,
          edp.department_id,
          d.name_th as department_name_th,
          d.name_en as department_name_en,
          edp.permission_type,
          edp.is_active,
          edp.granted_at,
          edp.notes
        FROM employee_department_permissions edp
        LEFT JOIN departments d ON edp.department_id = d.id
        WHERE edp.employee_id = $1 AND edp.is_active = true
        ORDER BY d.name_th`,
                [employeeId]
            );

            return successResponse({
                permissions,
                employee_id: employeeId
            });
        }

        // POST - Add department permission
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { employee_id, department_id, permission_type = 'approve', notes } = body;

            if (!employee_id || !department_id) {
                return errorResponse('employee_id and department_id are required', 400);
            }

            // Check if permission already exists
            const existing = await query(
                `SELECT id FROM employee_department_permissions 
         WHERE employee_id = $1 AND department_id = $2 AND permission_type = $3`,
                [employee_id, department_id, permission_type]
            );

            if (existing.length > 0) {
                // Reactivate if exists but inactive
                await query(
                    `UPDATE employee_department_permissions 
           SET is_active = true, updated_at = NOW(), granted_by = $1, granted_at = NOW()
           WHERE id = $2`,
                    [userId, existing[0].id]
                );

                return successResponse({
                    message: 'Permission reactivated',
                    permission_id: existing[0].id
                });
            }

            // Create new permission
            const result = await query(
                `INSERT INTO employee_department_permissions 
         (employee_id, department_id, permission_type, granted_by, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
                [employee_id, department_id, permission_type, userId, notes]
            );

            return successResponse({
                message: 'Permission granted',
                permission_id: result[0].id
            });
        }

        // DELETE - Remove department permission
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body || '{}');
            const { employee_id, department_id, permission_type = 'approve' } = body;

            if (!employee_id || !department_id) {
                return errorResponse('employee_id and department_id are required', 400);
            }

            // Soft delete - set is_active to false
            await query(
                `UPDATE employee_department_permissions 
         SET is_active = false, updated_at = NOW()
         WHERE employee_id = $1 AND department_id = $2 AND permission_type = $3`,
                [employee_id, department_id, permission_type]
            );

            return successResponse({
                message: 'Permission revoked'
            });
        }

        // PUT - Bulk update permissions
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body || '{}');
            const { employee_id, department_ids, permission_type = 'approve' } = body;

            if (!employee_id || !Array.isArray(department_ids)) {
                return errorResponse('employee_id and department_ids array are required', 400);
            }

            // Deactivate all current permissions of this type
            await query(
                `UPDATE employee_department_permissions 
         SET is_active = false, updated_at = NOW()
         WHERE employee_id = $1 AND permission_type = $2`,
                [employee_id, permission_type]
            );

            // Add/reactivate selected departments
            for (const deptId of department_ids) {
                const existing = await query(
                    `SELECT id FROM employee_department_permissions 
           WHERE employee_id = $1 AND department_id = $2 AND permission_type = $3`,
                    [employee_id, deptId, permission_type]
                );

                if (existing.length > 0) {
                    await query(
                        `UPDATE employee_department_permissions 
             SET is_active = true, updated_at = NOW(), granted_by = $1, granted_at = NOW()
             WHERE id = $2`,
                        [userId, existing[0].id]
                    );
                } else {
                    await query(
                        `INSERT INTO employee_department_permissions 
             (employee_id, department_id, permission_type, granted_by)
             VALUES ($1, $2, $3, $4)`,
                        [employee_id, deptId, permission_type, userId]
                    );
                }
            }

            return successResponse({
                message: `${department_ids.length} department permissions updated`,
                department_count: department_ids.length
            });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error: any) {
        console.error('Department permissions error:', error);
        return errorResponse(error.message || 'Failed to manage department permissions', 500);
    }
};

export const handler: Handler = requireAuth(departmentPermissionsHandler);
