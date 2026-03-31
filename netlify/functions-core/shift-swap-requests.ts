// netlify/functions/shift-swap-requests.ts - Improved with proper approval filtering
import { logger } from './utils/logger';

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getApprovalFlow } from './utils/approval-flow';

const getShiftSwapRequests = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    const userRole = event.user?.role;
    const params = event.queryStringParameters || {};
    const forApproval = params.for_approval === 'true';
    const status = params.status || 'all';

    logger.log('=== GET SHIFT SWAP REQUESTS ===');
    logger.log('User ID:', userId);
    logger.log('User Role:', userRole);
    logger.log('For Approval:', forApproval);
    logger.log('Status Filter:', status);

    // Get current user's info
    const userInfoResult = await query(
      `SELECT department_id, is_department_admin, is_department_manager, role
       FROM employees
       WHERE id = $1`,
      [userId]
    );

    if (userInfoResult.length === 0) {
      return errorResponse('User not found', 404);
    }

    const userInfo = userInfoResult[0];
    const { department_id: userDeptId, is_department_admin, is_department_manager, role } = userInfo;

    logger.log('User Info:', {
      department_id: userDeptId,
      is_department_admin,
      is_department_manager,
      role
    });

    let sql = `
      SELECT
        ssr.*,
        e.employee_code,
        e.department_id,
        e.role as employee_role,
        e.is_department_admin as employee_is_dept_admin,
        e.is_department_manager as employee_is_dept_manager,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM shift_swap_requests ssr
      LEFT JOIN employees e ON ssr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (forApproval) {
      // FOR APPROVAL - Show requests that the current user can approve
      logger.log('📋 Fetching shift swap requests for approval...');

      // Must be pending
      sql += ` AND ssr.status = 'pending'`;

      // Cannot be own request
      sql += ` AND ssr.employee_id != $${queryParams.length + 1}`;
      queryParams.push(userId);

      if (role === 'hr') {
        // HR can see ALL pending requests across ALL departments
        logger.log('🏢 HR - Fetching ALL pending shift swap requests');
        // Filter by approval stage in memory
      } else if (is_department_admin || is_department_manager) {
        // Department admin/manager can only see requests from their own department
        logger.log(`🏢 Dept Admin/Manager - Department ${userDeptId}`);
        sql += ` AND e.department_id = $${queryParams.length + 1}`;
        queryParams.push(userDeptId);
      } else {
        // Regular employee - cannot approve anything
        logger.log('❌ Regular employee - no approval permissions');
        sql += ` AND 1 = 0`; // Return nothing
      }

    } else {
      // OWN REQUESTS - Show the user's own requests
      logger.log('👤 Fetching own shift swap requests...');
      sql += ` AND ssr.employee_id = $${queryParams.length + 1}`;
      queryParams.push(userId);

      // Apply status filter for own requests
      if (status !== 'all') {
        sql += ` AND ssr.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }
    }

    sql += ` ORDER BY ssr.created_at DESC`;

    logger.log('SQL Query:', sql);
    logger.log('Params:', queryParams);

    const requests = await query(sql, queryParams);

    logger.log(`📊 Found ${requests.length} shift swap requests (before filtering)`);

    // Process and filter results
    let filteredRequests = requests;

    if (forApproval) {
      // Further filter based on approval stage and permissions
      const requestsToApprove = [];

      for (const request of requests) {
        try {
          // Get the approval flow for the requester
          const flow = await getApprovalFlow(request.employee_id);
          const currentStage = request.current_approval_stage || 1;
          const stageInfo = flow.stages.find(s => s.stage === currentStage);

          if (!stageInfo) {
            logger.log(`⚠️ Shift swap request ${request.id}: Invalid stage ${currentStage}`);
            continue;
          }

          logger.log(`🔍 Shift swap ${request.id}: Stage ${currentStage} requires ${stageInfo.role}`);

          // ✅ HR can see ALL pending shift swap requests at ALL stages for tracking purposes
          if (role === 'hr') {
            logger.log(`✅ Shift swap ${request.id}: HR can view (Stage ${currentStage})`);
            requestsToApprove.push(request);
            continue;
          }

          // For department admin/manager: Check if current user can approve at this stage
          let canApprove = false;

          if (stageInfo.role === 'department_admin') {
            canApprove = is_department_admin && userDeptId === request.department_id;
          } else if (stageInfo.role === 'department_manager') {
            canApprove = is_department_manager && userDeptId === request.department_id;
          }

          if (canApprove) {
            logger.log(`✅ Shift swap ${request.id}: Can approve`);
            requestsToApprove.push(request);
          } else {
            logger.log(`❌ Shift swap ${request.id}: Cannot approve at this stage`);
          }
        } catch (error) {
          logger.error(`Error checking approval for shift swap ${request.id}:`, error);
        }
      }

      filteredRequests = requestsToApprove;
      logger.log(`✅ Final filtered: ${filteredRequests.length} shift swap requests can be approved`);
    }

    logger.log(`📤 Returning ${filteredRequests.length} shift swap requests`);

    return successResponse({
      success: true,
      shift_swap_requests: filteredRequests
    });

  } catch (error: any) {
    logger.error('❌ Get shift swap requests error:', error);
    return errorResponse(error.message || 'Failed to get shift swap requests', 500);
  }
};

export const handler: Handler = requireAuth(getShiftSwapRequests);
