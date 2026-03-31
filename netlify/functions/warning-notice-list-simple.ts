import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Simplified Warning Notice List API
 * Minimal implementation to test basic functionality
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    console.log('🔍 Simplified warning list - starting');

    const userId = event.user?.userId;
    const userRole = event.user?.role;

    if (!userId) {
      console.error('❌ Missing userId');
      return errorResponse('User ID not found', 401);
    }

    console.log('✅ User authenticated:', { userId, userRole });

    // Check if table exists first
    try {
      const [tableCheck] = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'warning_notices'
        ) as exists
      `;

      if (!tableCheck.exists) {
        console.log('⚠️ warning_notices table does not exist - returning empty');
        return successResponse({
          success: true,
          data: [],
          warnings: [],
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0
          }
        });
      }

      console.log('✅ warning_notices table exists');
    } catch (tableError: any) {
      console.error('❌ Table check failed:', tableError);
      return errorResponse('Database table check failed: ' + tableError.message, 500);
    }

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const status = params.status;
    const page = parseInt(params.page || '1', 10);
    const limit = parseInt(params.limit || '50', 10);
    const offset = (page - 1) * limit;

    console.log('📋 Query params:', { status, page, limit, offset });

    // Try ultra-simple query first
    try {
      const [countResult] = await sql`SELECT COUNT(*) as total FROM warning_notices`;
      console.log('✅ Count query successful:', countResult);

      // Simple query with no joins
      const warnings = await sql`
        SELECT
          id,
          notice_number,
          employee_id,
          warning_type,
          status,
          incident_date,
          created_at
        FROM warning_notices
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      console.log('✅ Simple query successful, results:', warnings.length);

      // Apply basic filtering in JavaScript (safer)
      let filteredWarnings = warnings;

      if (status) {
        filteredWarnings = filteredWarnings.filter((w: any) => w.status === status);
        console.log('🔍 Status filter applied:', status, 'remaining:', filteredWarnings.length);
      }

      // Format basic response
      const formattedWarnings = filteredWarnings.map((w: any) => ({
        ...w,
        employee_name: `Employee ID: ${w.employee_id}`,
        offense_type_name_th: 'N/A',
        offense_type_name_en: 'N/A',
        issued_by_name: 'System',
        incident_location: '',
        suspension_days: 0,
        suspension_start_date: '',
        suspension_end_date: ''
      }));

      console.log('✅ Response formatted, returning:', formattedWarnings.length);

      return successResponse({
        success: true,
        data: formattedWarnings,
        warnings: formattedWarnings,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.total, 10),
          totalPages: Math.ceil(parseInt(countResult.total, 10) / limit),
        },
      });

    } catch (queryError: any) {
      console.error('❌ Query failed:', queryError);
      return errorResponse('Query execution failed: ' + queryError.message, 500);
    }

  } catch (error: any) {
    console.error('❌ Simplified warning list error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return errorResponse(error.message || 'Failed to retrieve warnings', 500);
  }
});

export { handler };