import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { generateToken } from './utils/jwt';
import { logAudit } from './utils/audit-logger';

/**
 * Impersonate User API
 * 
 * Allows DEV role users to impersonate any other user for debugging purposes.
 * This creates a new JWT token for the target user while storing the original user info.
 * 
 * SECURITY:
 * - Only 'dev' role can use this feature
 * - All impersonation actions are logged to audit trail
 * - Original user session can be restored
 */

const impersonateHandler = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const currentUserId = event.user?.userId;
    const currentUserRole = event.user?.role;

    if (!currentUserId) {
        return errorResponse('User not authenticated', 401);
    }

    // ✅ SECURITY: For DELETE (end impersonation), we need special handling
    // because the current token belongs to the IMPERSONATED user, not the DEV
    // We'll verify DEV authorization via the originalUserId in the request body for DELETE

    if (event.httpMethod === 'DELETE') {
        // Handle DELETE authorization separately - see the DELETE handler below
        // We need to verify the originalUserId from the body is a DEV user
    } else {
        // For POST and GET, verify current user is a DEV
        const devCheck = await query(
            `SELECT employee_code, role FROM employees WHERE id = $1`,
            [currentUserId]
        );

        if (devCheck.length === 0) {
            return errorResponse('User not found', 404);
        }

        const currentEmployeeCode = devCheck[0].employee_code;
        const currentRole = devCheck[0].role;

        // Only role='dev' OR employee_code '999999999' can impersonate
        const isDev = currentRole === 'dev' || currentEmployeeCode === '999999999';

        if (!isDev) {
            console.log('❌ [IMPERSONATE] Unauthorized attempt by:', {
                userId: currentUserId,
                employeeCode: currentEmployeeCode,
                role: currentRole
            });
            return errorResponse('Only DEV users (role=dev or employee_code=999999999) can use impersonation feature', 403);
        }
    }

    try {
        // ================================
        // POST - Start impersonation
        // ================================
        if (event.httpMethod === 'POST') {
            if (!event.body) {
                return errorResponse('Request body is required', 400);
            }

            const { targetUserId } = JSON.parse(event.body);

            if (!targetUserId) {
                return errorResponse('targetUserId is required', 400);
            }

            // Cannot impersonate yourself
            if (targetUserId === currentUserId) {
                return errorResponse('Cannot impersonate yourself', 400);
            }

            // Get target user info - ✅ Include all permission-related fields
            const targetUserResult = await query(
                `SELECT 
          e.id, 
          e.employee_code,
          e.scan_code,
          e.first_name_th,
          e.last_name_th,
          e.first_name_en,
          e.last_name_en,
          e.email,
          e.role,
          e.department_id,
          e.is_department_admin,
          e.is_department_manager,
          CASE WHEN e.role = 'hr' THEN true ELSE false END as is_hr,
          d.name_th as department_name_th,
          d.name_en as department_name_en,
          e.position_th,
          e.position_en,
          e.status,
          e.profile_image_url,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as name_th,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as name_en
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.id = $1 AND e.is_active = true`,
                [targetUserId]
            );

            if (targetUserResult.length === 0) {
                return errorResponse('Target user not found or inactive', 404);
            }

            const targetUser = targetUserResult[0];

            // Generate new token for target user
            const impersonationToken = generateToken({
                userId: targetUser.id,
                employeeCode: targetUser.employee_code,
                role: targetUser.role,
            });

            // ✅ AUDIT LOG - Record impersonation start
            await logAudit({
                user_id: currentUserId,
                action: 'VIEW', // Using VIEW as we're "viewing as" another user
                resource_type: 'employee',
                resource_id: targetUserId,
                metadata: {
                    action_type: 'IMPERSONATE_START',
                    target_user_id: targetUserId,
                    target_employee_code: targetUser.employee_code,
                    target_name: targetUser.name_th || targetUser.name_en,
                },
            }, event);

            console.log('🎭 [IMPERSONATE] Started:', {
                originalUser: currentUserId,
                targetUser: targetUserId,
                targetEmployeeCode: targetUser.employee_code,
                targetName: targetUser.name_th || targetUser.name_en,
            });

            return successResponse({
                message: 'Impersonation started successfully',
                impersonation: {
                    token: impersonationToken,
                    targetUser: {
                        id: targetUser.id,
                        employee_code: targetUser.employee_code,
                        scan_code: targetUser.scan_code,
                        first_name_th: targetUser.first_name_th,
                        last_name_th: targetUser.last_name_th,
                        first_name_en: targetUser.first_name_en,
                        last_name_en: targetUser.last_name_en,
                        email: targetUser.email,
                        role: targetUser.role,
                        department_id: targetUser.department_id,
                        department_name_th: targetUser.department_name_th,
                        department_name_en: targetUser.department_name_en,
                        position_th: targetUser.position_th,
                        position_en: targetUser.position_en,
                        status: targetUser.status,
                        profile_image_url: targetUser.profile_image_url,
                        is_department_admin: targetUser.is_department_admin,
                        is_department_manager: targetUser.is_department_manager,
                        is_hr: targetUser.is_hr,
                        // Legacy fields for compatibility
                        employeeCode: targetUser.employee_code,
                        name: targetUser.name_th || targetUser.name_en,
                    },
                    originalUser: {
                        id: currentUserId,
                        // Store original user info in response so frontend can restore later
                    },
                },
            });
        }

        // ================================
        // DELETE - End impersonation (restore original session)
        // ================================
        if (event.httpMethod === 'DELETE') {
            if (!event.body) {
                return errorResponse('Request body is required', 400);
            }

            const { originalUserId } = JSON.parse(event.body);

            if (!originalUserId) {
                return errorResponse('originalUserId is required', 400);
            }

            // Verify original user exists and is DEV (role='dev' OR employee_code='999999999')
            const originalUserResult = await query(
                `SELECT 
          id, 
          employee_code, 
          role,
          CONCAT(first_name_th, ' ', last_name_th) as name_th,
          CONCAT(first_name_en, ' ', last_name_en) as name_en
        FROM employees 
        WHERE id = $1 
          AND (role = 'dev' OR employee_code = '999999999') 
          AND is_active = true`,
                [originalUserId]
            );

            if (originalUserResult.length === 0) {
                return errorResponse('Original user not found or not authorized (must be DEV)', 404);
            }

            const originalUser = originalUserResult[0];

            // Generate token to restore original session
            const restoredToken = generateToken({
                userId: originalUser.id,
                employeeCode: originalUser.employee_code,
                role: originalUser.role,
            });

            // ✅ AUDIT LOG - Record impersonation end
            await logAudit({
                user_id: originalUserId,
                action: 'VIEW',
                resource_type: 'employee',
                resource_id: currentUserId, // The impersonated user we're leaving
                metadata: {
                    action_type: 'IMPERSONATE_END',
                    impersonated_user_id: currentUserId,
                },
            }, event);

            console.log('🎭 [IMPERSONATE] Ended:', {
                restoredUser: originalUserId,
                previouslyImpersonated: currentUserId,
            });

            return successResponse({
                message: 'Impersonation ended, restored original session',
                restoration: {
                    token: restoredToken,
                    user: {
                        id: originalUser.id,
                        employeeCode: originalUser.employee_code,
                        name: originalUser.name_th || originalUser.name_en,
                        role: originalUser.role,
                    },
                },
            });
        }

        // ================================
        // GET - Get impersonation status/list available users
        // ================================
        if (event.httpMethod === 'GET') {
            // Return list of users that can be impersonated
            const usersResult = await query(
                `SELECT 
          e.id, 
          e.employee_code,
          e.role,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as name_th,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as name_en,
          e.is_department_admin,
          e.is_department_manager,
          d.name_th as department_name_th,
          d.name_en as department_name_en
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.is_active = true
          AND e.id != $1
          AND e.employee_code != '999999999'
        ORDER BY e.role, d.name_th, e.first_name_th`,
                [currentUserId]
            );

            return successResponse({
                availableUsers: usersResult.map(u => ({
                    id: u.id,
                    employeeCode: u.employee_code,
                    name: u.name_th || u.name_en,
                    role: u.role,
                    isDeptAdmin: u.is_department_admin,
                    isDeptManager: u.is_department_manager,
                    department: u.department_name_th || u.department_name_en,
                })),
                totalUsers: usersResult.length,
            });
        }

        return errorResponse('Method not allowed', 405);

    } catch (error: any) {
        console.error('❌ [IMPERSONATE] Error:', error);
        return errorResponse(error.message || 'Failed to process impersonation', 500);
    }
};

export const handler: Handler = requireAuth(impersonateHandler);
