import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface LeavePolicy {
  id: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  year: number;
  default_days: number;
  effective_from: string;
  effective_until: string;
  notes: string;
  is_active: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

const getLeavePolicies = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Only require authentication for sensitive operations, but allow public access to policies
    const params = event.queryStringParameters || {};
    const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear();

    console.log('=== GET LEAVE POLICIES ===');
    console.log('Year:', year);
    console.log('User:', event.user?.userId, 'Role:', event.user?.role);

    // Query with correct column names based on the LeavePolicy interface
    const sql = `
      SELECT
        lp.id,
        lp.leave_type_id,
        lp.year,
        lp.default_days,
        lp.effective_from,
        lp.effective_until,
        lp.notes,
        lp.is_active,
        lp.created_by,
        lp.created_at,
        lp.updated_at,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        CASE WHEN e.first_name_th IS NOT NULL AND e.last_name_th IS NOT NULL
             THEN CONCAT(e.first_name_th, ' ', e.last_name_th)
             WHEN e.first_name_en IS NOT NULL AND e.last_name_en IS NOT NULL
             THEN CONCAT(e.first_name_en, ' ', e.last_name_en)
             ELSE 'System'
        END as created_by_name
      FROM leave_policies lp
      LEFT JOIN leave_types lt ON lp.leave_type_id = lt.id
      LEFT JOIN employees e ON lp.created_by = e.id
      WHERE lp.year = $1
      ORDER BY
        CASE
          WHEN lt.code IS NOT NULL THEN lt.code
          ELSE lt.id::text
        END ASC
    `;

    const result = await query(sql, [year]);

    console.log('Found policies:', result.length);

    // Map to the expected interface format
    const policies = result.map((row: any) => ({
      id: row.id,
      leave_type_id: row.leave_type_id,
      leave_type_code: row.leave_type_code,
      leave_type_name_th: row.leave_type_name_th,
      leave_type_name_en: row.leave_type_name_en,
      year: parseInt(row.year, 10),
      default_days: parseInt(row.default_days, 10),
      effective_from: row.effective_from,
      effective_until: row.effective_until,
      notes: row.notes,
      is_active: Boolean(row.is_active),
      created_by: row.created_by,
      created_by_name: row.created_by_name,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return successResponse({
      success: true,
      leave_policies: policies,
      year: year,
      total: policies.length
    });

  } catch (error: any) {
    console.error('Get leave policies error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return errorResponse(error.message || 'Failed to get leave policies', 500);
  }
};

export const handler: Handler = requireAuth(getLeavePolicies);
