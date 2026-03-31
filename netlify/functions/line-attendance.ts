// netlify/functions/line-attendance.ts
// API endpoint for Daily Line Attendance operations

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

// Check if submission is late (after 10 AM)
function isLateSubmission(): boolean {
    const now = new Date();
    // Convert to Bangkok time (UTC+7)
    const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const hours = bangkokTime.getHours();
    return hours >= 10; // After 10 AM is late
}

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

        const path = event.path.replace('/.netlify/functions/line-attendance', '');
        const pathParts = path.split('/').filter(Boolean);

        // GET /line-attendance/summary - Get dashboard summary
        if (event.httpMethod === 'GET' && pathParts[0] === 'summary') {
            const params = event.queryStringParameters || {};
            const { date, shift } = params;

            if (!date || !shift) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Date and shift are required' }),
                };
            }

            // Get summary by category
            const categoryStats = await sql`
        SELECT 
          ml.category,
          COUNT(DISTINCT ml.id) as total_lines,
          COUNT(DISTINCT la.id) as submitted_lines,
          COUNT(DISTINCT CASE WHEN la.is_late THEN la.id END) as late_submissions,
          SUM(COALESCE(la.required_count, 0)) as total_required,
          SUM(COALESCE(la.present_count, 0)) as total_present,
          SUM(COALESCE(la.absent_count, 0)) as total_absent
        FROM manufacturing_lines ml
        LEFT JOIN line_attendance la ON ml.id = la.line_id 
          AND la.attendance_date = ${date} 
          AND la.shift = ${shift}
        WHERE ml.is_active = true
        GROUP BY ml.category
        ORDER BY ml.category
      `;

            // Calculate overall totals
            let totalLines = 0;
            let submittedLines = 0;
            let lateSubmissions = 0;
            let totalRequired = 0;
            let totalPresent = 0;
            let totalAbsent = 0;

            const byCategory = categoryStats.map((cat: any) => {
                totalLines += parseInt(cat.total_lines || 0);
                submittedLines += parseInt(cat.submitted_lines || 0);
                lateSubmissions += parseInt(cat.late_submissions || 0);
                totalRequired += parseInt(cat.total_required || 0);
                totalPresent += parseInt(cat.total_present || 0);
                totalAbsent += parseInt(cat.total_absent || 0);

                const req = parseInt(cat.total_required || 0);
                const pres = parseInt(cat.total_present || 0);

                return {
                    category: cat.category,
                    total_lines: parseInt(cat.total_lines || 0),
                    submitted_lines: parseInt(cat.submitted_lines || 0),
                    late_submissions: parseInt(cat.late_submissions || 0),
                    total_required: req,
                    total_present: pres,
                    total_absent: parseInt(cat.total_absent || 0),
                    attendance_rate: req > 0 ? Math.round((pres / req) * 100) : 0,
                };
            });

            // Get replacement stats
            const replacementStats = await sql`
        SELECT 
          COALESCE(SUM(replacement_requested), 0) as total_requested,
          COALESCE(SUM(replacement_filled), 0) as total_filled
        FROM line_attendance
        WHERE attendance_date = ${date} AND shift = ${shift}
      `;

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    summary: {
                        date,
                        shift,
                        by_category: byCategory,
                        total_lines: totalLines,
                        submitted_lines: submittedLines,
                        pending_lines: totalLines - submittedLines,
                        late_submissions: lateSubmissions,
                        total_required: totalRequired,
                        total_present: totalPresent,
                        total_absent: totalAbsent,
                        overall_attendance_rate: totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 0,
                        total_replacements_requested: parseInt(replacementStats[0]?.total_requested || 0),
                        total_replacements_filled: parseInt(replacementStats[0]?.total_filled || 0),
                    },
                }),
            };
        }

        // GET /line-attendance/status - Get all lines status for a date/shift
        if (event.httpMethod === 'GET' && pathParts[0] === 'status') {
            const params = event.queryStringParameters || {};
            const { date, shift, category } = params;

            if (!date || !shift) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Date and shift are required' }),
                };
            }

            let query = `
        SELECT 
          ml.*,
          e.first_name_th as leader_first_name_th,
          e.last_name_th as leader_last_name_th,
          e.first_name_en as leader_first_name_en,
          e.last_name_en as leader_last_name_en,
          la.id as attendance_id,
          la.status,
          la.is_late,
          la.submitted_at,
          la.required_count,
          la.present_count,
          la.absent_count,
          la.replacement_requested,
          la.replacement_filled
        FROM manufacturing_lines ml
        LEFT JOIN line_attendance la ON ml.id = la.line_id 
          AND la.attendance_date = $1 
          AND la.shift = $2
        LEFT JOIN employees e ON ml.line_leader_id = e.id
        WHERE ml.is_active = true
      `;
            const queryParams: any[] = [date, shift];

            if (category) {
                query += ` AND ml.category = $3`;
                queryParams.push(category);
            }

            query += ` ORDER BY ml.sort_order ASC, ml.code ASC`;

            const lines = await sql(query, queryParams);

            // Get headcount field based on shift
            const headcountField = shift === 'day' ? 'headcount_day'
                : shift === 'night_ab' ? 'headcount_night_ab'
                    : 'headcount_night_cd';

            const result = lines.map((line: any) => ({
                line: {
                    id: line.id,
                    code: line.code,
                    name_th: line.name_th,
                    name_en: line.name_en,
                    category: line.category,
                    headcount_day: line.headcount_day,
                    headcount_night_ab: line.headcount_night_ab,
                    headcount_night_cd: line.headcount_night_cd,
                    line_leader_name_th: line.leader_first_name_th ? `${line.leader_first_name_th} ${line.leader_last_name_th}` : null,
                    line_leader_name_en: line.leader_first_name_en ? `${line.leader_first_name_en} ${line.leader_last_name_en}` : null,
                },
                shift,
                status: line.status || 'not_submitted',
                is_late: line.is_late || false,
                submitted_at: line.submitted_at,
                required_count: line.required_count ?? line[headcountField],
                present_count: line.present_count ?? 0,
                absent_count: line.absent_count ?? 0,
                replacement_requested: line.replacement_requested ?? 0,
                replacement_filled: line.replacement_filled ?? 0,
            }));

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, lines: result }),
            };
        }

        // GET /line-attendance/employees - Get employees for a line/shift
        if (event.httpMethod === 'GET' && pathParts[0] === 'employees') {
            const params = event.queryStringParameters || {};
            const { line_id, shift } = params;

            if (!line_id || !shift) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line ID and shift are required' }),
                };
            }

            const employees = await sql`
        SELECT * FROM subcontract_employees
        WHERE line_id = ${line_id} 
          AND shift = ${shift}
          AND is_active = true
        ORDER BY first_name_th ASC, last_name_th ASC
      `;

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, employees }),
            };
        }

        // GET /line-attendance/history - Get historical attendance records
        if (event.httpMethod === 'GET' && pathParts[0] === 'history') {
            const params = event.queryStringParameters || {};
            const { start_date, end_date, line_id, shift, category } = params;

            if (!start_date || !end_date) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Start date and end date are required' }),
                };
            }

            let query = `
        SELECT la.*,
               ml.code as line_code,
               ml.name_th as line_name_th,
               ml.name_en as line_name_en,
               ml.category as line_category,
               e.first_name_th || ' ' || e.last_name_th as submitted_by_name
        FROM line_attendance la
        JOIN manufacturing_lines ml ON la.line_id = ml.id
        LEFT JOIN employees e ON la.submitted_by = e.id
        WHERE la.attendance_date BETWEEN $1 AND $2
      `;
            const queryParams: any[] = [start_date, end_date];
            let paramIndex = 3;

            if (line_id) {
                query += ` AND la.line_id = $${paramIndex}`;
                queryParams.push(line_id);
                paramIndex++;
            }

            if (shift) {
                query += ` AND la.shift = $${paramIndex}`;
                queryParams.push(shift);
                paramIndex++;
            }

            if (category) {
                query += ` AND ml.category = $${paramIndex}`;
                queryParams.push(category);
                paramIndex++;
            }

            query += ` ORDER BY la.attendance_date DESC, ml.code ASC`;

            const records = await sql(query, queryParams);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, records }),
            };
        }

        // GET /line-attendance - Get attendance for specific line/date/shift
        if (event.httpMethod === 'GET' && pathParts.length === 0) {
            const params = event.queryStringParameters || {};
            const { line_id, date, shift } = params;

            if (!line_id || !date || !shift) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line ID, date, and shift are required' }),
                };
            }

            const attendance = await sql`
        SELECT la.*,
               ml.code as line_code,
               ml.name_th as line_name_th,
               ml.name_en as line_name_en
        FROM line_attendance la
        JOIN manufacturing_lines ml ON la.line_id = ml.id
        WHERE la.line_id = ${line_id}
          AND la.attendance_date = ${date}
          AND la.shift = ${shift}
      `;

            if (attendance.length === 0) {
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: true, attendance: null }),
                };
            }

            // Get details
            const details = await sql`
        SELECT lad.*,
               se.employee_code,
               se.first_name_th,
               se.last_name_th,
               se.nickname,
               se.company_name
        FROM line_attendance_details lad
        JOIN subcontract_employees se ON lad.subcontract_employee_id = se.id
        WHERE lad.line_attendance_id = ${attendance[0].id}
      `;

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    attendance: {
                        ...attendance[0],
                        details,
                    },
                }),
            };
        }

        // POST /line-attendance/submit - Submit attendance
        if (event.httpMethod === 'POST' && pathParts[0] === 'submit') {
            const body = JSON.parse(event.body || '{}');
            const {
                line_id,
                attendance_date,
                shift,
                employees,
                replacement_requested = 0,
                replacement_notes,
                notes,
            } = body;

            // Validation
            if (!line_id || !attendance_date || !shift || !Array.isArray(employees)) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: 'Required: line_id, attendance_date, shift, employees array',
                    }),
                };
            }

            // Get line headcount for this shift
            const lineData = await sql`
        SELECT * FROM manufacturing_lines WHERE id = ${line_id}
      `;

            if (lineData.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Line not found' }),
                };
            }

            const line = lineData[0];
            const headcountField = shift === 'day' ? 'headcount_day'
                : shift === 'night_ab' ? 'headcount_night_ab'
                    : 'headcount_night_cd';
            const requiredCount = line[headcountField];

            // Count present/absent
            const presentCount = employees.filter((e: any) => e.is_present).length;
            const absentCount = employees.filter((e: any) => !e.is_present).length;

            // Check if late
            const isLate = isLateSubmission();

            // Check for existing record
            const existing = await sql`
        SELECT id FROM line_attendance
        WHERE line_id = ${line_id}
          AND attendance_date = ${attendance_date}
          AND shift = ${shift}
      `;

            let attendanceId: string;

            if (existing.length > 0) {
                // Update existing
                attendanceId = existing[0].id;

                await sql`
          UPDATE line_attendance SET
            required_count = ${requiredCount},
            present_count = ${presentCount},
            absent_count = ${absentCount},
            replacement_requested = ${replacement_requested},
            replacement_notes = ${replacement_notes || null},
            notes = ${notes || null},
            submitted_by = ${payload.userId},
            submitted_at = CURRENT_TIMESTAMP,
            status = 'submitted',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${attendanceId}
        `;

                // Delete old details
                await sql`DELETE FROM line_attendance_details WHERE line_attendance_id = ${attendanceId}`;
            } else {
                // Create new
                const result = await sql`
          INSERT INTO line_attendance (
            line_id, attendance_date, shift,
            required_count, present_count, absent_count,
            replacement_requested, replacement_notes, notes,
            submitted_by, submitted_at, is_late, status
          ) VALUES (
            ${line_id}, ${attendance_date}, ${shift},
            ${requiredCount}, ${presentCount}, ${absentCount},
            ${replacement_requested}, ${replacement_notes || null}, ${notes || null},
            ${payload.userId}, CURRENT_TIMESTAMP, ${isLate}, 'submitted'
          )
          RETURNING id
        `;

                attendanceId = result[0].id;
            }

            // Insert details
            for (const emp of employees) {
                await sql`
          INSERT INTO line_attendance_details (
            line_attendance_id, subcontract_employee_id,
            is_present, check_in_time, check_out_time,
            absence_reason, absence_notes,
            is_replacement, replacing_for
          ) VALUES (
            ${attendanceId}, ${emp.subcontract_employee_id},
            ${emp.is_present}, ${emp.check_in_time || null}, ${emp.check_out_time || null},
            ${emp.absence_reason || null}, ${emp.absence_notes || null},
            ${emp.is_replacement || false}, ${emp.replacing_for || null}
          )
        `;
            }

            // Get the final record
            const finalAttendance = await sql`
        SELECT la.*,
               ml.code as line_code,
               e.first_name_th || ' ' || e.last_name_th as submitted_by_name
        FROM line_attendance la
        JOIN manufacturing_lines ml ON la.line_id = ml.id
        LEFT JOIN employees e ON la.submitted_by = e.id
        WHERE la.id = ${attendanceId}
      `;

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    attendance: finalAttendance[0],
                    message: isLate
                        ? 'Attendance submitted (LATE)'
                        : 'Attendance submitted successfully',
                    is_late: isLate,
                }),
            };
        }

        // PUT /line-attendance/:id/confirm - Confirm attendance (HR only)
        if (event.httpMethod === 'PUT' && pathParts.length === 2 && pathParts[1] === 'confirm') {
            const id = pathParts[0];

            // Only HR/Admin can confirm
            if (!['hr', 'admin', 'dev'].includes(payload.role?.toLowerCase() || '')) {
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Permission denied' }),
                };
            }

            const result = await sql`
        UPDATE line_attendance SET
          status = 'confirmed',
          confirmed_by = ${payload.userId},
          confirmed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

            if (result.length === 0) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ success: false, error: 'Attendance record not found' }),
                };
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    attendance: result[0],
                    message: 'Attendance confirmed',
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
        console.error('Line attendance error:', error);
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
