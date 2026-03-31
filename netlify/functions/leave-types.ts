import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description_th: string;
  description_en: string;
  default_days: number;
  requires_attachment: boolean;
  is_paid: boolean;
  color_code: string;
  is_active: boolean;
  allow_hourly_leave: boolean;
  working_hours_per_day: number;
  minutes_per_day: number;
}

const getLeaveTypes = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const leaveTypes = await query<LeaveType>(
      `
      SELECT
        id,
        code,
        name_th,
        name_en,
        description_th,
        description_en,
        default_days,
        requires_attachment,
        is_paid,
        color_code,
        is_active,
        allow_hourly_leave,
        working_hours_per_day,
        minutes_per_day
      FROM leave_types
      WHERE is_active = true
      ORDER BY code
      `
    );

    return successResponse({ leave_types: leaveTypes });
  } catch (error: any) {
    console.error('Get leave types error:', error);
    return errorResponse(error.message || 'Failed to get leave types', 500);
  }
};

export const handler: Handler = requireAuth(getLeaveTypes);
