// netlify/functions/offense-types.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { handleCORS, successResponse, errorResponse } from './utils/response';
import { verifyToken, getTokenFromHeader } from './utils/jwt';

/**
 * Get list of disciplinary offense types
 * No special permissions required - all authenticated users can view
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleCORS(event);
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const token = getTokenFromHeader(event.headers.authorization || event.headers.Authorization);
    if (!token) {
      return errorResponse('Unauthorized - No token provided', 401);
    }

    const tokenData = verifyToken(token);
    if (!tokenData) {
      return errorResponse('Unauthorized - Invalid token', 401);
    }

    // Get all offense types ordered by severity level
    const offenseTypes = await sql`
      SELECT
        id,
        code,
        name_th,
        name_en,
        description_th,
        description_en,
        severity_level,
        is_active
      FROM disciplinary_offense_types
      WHERE is_active = true
      ORDER BY severity_level ASC, name_th ASC
    `;

    return successResponse({
      success: true,
      data: offenseTypes,
      total: offenseTypes.length
    });

  } catch (error: any) {
    console.error('Error fetching offense types:', error);
    return errorResponse(error.message || 'Failed to fetch offense types', 500);
  }
};
