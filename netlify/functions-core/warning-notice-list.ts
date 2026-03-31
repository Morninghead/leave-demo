import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

// Mock i18n language detection (Thai by default)
// const i18n = { language: 'th' };

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
      ` as any;

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
      const [countResult] = await sql`SELECT COUNT(*) as total FROM warning_notices` as any;
      console.log('✅ Count query successful:', countResult);

      // Query with employee join to show proper names
      const warnings = await sql`
        SELECT
          wn.id,
          wn.notice_number,
          wn.employee_id,
          wn.warning_type,
          wn.offense_type_id,
          wn.incident_date,
          wn.incident_description,
          wn.penalty_description,
          wn.suspension_days,
          wn.suspension_start_date,
          wn.suspension_end_date,
          wn.effective_date,
          wn.expiry_date,
          wn.is_active,
          wn.status,
          wn.created_at,
          wn.updated_at,
          e.employee_code,
          e.first_name_th,
          e.last_name_th,
          e.first_name_en,
          e.last_name_en,
          issuer.employee_code as issuer_code,
          issuer.first_name_th as issuer_first_name_th,
          issuer.last_name_th as issuer_last_name_th,
          ot.name_th as offense_name_th,
          ot.name_en as offense_name_en
        FROM warning_notices wn
        LEFT JOIN employees e ON wn.employee_id = e.id
        LEFT JOIN employees issuer ON wn.issued_by = issuer.id
        LEFT JOIN disciplinary_offense_types ot ON wn.offense_type_id = ot.id
        ORDER BY wn.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      console.log('✅ Simple query successful, results:', warnings.length);

      // Apply basic filtering in JavaScript (safer)
      let filteredWarnings = warnings;

      if (status) {
        filteredWarnings = filteredWarnings.filter((w: any) => w.status === status);
        console.log('🔍 Status filter applied:', status, 'remaining:', filteredWarnings.length);
      }

      // Format response with proper employee names and dates
      const formattedWarnings = filteredWarnings.map((w: any) => {
        // Proper employee name with code
        const employeeName = w.employee_code
          ? `${w.employee_code} - ${w.first_name_th || ''} ${w.last_name_th || ''}`.trim()
          : `Employee ID: ${w.employee_id}`;

        // Issued by name
        const issuedByName = w.issuer_code
          ? `${w.issuer_first_name_th || ''} ${w.issuer_last_name_th || ''}`.trim()
          : 'System';

        // Date formatting helper
        const formatDate = (dateString: string): string => {
          if (!dateString) return '';
          try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString; // Return original if invalid
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          } catch {
            return dateString;
          }
        };

        return {
          ...w,
          employee_name: employeeName,
          offense_type_name_th: w.offense_name_th || 'N/A',
          offense_type_name_en: w.offense_name_en || 'N/A',
          issued_by_name: issuedByName,
          incident_location: '', // This field doesn't exist in current schema
          suspension_days: w.suspension_days || 0,
          suspension_start_date: formatDate(w.suspension_start_date || ''),
          suspension_end_date: formatDate(w.suspension_end_date || '')
        };
      });

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