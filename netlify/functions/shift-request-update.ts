import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const updateShiftRequest = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  const requestId = event.path.split('/').pop();
  if (!requestId) {
    return errorResponse('Request ID is required', 400);
  }

  const userRole = event.user?.role;
  const userId = event.user?.userId;

  if (!['manager', 'hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { status, rejection_reason } = body;

    if (!status) {
      return errorResponse('Status is required', 400);
    }

    let updateQuery = '';
    let updateParams: any[] = [];

    if (status === 'approved') {
      updateQuery = `
        UPDATE shift_swap_requests
        SET 
          status = $1,
          approved_by = $2,
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      updateParams = [status, userId, requestId];
    } else if (status === 'rejected') {
      updateQuery = `
        UPDATE shift_swap_requests
        SET 
          status = $1,
          rejection_reason = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      updateParams = [status, rejection_reason, userId, requestId];
    } else {
      return errorResponse('Invalid status', 400);
    }

    const result = await query(updateQuery, updateParams);

    if (result.length === 0) {
      return errorResponse('Request not found', 404);
    }

    return successResponse({
      shift_request: result[0],
      message: `Shift request ${status} successfully`,
    });
  } catch (error: any) {
    console.error('Update shift request error:', error);
    return errorResponse(error.message || 'Failed to update shift request', 500);
  }
};

export const handler: Handler = requireAuth(updateShiftRequest);
