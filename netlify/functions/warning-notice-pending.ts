// netlify/functions/warning-notice-pending.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { handleCORS, successResponse, errorResponse } from './utils/response';
import { verifyToken, getTokenFromHeader } from './utils/jwt';

/**
 * Get pending warning notices that require employee acknowledgment
 * Returns the oldest unacknowledged warning for popup display
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

    console.log('🔍 Checking pending warnings for employee:', tokenData.userId);

    // Get all pending warnings for this employee that need acknowledgment or action
    // Status: PENDING_ACKNOWLEDGEMENT, PENDING_HR_APPROVAL, or REFUSED (not yet appealed)
    // Exclude: ACKNOWLEDGED (fully handled), APPEALED, VOIDED
    const pendingWarnings = await sql`
      SELECT
        w.*,
        o.name_th as offense_name_th,
        o.name_en as offense_name_en,
        issuer.first_name_th as issuer_first_name_th,
        issuer.last_name_th as issuer_last_name_th,
        issuer.first_name_en as issuer_first_name_en,
        issuer.last_name_en as issuer_last_name_en,
        issuer.position_th as issuer_position_th,
        issuer.position_en as issuer_position_en
      FROM warning_notices w
      LEFT JOIN disciplinary_offense_types o ON w.offense_type_id = o.id
      LEFT JOIN employees issuer ON w.issued_by = issuer.id
      WHERE w.employee_id = ${tokenData.userId}
        AND w.status IN ('PENDING_ACKNOWLEDGEMENT', 'PENDING_ACKNOWLEDGMENT', 'PENDING_HR_APPROVAL', 'REFUSED')
        AND w.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM warning_acknowledgements wa
          WHERE wa.warning_notice_id = w.id
          AND wa.employee_id = ${tokenData.userId}
        )
      ORDER BY w.created_at ASC
    `;

    if (pendingWarnings.length === 0) {
      return successResponse({
        hasPending: false,
        warning: null,
        warnings: [],
        message: 'No pending warnings'
      });
    }

    // Process all warnings to attach witnesses
    const warningsWithWitnesses = await Promise.all(pendingWarnings.map(async (warning) => {
      const witnesses = await sql`
        SELECT * FROM warning_witnesses
        WHERE warning_notice_id = ${warning.id}
        ORDER BY created_at ASC
      `;
      return { ...warning, witnesses };
    }));

    const firstWarning = warningsWithWitnesses[0];

    console.log('✅ Found pending warnings:', {
      count: warningsWithWitnesses.length,
      first_notice: firstWarning.notice_number,
      status: firstWarning.status
    });

    return successResponse({
      hasPending: true,
      // Backward compatibility: maintain 'warning' field with the first (oldest) warning
      warning: firstWarning,
      // New field: all pending warnings
      warnings: warningsWithWitnesses,
      count: warningsWithWitnesses.length,
      message: `${warningsWithWitnesses.length} pending warning(s) found`
    });

  } catch (error: any) {
    console.error('❌ Error checking pending warnings:', error);
    return errorResponse(error.message || 'Failed to check pending warnings', 500);
  }
};
