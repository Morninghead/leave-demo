// netlify/functions/subcontract-employees.ts
// API endpoint for Subcontract Employees CRUD operations

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { verifyToken } from './utils/jwt';

const sql = neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    try {
        // Verify authentication
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Unauthorized' }),
            };
        }

        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        if (!payload) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid token' }),
            };
        }

        const path = event.path.replace('/.netlify/functions/subcontract-employees', '');
        const pathParts = path.split('/').filter(Boolean);

        // GET /subcontract-employees/companies - Get unique company names
        if (event.httpMethod === 'GET' && pathParts[0] === 'companies') {
            const result = await sql`
        SELECT DISTINCT company_name 
        FROM subcontract_employees 
        WHERE is_active = true
        ORDER BY company_name ASC
      `;

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    companies: result.map((r: any) => r.company_name),
                }),
            };
        }

        // GET /subcontract-employees - List all employees
        if (event.httpMethod === 'GET' && pathParts.length === 0) {
            const params = event.queryStringParameters || {};

            let query = `
        SELECT se.*, 
               ml.code as line_code, 
               ml.name_th as line_name_th,
               ml.name_en as line_name_en,
               ml.category as line_category
        FROM subcontract_employees se
        LEFT JOIN manufacturing_lines ml ON se.line_id = ml.id
        WHERE 1=1
      `;
            const queryParams: any[] = [];
            let paramIndex = 1;

            if (params.line_id) {
                query += ` AND se.line_id = $${paramIndex}`;
                queryParams.push(params.line_id);
                paramIndex++;
            }

            if (params.shift) {
                query += ` AND se.shift = $${paramIndex}`;
                queryParams.push(params.shift);
                paramIndex++;
            }

            if (params.company_name) {
                query += ` AND se.company_name = $${paramIndex}`;
                queryParams.push(params.company_name);
                paramIndex++;
            }

            if (params.active_only === 'true') {
                query += ` AND se.is_active = true`;
            }

            if (params.search) {
                query += ` AND (
          se.employee_code ILIKE $${paramIndex} OR
          se.first_name_th ILIKE $${paramIndex} OR
          se.last_name_th ILIKE $${paramIndex} OR
          se.first_name_en ILIKE $${paramIndex} OR
          se.last_name_en ILIKE $${paramIndex} OR
          se.nickname ILIKE $${paramIndex}
        )`;
                queryParams.push(`%${params.search}%`);
                paramIndex++;
            }

            query += ` ORDER BY se.first_name_th ASC, se.last_name_th ASC`;

            const employees = await sql(query, queryParams);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, employees }),
            };
        }

        // GET /subcontract-employees/:id - Get single employee
        if (event.httpMethod === 'GET' && pathParts.length === 1) {
            const id = pathParts[0];

            const employees = await sql`
        SELECT se.*, 
               ml.code as line_code, 
               ml.name_th as line_name_th,
               ml.name_en as line_name_en
        FROM subcontract_employees se
        LEFT JOIN manufacturing_lines ml ON se.line_id = ml.id
        WHERE se.id = ${id}
      `;

            if (employees.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Employee not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, employee: employees[0] }),
            };
        }

        // POST /subcontract-employees - Create new employee
        if (event.httpMethod === 'POST' && pathParts.length === 0) {
            // Check permission
            if (!['hr', 'admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            const body = JSON.parse(event.body || '{}');
            const {
                employee_code,
                first_name_th,
                last_name_th,
                first_name_en,
                last_name_en,
                nickname,
                company_name,
                company_code,
                line_id,
                shift,
                position_th,
                position_en,
                phone_number,
                photo_url,
                national_id,
                hire_date,
                end_date,
                hourly_rate,
                notes,
                is_active = true,
            } = body;

            // Validation
            if (!employee_code || !first_name_th || !last_name_th || !company_name || !shift || !hire_date) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: 'Required fields: employee_code, first_name_th, last_name_th, company_name, shift, hire_date',
                    }),
                };
            }

            // Check for duplicate code
            const existing = await sql`
        SELECT id FROM subcontract_employees WHERE employee_code = ${employee_code}
      `;

            if (existing.length > 0) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Employee code already exists' }),
                };
            }

            const result = await sql`
        INSERT INTO subcontract_employees (
          employee_code, first_name_th, last_name_th, first_name_en, last_name_en,
          nickname, company_name, company_code, line_id, shift,
          position_th, position_en, phone_number, photo_url, national_id,
          hire_date, end_date, hourly_rate, notes, is_active, created_by
        ) VALUES (
          ${employee_code}, ${first_name_th}, ${last_name_th}, 
          ${first_name_en || null}, ${last_name_en || null},
          ${nickname || null}, ${company_name}, ${company_code || null}, 
          ${line_id || null}, ${shift},
          ${position_th || null}, ${position_en || null}, 
          ${phone_number || null}, ${photo_url || null}, ${national_id || null},
          ${hire_date}, ${end_date || null}, ${hourly_rate || null}, 
          ${notes || null}, ${is_active}, ${payload.userId}
        )
        RETURNING *
      `;

            return {
                statusCode: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    employee: result[0],
                    message: 'Subcontract employee created successfully',
                }),
            };
        }

        // PUT /subcontract-employees/:id/deactivate - Deactivate employee
        if (event.httpMethod === 'PUT' && pathParts.length === 2 && pathParts[1] === 'deactivate') {
            const id = pathParts[0];

            // Check permission
            if (!['hr', 'admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            const result = await sql`
        UPDATE subcontract_employees 
        SET is_active = false, 
            end_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

            if (result.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Employee not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    employee: result[0],
                    message: 'Employee deactivated successfully',
                }),
            };
        }

        // PUT /subcontract-employees/:id - Update employee
        if (event.httpMethod === 'PUT' && pathParts.length === 1) {
            const id = pathParts[0];

            // Check permission
            if (!['hr', 'admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            const body = JSON.parse(event.body || '{}');

            // Build dynamic update
            const allowedFields = [
                'employee_code', 'first_name_th', 'last_name_th', 'first_name_en', 'last_name_en',
                'nickname', 'company_name', 'company_code', 'line_id', 'shift',
                'position_th', 'position_en', 'phone_number', 'photo_url', 'national_id',
                'hire_date', 'end_date', 'hourly_rate', 'notes', 'is_active',
            ];

            const updates: { [key: string]: any } = {};
            for (const field of allowedFields) {
                if (body[field] !== undefined) {
                    updates[field] = body[field];
                }
            }

            if (Object.keys(updates).length === 0) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'No fields to update' }),
                };
            }

            // If updating code, check for duplicates
            if (updates.employee_code) {
                const existing = await sql`
          SELECT id FROM subcontract_employees 
          WHERE employee_code = ${updates.employee_code} AND id != ${id}
        `;

                if (existing.length > 0) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ success: false, error: 'Employee code already exists' }),
                    };
                }
            }

            // Build update query
            const setClauses = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`);
            setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
            const values = [...Object.values(updates), id];

            const query = `
        UPDATE subcontract_employees 
        SET ${setClauses.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

            const result = await sql(query, values);

            if (result.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Employee not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    employee: result[0],
                    message: 'Employee updated successfully',
                }),
            };
        }

        // DELETE /subcontract-employees/:id - Hard delete (admin only)
        if (event.httpMethod === 'DELETE' && pathParts.length === 1) {
            const id = pathParts[0];

            // Only admin can hard delete
            if (!['admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            // Check if employee has attendance records
            const hasAttendance = await sql`
        SELECT id FROM line_attendance_details 
        WHERE subcontract_employee_id = ${id}
        LIMIT 1
      `;

            if (hasAttendance.length > 0) {
                // Soft delete instead
                await sql`
          UPDATE subcontract_employees 
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
        `;

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        message: 'Employee deactivated (has attendance records)',
                    }),
                };
            }

            // Hard delete if no records
            await sql`DELETE FROM subcontract_employees WHERE id = ${id}`;

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    message: 'Employee deleted successfully',
                }),
            };
        }

        // Method not allowed
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };

    } catch (error: any) {
        console.error('Subcontract employees error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error',
            }),
        };
    }
};

export { handler };
