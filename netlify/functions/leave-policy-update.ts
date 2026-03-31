import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { syncBalancesForLeaveType } from './utils/sync-all-balances';

const updateLeavePolicy = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;

  // Allow hr, admin, and dev roles
  if (!userRole || !['hr', 'admin', 'dev'].includes(userRole)) {
    return errorResponse('Unauthorized. HR/Admin only.', 403);
  }

  try {
    // Get ID from URL path
    const id = event.path.split('/').pop();
    const { default_days, notes } = JSON.parse(event.body || '{}');

    if (!id || default_days === undefined) {
      return errorResponse('Missing required fields', 400);
    }

    if (default_days < 0) {
      return errorResponse('Default days must be >= 0', 400);
    }

    console.log('=== UPDATE LEAVE POLICY ===');
    console.log('Policy ID:', id);
    console.log('New default days:', default_days);
    console.log('Updated by role:', userRole);

    const sql = `
      UPDATE leave_policies
      SET
        default_days = $1,
        notes = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *, leave_type_id, year
    `;

    const result = await query(sql, [default_days, notes || null, id]);

    if (result.length === 0) {
      return errorResponse('Leave policy not found', 404);
    }

    const updatedPolicy = result[0];
    console.log('✅ Policy updated successfully');

    // Sync balances for ALL employees for this leave type
    const syncResult = await syncBalancesForLeaveType(
      updatedPolicy.leave_type_id,
      updatedPolicy.year,
      default_days
    );
    console.log(`✅ Synced balances: ${syncResult.created} created, ${syncResult.updated} updated`);

    return successResponse({
      leave_policy: updatedPolicy,
      message: `Leave policy updated successfully. Synced balances for ${syncResult.created + syncResult.updated} employees.`,
      sync_result: syncResult,
    });
  } catch (error: any) {
    console.error('Update leave policy error:', error);
    return errorResponse(error.message || 'Failed to update leave policy', 500);
  }
};

export const handler: Handler = requireAuth(updateLeavePolicy);
