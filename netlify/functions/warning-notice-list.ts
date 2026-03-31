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

    // Determine visibility scope
    let queryScope = 'OWN';
    let deptId = null;
    const isPowerUser = ['admin', 'hr', 'dev'].includes(userRole || '');

    if (isPowerUser) {
      queryScope = 'ALL';
      console.log('👀 Admin/HR view enabled (all records)');
    } else {
      try {
        // Fetch employee details to check for manager status
        const [emp] = await sql`
          SELECT department_id, is_department_manager, is_department_admin 
          FROM employees 
          WHERE id = ${userId}
        `;

        if (emp && (emp.is_department_manager || emp.is_department_admin) && emp.department_id) {
          queryScope = 'DEPARTMENT';
          deptId = emp.department_id;
          console.log('👀 Manager view enabled for department:', deptId);
        } else {
          queryScope = 'OWN';
          console.log('👀 Employee view enabled (own records only)');
        }
      } catch (empError) {
        console.error('❌ Failed to fetch permissions:', empError);
        queryScope = 'OWN';
      }
    }

    const statusParam = status || null;

    // Try query with filters
    try {
      // Get total count matching criteria
      const [countResult] = await sql`
        SELECT COUNT(DISTINCT wn.id) as total 
        FROM warning_notices wn
        LEFT JOIN employees e ON wn.employee_id = e.id
        WHERE 
          (
            (${queryScope} = 'ALL') OR
            (${queryScope} = 'OWN' AND wn.employee_id = ${userId}) OR
            (${queryScope} = 'DEPARTMENT' AND (wn.employee_id = ${userId} OR e.department_id = ${deptId}))
          )
          AND (${statusParam}::text IS NULL OR wn.status = ${statusParam})
      ` as any;
      console.log('✅ Count query successful:', countResult);

      // Main Query
      const warnings = await sql`
        SELECT
          wn.id,
          wn.notice_number,
          wn.employee_id,
          wn.warning_type,
          wn.offense_type_id,
          wn.incident_date,
          wn.incident_description,
          wn.incident_location,
          wn.penalty_description,
          wn.suspension_days,
          wn.suspension_start_date,
          wn.suspension_end_date,
          wn.effective_date,
          wn.expiry_date,
          wn.is_active,
          wn.status,
          wn.attachments_urls,
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
          issuer.signature_image as issuer_signature,
          ot.name_th as offense_name_th,
          ot.name_en as offense_name_en,
          wack.signature_data,
          wack.signature_timestamp,
          wack.signature_ip,
          wack.acknowledged_at,
          wack.refuse_reason,
          wack.signature_refused,
          wa.status as appeal_status,
          wa.id as appeal_id
        FROM warning_notices wn
        LEFT JOIN employees e ON wn.employee_id = e.id
        LEFT JOIN employees issuer ON wn.issued_by = issuer.id
        LEFT JOIN disciplinary_offense_types ot ON wn.offense_type_id = ot.id
        LEFT JOIN LATERAL (
          SELECT signature_data, signature_timestamp, signature_ip, acknowledged_at, refuse_reason_th as refuse_reason, signature_refused
          FROM warning_acknowledgements wack_inner
          WHERE wack_inner.warning_notice_id = wn.id
          ORDER BY wack_inner.created_at DESC
          LIMIT 1
        ) wack ON true
        LEFT JOIN LATERAL (
          SELECT status, id 
          FROM warning_appeals wap_inner
          WHERE wap_inner.warning_notice_id = wn.id 
          ORDER BY wap_inner.id DESC 
          LIMIT 1
        ) wa ON true
        WHERE 
          (
            (${queryScope} = 'ALL') OR
            (${queryScope} = 'OWN' AND wn.employee_id = ${userId}) OR
            (${queryScope} = 'DEPARTMENT' AND (wn.employee_id = ${userId} OR e.department_id = ${deptId}))
          )
          AND (${statusParam}::text IS NULL OR wn.status = ${statusParam})
        ORDER BY wn.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as any;

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
          employee_code: w.employee_code || null,
          employee_name: employeeName,
          offense_type_name_th: w.offense_name_th || 'N/A',
          offense_type_name_en: w.offense_name_en || 'N/A',
          issued_by_name: issuedByName,
          issuer_signature: w.issuer_signature || null,
          incident_location: w.incident_location || '',
          attachments_urls: w.attachments_urls || [],
          suspension_days: w.suspension_days || 0,
          suspension_start_date: formatDate(w.suspension_start_date || ''),
          suspension_end_date: formatDate(w.suspension_end_date || ''),
          // Signature/acknowledgement fields
          signature_data: w.signature_data || null,
          signature_timestamp: w.signature_timestamp || null,
          signature_ip: w.signature_ip || null,
          acknowledged_at: w.acknowledged_at || null,
          refuse_reason: w.refuse_reason || null,
          signature_refused: w.signature_refused || false,
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