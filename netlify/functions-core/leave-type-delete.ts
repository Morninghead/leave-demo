import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const deleteLeaveType = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'DELETE') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userRole = event.user?.role;

    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied', 403);
    }

    // Extract ID from URL path (e.g., /leave-type-delete/{id})
    const pathParts = event.path.split('/');
    const id = pathParts[pathParts.length - 1];

    console.log('🔍 [DEBUG] Delete leave type request:', {
      fullPath: event.path,
      pathParts,
      extractedId: id,
      userRole,
      body: event.body
    });

    if (!id || id === 'leave-type-delete') {
      console.log('❌ [DEBUG] Invalid ID extracted:', id);
      return errorResponse('Leave type ID is required', 400);
    }

    // Check for existing leave requests
    const requests = await query(
      'SELECT COUNT(*) as count FROM leave_requests WHERE leave_type_id = $1',
      [id]
    );

    if (parseInt(requests[0].count) > 0) {
      return errorResponse('Cannot delete leave type that has been used in leave requests', 400);
    }

    // Check for leave year settings references
    const yearSettings = await query(
      'SELECT COUNT(*) as count FROM leave_year_settings WHERE leave_type_id = $1',
      [id]
    );

    if (parseInt(yearSettings[0].count) > 0) {
      return errorResponse('Cannot delete leave type that is referenced in leave year settings', 400);
    }

    // Check for leave policies references (only for warning, not blocking)
    const policies = await query(
      'SELECT COUNT(*) as count FROM leave_policies WHERE leave_type_id = $1',
      [id]
    );

    // Delete all references first (cascade delete in proper order)
    // Clean up leave balances for this leave type
    const deletedBalances = await query(
      'DELETE FROM leave_balances WHERE leave_type_id = $1 RETURNing employee_id, year',
      [id]
    );

    // Delete policies and settings
    await query('DELETE FROM leave_policies WHERE leave_type_id = $1', [id]);
    await query('DELETE FROM leave_year_settings WHERE leave_type_id = $1', [id]);

    const result = await query(
      'DELETE FROM leave_types WHERE id = $1 RETURNING code, name_th',
      [id]
    );

    if (result.length === 0) {
      return errorResponse('Leave type not found', 404);
    }

    console.log(`✅ [LEAVE TYPE] Deleted leave type ${result[0].code} and cleaned up ${deletedBalances.length} balance records`);

    return successResponse({
      success: true,
      message: `Leave type ${result[0].code} deleted successfully. Cleaned up ${deletedBalances.length} balance records.`,
      deleted_balances_count: deletedBalances.length
    });

  } catch (error: any) {
    console.error('Delete leave type error:', error);
    return errorResponse(error.message || 'Failed to delete leave type', 500);
  }
};

export const handler: Handler = requireAuth(deleteLeaveType);
