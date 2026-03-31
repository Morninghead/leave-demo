import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface CreateShiftSwapBody {
  work_date: string;
  off_date: string;
  reason_th?: string;
  reason_en?: string;
}

const createShiftRequest = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    const body: CreateShiftSwapBody = JSON.parse(event.body || '{}');

    const { work_date, off_date, reason_th, reason_en } = body;

    if (!work_date || !off_date) {
      return errorResponse('Missing required fields', 400);
    }

    // Validate: dates must be different
    if (work_date === off_date) {
      return errorResponse('Work date and off date must be different', 400);
    }

    // Generate request number
    const year = new Date().getFullYear();
    const countResult = await query(
      `SELECT COUNT(*) as count FROM shift_swap_requests WHERE EXTRACT(YEAR FROM created_at) = $1`,
      [year]
    );
    const requestNumber = `SS${year}${String(parseInt(countResult[0].count) + 1).padStart(4, '0')}`;

    // Insert shift swap request
    const result = await query(
      `
      INSERT INTO shift_swap_requests (
        request_number,
        employee_id,
        work_date,
        off_date,
        reason_th,
        reason_en,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        requestNumber,
        userId,
        work_date,
        off_date,
        reason_th || null,
        reason_en || null,
        'pending',
      ]
    );

    return successResponse(
      {
        shift_request: result[0],
        message: 'Shift swap request created successfully',
      },
      201
    );
  } catch (error: any) {
    console.error('Create shift request error:', error);
    return errorResponse(error.message || 'Failed to create shift request', 500);
  }
};

export const handler: Handler = requireAuth(createShiftRequest);
