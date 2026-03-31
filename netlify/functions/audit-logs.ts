import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const auditLogsHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const userRole = event.user?.role;

  // Only HR and dev can view audit logs
  if (!['hr', 'dev'].includes(userRole || '')) {
    return errorResponse('Unauthorized: HR or dev role required', 403);
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const params = event.queryStringParameters || {};
    const {
      user_id,
      action,
      resource_type,
      resource_id,
      start_date,
      end_date,
      limit = '50',
      offset = '0',
    } = params;

    // Build WHERE clause
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (user_id) {
      whereClauses.push(`al.user_id = $${paramIndex}`);
      queryParams.push(user_id);
      paramIndex++;
    }

    if (action) {
      whereClauses.push(`al.action = $${paramIndex}`);
      queryParams.push(action);
      paramIndex++;
    }

    if (resource_type) {
      whereClauses.push(`al.resource_type = $${paramIndex}`);
      queryParams.push(resource_type);
      paramIndex++;
    }

    if (resource_id) {
      whereClauses.push(`al.resource_id = $${paramIndex}`);
      queryParams.push(resource_id);
      paramIndex++;
    }

    if (start_date) {
      whereClauses.push(`al.created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereClauses.push(`al.created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM audit_logs al
       ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult[0]?.total || '0');

    // Get paginated results
    const results = await query(
      `SELECT
        al.*,
        e.employee_code,
        e.email as user_email,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as user_name_en,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as user_name_th
       FROM audit_logs al
       LEFT JOIN employees e ON al.user_id = e.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );

    // Parse JSON fields
    const logs = results.map((log: any) => ({
      ...log,
      before_value: log.before_value ? JSON.parse(log.before_value) : null,
      after_value: log.after_value ? JSON.parse(log.after_value) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return successResponse({
      logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch audit logs', 500);
  }
};

export const handler: Handler = requireAuth(auditLogsHandler);
