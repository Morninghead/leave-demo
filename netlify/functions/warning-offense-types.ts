// netlify/functions/warning-offense-types.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Disciplinary Offense Types API
 * GET: List all offense types (authenticated users)
 */

interface OffenseType {
  id: number;
  code: string;
  name_th: string;
  name_en: string;
  description_th: string;
  description_en: string;
  severity_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'GET') {
      const offenseTypes = (await sql`
        SELECT
          id,
          code,
          name_th,
          name_en,
          description_th,
          description_en,
          severity_level,
          is_active,
          created_at,
          updated_at
        FROM disciplinary_offense_types
        WHERE is_active = true
        ORDER BY severity_level ASC, name_en ASC
      `) as OffenseType[];

      return successResponse({
        offenseTypes,
        total: offenseTypes.length,
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Offense types error:', error);
    return errorResponse(error.message || 'Failed to retrieve offense types', 500);
  }
});

export { handler };
