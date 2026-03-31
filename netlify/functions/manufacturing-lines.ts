// netlify/functions/manufacturing-lines.ts
// API endpoint for Manufacturing Lines CRUD operations

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

        const path = event.path.replace('/.netlify/functions/manufacturing-lines', '');
        const pathParts = path.split('/').filter(Boolean);

        // GET /manufacturing-lines - List all lines
        if (event.httpMethod === 'GET' && pathParts.length === 0) {
            const params = event.queryStringParameters || {};

            let query = `
                SELECT ml.*, 
                       e.first_name_th as leader_first_name_th, e.last_name_th as leader_last_name_th,
                       e.first_name_en as leader_first_name_en, e.last_name_en as leader_last_name_en
                FROM manufacturing_lines ml
                LEFT JOIN employees e ON ml.line_leader_id = e.id
                WHERE 1=1
            `;
            const queryParams: any[] = [];
            let paramIndex = 1;

            if (params.category) {
                query += ` AND ml.category = $${paramIndex}`;
                queryParams.push(params.category);
                paramIndex++;
            }

            if (params.active_only === 'true') {
                query += ` AND ml.is_active = true`;
            }

            query += ` ORDER BY ml.sort_order ASC, ml.code ASC`;

            const lines = await sql(query, queryParams);

            // Transform result to include formatted leader name
            const mappedLines = lines.map((line: any) => ({
                ...line,
                line_leader_name: line.leader_first_name_th
                    ? `${line.leader_first_name_th} ${line.leader_last_name_th}`
                    : (line.leader_first_name_en ? `${line.leader_first_name_en} ${line.leader_last_name_en}` : null)
            }));

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, lines: mappedLines }),
            };
        }

        // GET /manufacturing-lines/:id - Get single line
        if (event.httpMethod === 'GET' && pathParts.length === 1) {
            const id = pathParts[0];

            const lines = await sql`
        SELECT * FROM manufacturing_lines WHERE id = ${id}
      `;

            if (lines.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, line: lines[0] }),
            };
        }

        // POST /manufacturing-lines - Create new line
        if (event.httpMethod === 'POST' && pathParts.length === 0) {
            // Check permission (HR/Admin only)
            if (!['hr', 'admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            const body = JSON.parse(event.body || '{}');
            const {
                code,
                name_th,
                name_en,
                category,
                headcount_day = 0,
                headcount_night_ab = 0,
                headcount_night_cd = 0,
                description,
                sort_order = 0,
                is_active = true,
            } = body;

            if (!code || !category) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Code and category are required' }),
                };
            }

            // Check for duplicate code
            const existing = await sql`
        SELECT id FROM manufacturing_lines WHERE code = ${code}
      `;

            if (existing.length > 0) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line code already exists' }),
                };
            }

            const result = await sql`
        INSERT INTO manufacturing_lines (
          code, name_th, name_en, category, 
          headcount_day, headcount_night_ab, headcount_night_cd,
          description, sort_order, is_active
        ) VALUES (
          ${code}, ${name_th || null}, ${name_en || null}, ${category},
          ${headcount_day}, ${headcount_night_ab}, ${headcount_night_cd},
          ${description || null}, ${sort_order}, ${is_active}
        )
        RETURNING *
      `;

            return {
                statusCode: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    line: result[0],
                    message: 'Manufacturing line created successfully',
                }),
            };
        }

        // PUT /manufacturing-lines/bulk-headcount - Bulk update headcount
        if (event.httpMethod === 'PUT' && pathParts[0] === 'bulk-headcount') {
            // Check permission
            if (!['hr', 'admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            const body = JSON.parse(event.body || '{}');
            const { updates } = body;

            if (!Array.isArray(updates) || updates.length === 0) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Updates array is required' }),
                };
            }

            let updatedCount = 0;

            for (const update of updates) {
                const { id, headcount_day, headcount_night_ab, headcount_night_cd, line_leader_id } = update;

                if (!id) continue;

                const setClauses: string[] = [];
                const values: any[] = [];
                let paramIdx = 1;

                if (headcount_day !== undefined) {
                    setClauses.push(`headcount_day = $${paramIdx}`);
                    values.push(headcount_day);
                    paramIdx++;
                }

                if (headcount_night_ab !== undefined) {
                    setClauses.push(`headcount_night_ab = $${paramIdx}`);
                    values.push(headcount_night_ab);
                    paramIdx++;
                }

                if (headcount_night_cd !== undefined) {
                    setClauses.push(`headcount_night_cd = $${paramIdx}`);
                    values.push(headcount_night_cd);
                    paramIdx++;
                }

                if (line_leader_id !== undefined) {
                    setClauses.push(`line_leader_id = $${paramIdx}`);
                    values.push(line_leader_id);
                    paramIdx++;
                }

                if (setClauses.length > 0) {
                    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
                    values.push(id);

                    const query = `
            UPDATE manufacturing_lines 
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIdx}
          `;

                    await sql(query, values);
                    updatedCount++;
                }
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    updated: updatedCount,
                    message: `Updated ${updatedCount} line(s)`,
                }),
            };
        }

        // PUT /manufacturing-lines/:id - Update line
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
            const updates: { [key: string]: any } = {};
            const allowedFields = [
                'code', 'name_th', 'name_en', 'category',
                'headcount_day', 'headcount_night_ab', 'headcount_night_cd',
                'description', 'sort_order', 'is_active', 'line_leader_id'
            ];

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
            if (updates.code) {
                const existing = await sql`
          SELECT id FROM manufacturing_lines 
          WHERE code = ${updates.code} AND id != ${id}
        `;

                if (existing.length > 0) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ success: false, error: 'Line code already exists' }),
                    };
                }
            }

            // Build update query
            const setClauses = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`);
            setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
            const values = [...Object.values(updates), id];

            const query = `
        UPDATE manufacturing_lines 
        SET ${setClauses.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

            const result = await sql(query, values);

            if (result.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    line: result[0],
                    message: 'Manufacturing line updated successfully',
                }),
            };
        }

        // DELETE /manufacturing-lines/:id - Delete line
        if (event.httpMethod === 'DELETE' && pathParts.length === 1) {
            const id = pathParts[0];

            // Check permission (Admin only)
            if (!['admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            // Soft delete (set is_active to false)
            const result = await sql`
        UPDATE manufacturing_lines 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

            if (result.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    message: 'Manufacturing line deactivated successfully',
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
        console.error('Manufacturing lines error:', error);
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
