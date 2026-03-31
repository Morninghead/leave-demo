import { Handler } from '@netlify/functions';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { verifyToken } from './utils/jwt';
import { query } from './utils/db';

export const handler: Handler = async (event) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    console.log('🚪 [LOGOUT] User logout request received');

    // Extract token from Authorization header if present
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let userInfo = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Verify the token to get user info for logging
        const decoded = verifyToken(token);
        userInfo = {
          userId: decoded.userId,
          employeeCode: decoded.employeeCode,
          role: decoded.role
        };
        console.log('👤 [LOGOUT] User info extracted from token:', userInfo);
      } catch (error) {
        // Token might be expired or invalid, but we still allow logout
        console.log('⚠️ [LOGOUT] Token verification failed, proceeding with logout anyway');
      }
    }

    // Log the logout event for security auditing
    if (userInfo) {
      try {
        // Log to audit_logs table if it exists
        await query(
          `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            userInfo.userId,
            'LOGOUT',
            'users',
            userInfo.userId,
            event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || null,
            event.headers['user-agent'] || null
          ]
        );
        console.log('📝 [LOGOUT] Logout event logged to audit trail');
      } catch (logError) {
        console.log('⚠️ [LOGOUT] Could not log to audit table (may not exist):', logError.message);
      }
    }

    // For JWT-based authentication, logout is primarily handled client-side
    // by removing the token from localStorage. The server-side logging is for
    // security auditing purposes.

    console.log('✅ [LOGOUT] Logout successful', userInfo ? `for user ${userInfo.employeeCode}` : '');

    return successResponse({
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
      user: userInfo ? {
        employeeCode: userInfo.employeeCode,
        role: userInfo.role
      } : null
    });

  } catch (error: any) {
    console.error('❌ [LOGOUT] Logout error:', error);
    return errorResponse(error.message || 'Logout failed', 500);
  }
};