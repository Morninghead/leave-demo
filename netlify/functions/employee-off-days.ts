// netlify/functions/employee-off-days.ts
// CRUD API for managing employee off-days (alternating Saturdays, etc.)

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

// DEV_CODE - special employee code with superuser access
const DEV_CODE = '999999999';

// Check if user is HR or DEV (by role OR employee_code)
const isHROrDev = (userRole: string | undefined, employeeCode: string | undefined): boolean => {
    if (!userRole) return false;
    if (userRole === 'hr' || userRole === 'dev') return true;
    // Check employee_code for 999999999 (Dev account)
    return String(employeeCode || '').trim() === DEV_CODE;
};

const employeeOffDaysHandler = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const method = event.httpMethod;
    const userId = event.user?.userId;
    const userRole = event.user?.role;
    const employeeCode = event.user?.employeeCode;

    if (!userId) {
        return errorResponse('User ID not found', 400);
    }

    try {
        // GET - Fetch off-days
        if (method === 'GET') {
            const params = event.queryStringParameters || {};
            const {
                employee_id,
                start_date,
                end_date,
                department_id,
                off_type,
            } = params;

            // Access control - HR, dev role, or employee_code 999999999 can view all
            const canViewAll = isHROrDev(userRole, employeeCode);
            // Note: employee IDs are UUIDs (strings), not integers
            const requestedEmployeeId = employee_id ? String(employee_id).trim() : String(userId).trim();

            // Regular employees can only view their own off-days (using string comparison for UUIDs)
            if (!canViewAll && requestedEmployeeId !== String(userId).trim()) {
                return errorResponse('Unauthorized: Can only view own off-days', 403);
            }

            // Build query
            let sql = `
        SELECT 
          eod.*,
          e.employee_code,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
          e.department_id,
          d.name_en as department_name_en,
          d.name_th as department_name_th,
          creator.employee_code as created_by_code,
          CONCAT(creator.first_name_en, ' ', creator.last_name_en) as created_by_name
        FROM employee_off_days eod
        JOIN employees e ON eod.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN employees creator ON eod.created_by = creator.id
        WHERE 1=1
      `;

            const queryParams: any[] = [];
            let paramIndex = 1;

            // Filter by employee
            // ✅ FIX: Always filter by userId when no employee_id is provided
            // This ensures personal dashboard widgets show only the current user's off-days
            // HR/Dev can still view all employees by passing employee_id explicitly or using management page
            if (employee_id) {
                // Explicitly requested specific employee (employee_id is UUID string)
                sql += ` AND eod.employee_id = $${paramIndex}`;
                queryParams.push(employee_id);
                paramIndex++;
            } else {
                // No employee_id provided - show current user's off-days only
                // This applies to ALL users including HR/Dev for dashboard widgets
                sql += ` AND eod.employee_id = $${paramIndex}`;
                queryParams.push(userId);
                paramIndex++;
            }

            // Filter by date range
            if (start_date) {
                sql += ` AND eod.off_date >= $${paramIndex}`;
                queryParams.push(start_date);
                paramIndex++;
            }

            if (end_date) {
                sql += ` AND eod.off_date <= $${paramIndex}`;
                queryParams.push(end_date);
                paramIndex++;
            }

            // Filter by department (HR/dev only)
            if (department_id && canViewAll) {
                sql += ` AND e.department_id = $${paramIndex}`;
                queryParams.push(department_id);
                paramIndex++;
            }

            // Filter by off type
            if (off_type) {
                sql += ` AND eod.off_type = $${paramIndex}`;
                queryParams.push(off_type);
                paramIndex++;
            }

            sql += ` ORDER BY eod.off_date ASC`;

            const offDays = await query(sql, queryParams);

            return successResponse({
                success: true,
                off_days: offDays,
                total: offDays.length,
            });
        }

        // POST - Create new off-day (HR/dev only)
        if (method === 'POST') {
            if (!isHROrDev(userRole, employeeCode)) {
                return errorResponse('Unauthorized: HR or dev role required', 403);
            }

            const body = JSON.parse(event.body || '{}');
            const { employee_id, off_date, off_type, notes } = body;

            // Validation
            if (!employee_id || !off_date) {
                return errorResponse('employee_id and off_date are required', 400);
            }

            // Check if employee exists
            const employeeCheck = await query(
                'SELECT id FROM employees WHERE id = $1',
                [employee_id]
            );

            if (employeeCheck.length === 0) {
                return errorResponse('Employee not found', 404);
            }

            // Insert off-day
            const insertSql = `
        INSERT INTO employee_off_days 
          (employee_id, off_date, off_type, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

            const result = await query(insertSql, [
                employee_id,
                off_date,
                off_type || 'alternating_saturday',
                notes || null,
                userId,
            ]);

            return successResponse({
                success: true,
                message: 'Off-day created successfully',
                off_day: result[0],
            }, 201);
        }

        // PUT - Update off-day (HR/dev only)
        if (method === 'PUT') {
            if (!isHROrDev(userRole, employeeCode)) {
                return errorResponse('Unauthorized: HR or dev role required', 403);
            }

            const pathParts = event.path.split('/');
            const offDayId = pathParts[pathParts.length - 1];

            if (!offDayId || offDayId === 'employee-off-days') {
                return errorResponse('Off-day ID required in path', 400);
            }

            const body = JSON.parse(event.body || '{}');
            const { off_date, off_type, notes } = body;

            // Build update query dynamically
            const updates: string[] = [];
            const updateParams: any[] = [];
            let paramIndex = 1;

            if (off_date) {
                updates.push(`off_date = $${paramIndex}`);
                updateParams.push(off_date);
                paramIndex++;
            }

            if (off_type) {
                updates.push(`off_type = $${paramIndex}`);
                updateParams.push(off_type);
                paramIndex++;
            }

            if (notes !== undefined) {
                updates.push(`notes = $${paramIndex}`);
                updateParams.push(notes);
                paramIndex++;
            }

            if (updates.length === 0) {
                return errorResponse('No fields to update', 400);
            }

            updateParams.push(offDayId);

            const updateSql = `
        UPDATE employee_off_days
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

            const result = await query(updateSql, updateParams);

            if (result.length === 0) {
                return errorResponse('Off-day not found', 404);
            }

            return successResponse({
                success: true,
                message: 'Off-day updated successfully',
                off_day: result[0],
            });
        }

        // DELETE - Delete off-day (HR/dev only)
        if (method === 'DELETE') {
            if (!isHROrDev(userRole, employeeCode)) {
                return errorResponse('Unauthorized: HR or dev role required', 403);
            }

            const pathParts = event.path.split('/');
            const offDayId = pathParts[pathParts.length - 1];

            if (!offDayId || offDayId === 'employee-off-days') {
                return errorResponse('Off-day ID required in path', 400);
            }

            const deleteSql = 'DELETE FROM employee_off_days WHERE id = $1 RETURNING *';
            const result = await query(deleteSql, [offDayId]);

            if (result.length === 0) {
                return errorResponse('Off-day not found', 404);
            }

            return successResponse({
                success: true,
                message: 'Off-day deleted successfully',
                deleted_off_day: result[0],
            });
        }

        return errorResponse('Method not allowed', 405);

    } catch (error: any) {
        console.error('Employee off-days error:', error);
        return errorResponse(error.message || 'Failed to process request', 500);
    }
};

export const handler: Handler = requireAuth(employeeOffDaysHandler);
