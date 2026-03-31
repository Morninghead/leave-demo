/**
 * Bulk Approve Shift Swap Requests
 *
 * Allows managers/HR to approve multiple shift swap requests at once with filtering
 * Filters: department, date range, month, week, status
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { canUserApprove, getNextStage, getApprovalFlow } from './utils/approval-flow';
import { logApprove } from './utils/audit-logger';
import { logger } from './utils/logger';

interface BulkApproveRequest {
  request_ids?: string[]; // Specific IDs to approve
  filters?: {
    department_id?: string;
    date_range?: {
      start: string;
      end: string;
    };
    month?: string; // YYYY-MM format
    week?: {
      start: string; // ISO week start date
      end: string; // ISO week end date
    };
  };
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

interface BulkApproveResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    request_id: string;
    reason: string;
  }>;
  approved_requests: any[];
}

const bulkApproveShiftSwaps = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const userId = event.user?.userId;
  const userRole = event.user?.role;
  const employeeId = event.user?.userId; // userId contains the employee's database ID

  if (!userId || !employeeId) {
    return errorResponse('User not authenticated', 401);
  }

  try {
    const body: BulkApproveRequest = JSON.parse(event.body || '{}');
    const { request_ids, filters, action, rejection_reason } = body;

    logger.log('=== BULK APPROVE SHIFT SWAPS ===');
    logger.log('User ID:', userId);
    logger.log('Employee ID:', employeeId);
    logger.log('Action:', action);
    logger.log('Request IDs:', request_ids);
    logger.log('Filters:', filters);

    // Validation
    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('Invalid action. Must be "approve" or "reject"', 400);
    }

    if (action === 'reject' && !rejection_reason) {
      return errorResponse('Rejection reason is required when rejecting', 400);
    }

    if (!request_ids && !filters) {
      return errorResponse('Either request_ids or filters must be provided', 400);
    }

    // Build query to fetch pending shift swap requests
    let queryText = `
      SELECT
        ssr.*,
        e.department_id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en
      FROM shift_swap_requests ssr
      JOIN employees e ON ssr.employee_id = e.id
      WHERE ssr.status = 'pending'
    `;

    const queryParams: any[] = [];
    let paramCounter = 1;

    // Apply filters
    if (request_ids && request_ids.length > 0) {
      queryText += ` AND ssr.id = ANY($${paramCounter}::uuid[])`;
      queryParams.push(request_ids);
      paramCounter++;
    }

    if (filters?.department_id) {
      queryText += ` AND e.department_id = $${paramCounter}`;
      queryParams.push(filters.department_id);
      paramCounter++;
    }

    if (filters?.date_range) {
      queryText += ` AND ssr.off_date >= $${paramCounter}`;
      queryParams.push(filters.date_range.start);
      paramCounter++;
      queryText += ` AND ssr.work_date <= $${paramCounter}`;
      queryParams.push(filters.date_range.end);
      paramCounter++;
    }

    if (filters?.month) {
      // YYYY-MM format
      const [year, month] = filters.month.split('-');
      queryText += ` AND EXTRACT(YEAR FROM ssr.off_date) = $${paramCounter}`;
      queryParams.push(parseInt(year));
      paramCounter++;
      queryText += ` AND EXTRACT(MONTH FROM ssr.off_date) = $${paramCounter}`;
      queryParams.push(parseInt(month));
      paramCounter++;
    }

    if (filters?.week) {
      queryText += ` AND ssr.off_date >= $${paramCounter}`;
      queryParams.push(filters.week.start);
      paramCounter++;
      queryText += ` AND ssr.off_date <= $${paramCounter}`;
      queryParams.push(filters.week.end);
      paramCounter++;
    }

    queryText += ` ORDER BY ssr.created_at ASC`;

    logger.log('Fetch Query:', queryText);
    logger.log('Query Params:', queryParams);

    const shiftSwapRequests = await query(queryText, queryParams);

    if (shiftSwapRequests.length === 0) {
      return successResponse({
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        approved_requests: [],
        message: 'No pending shift swap requests found matching filters',
      });
    }

    logger.log(`Found ${shiftSwapRequests.length} pending shift swap requests`);

    const result: BulkApproveResult = {
      total: shiftSwapRequests.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      approved_requests: [],
    };

    // Process each shift swap request
    for (const shiftRequest of shiftSwapRequests) {
      try {
        logger.log(`\n📋 [BULK] Processing shift swap request ${shiftRequest.id}`, {
          employee_id: shiftRequest.employee_id,
          employee_code: shiftRequest.employee_code,
          current_stage: shiftRequest.current_approval_stage
        });

        // ⭐ CHECK FOR SELF-APPROVAL: Skip if user is approving their own request
        if (userId === shiftRequest.employee_id) {
          logger.warn(`⏭️  [BULK] Skipping request ${shiftRequest.id}: User cannot approve own request`);
          result.skipped++;
          result.errors.push({
            request_id: shiftRequest.id,
            reason: 'Self-approval not allowed - skipped',
          });
          continue;
        }

        // Check if user can approve this request
        const canApprove = await canUserApprove(
          userId,
          shiftRequest.employee_id,
          shiftRequest.department_id,
          shiftRequest.current_approval_stage
        );

        if (!canApprove.allowed) {
          logger.warn(`⏭️  [BULK] Skipping request ${shiftRequest.id}: ${canApprove.reason}`);
          result.skipped++;
          result.errors.push({
            request_id: shiftRequest.id,
            reason: `Permission denied: ${canApprove.reason}`,
          });
          continue;
        }

        logger.log(`✅ [BULK] User authorized to approve - shouldBypassToFinal: ${canApprove.shouldBypassToFinal}`);

        // Get approval flow for this employee
        const approvalFlow = await getApprovalFlow(shiftRequest.employee_id);
        const currentStage = shiftRequest.current_approval_stage;

        if (action === 'approve') {
          logger.log(`🔵 [BULK] Approving shift swap request at stage ${currentStage}`);

          // ⭐ HR BYPASS: If HR is approving and should bypass to final, set isFinalStage to true
          let isFinalStage = false;
          let nextStage: number | null = null;

          if (canApprove.shouldBypassToFinal) {
            logger.log('⭐ [BULK] HR BYPASS DETECTED - Immediately approving request!');
            isFinalStage = true;
          } else {
            // Get skipped stages if any
            const skippedStagesArray = shiftRequest.skipped_stages
              ? (typeof shiftRequest.skipped_stages === 'string'
                  ? JSON.parse(shiftRequest.skipped_stages)
                  : shiftRequest.skipped_stages)
              : [];

            // Find next non-skipped stage
            nextStage = getNextStage(currentStage, approvalFlow.totalStages);
            while (nextStage && skippedStagesArray.includes(nextStage)) {
              logger.log(`⏭️  [BULK] Stage ${nextStage} is skipped, moving to next...`);
              nextStage = getNextStage(nextStage, approvalFlow.totalStages);
            }

            logger.log(`📍 [BULK] Next stage: ${nextStage || 'FINAL (approved)'}`);
            isFinalStage = nextStage === null;
          }

          let updateQuery = '';
          let updateParams: any[] = [];

          // Build update query based on current stage
          if (currentStage === 1) {
            // Admin approval
            if (isFinalStage) {
              // ⭐ HR BYPASS: Also set HR approval fields if HR is bypassing
              if (canApprove.shouldBypassToFinal) {
                logger.log('⭐ [BULK] HR BYPASS at stage 1 - Setting both admin and HR approval fields');
                updateQuery = `
                  UPDATE shift_swap_requests
                  SET department_admin_approved_by = $1,
                      department_admin_approved_at = NOW(),
                      hr_approved_by = $1,
                      hr_approved_at = NOW(),
                      status = 'approved',
                      updated_at = NOW()
                  WHERE id = $2
                `;
                updateParams = [userId, shiftRequest.id];
              } else {
                updateQuery = `
                  UPDATE shift_swap_requests
                  SET department_admin_approved_by = $1,
                      department_admin_approved_at = NOW(),
                      status = 'approved',
                      updated_at = NOW()
                  WHERE id = $2
                `;
                updateParams = [userId, shiftRequest.id];
              }
            } else {
              updateQuery = `
                UPDATE shift_swap_requests
                SET department_admin_approved_by = $1,
                    department_admin_approved_at = NOW(),
                    current_approval_stage = $2,
                    updated_at = NOW()
                WHERE id = $3
              `;
              updateParams = [userId, nextStage, shiftRequest.id];
            }
          } else if (currentStage === 2) {
            // Manager approval
            if (isFinalStage) {
              // ⭐ HR BYPASS: Also set HR approval fields if HR is bypassing
              if (canApprove.shouldBypassToFinal) {
                logger.log('⭐ [BULK] HR BYPASS at stage 2 - Setting both manager and HR approval fields');
                updateQuery = `
                  UPDATE shift_swap_requests
                  SET department_manager_approved_by = $1,
                      department_manager_approved_at = NOW(),
                      hr_approved_by = $1,
                      hr_approved_at = NOW(),
                      status = 'approved',
                      updated_at = NOW()
                  WHERE id = $2
                `;
                updateParams = [userId, shiftRequest.id];
              } else {
                updateQuery = `
                  UPDATE shift_swap_requests
                  SET department_manager_approved_by = $1,
                      department_manager_approved_at = NOW(),
                      status = 'approved',
                      updated_at = NOW()
                  WHERE id = $2
                `;
                updateParams = [userId, shiftRequest.id];
              }
            } else {
              updateQuery = `
                UPDATE shift_swap_requests
                SET department_manager_approved_by = $1,
                    department_manager_approved_at = NOW(),
                    current_approval_stage = $2,
                    updated_at = NOW()
                WHERE id = $3
              `;
              updateParams = [userId, nextStage, shiftRequest.id];
            }
          } else if (currentStage === 3) {
            // HR approval (always final for stage 3)
            updateQuery = `
              UPDATE shift_swap_requests
              SET hr_approved_by = $1,
                  hr_approved_at = NOW(),
                  status = 'approved',
                  updated_at = NOW()
              WHERE id = $2
            `;
            updateParams = [userId, shiftRequest.id];
            isFinalStage = true;
          }

          // Execute update
          await query(updateQuery, updateParams);
          logger.log(`✅ [BULK] Shift swap request updated successfully`);

          // If fully approved, deduct from shift swap balance
          if (isFinalStage) {
            const currentYear = new Date().getFullYear();
            await query(
              `UPDATE shift_swap_balances
               SET used_times = used_times + 1,
                   updated_at = NOW()
               WHERE employee_id = $1
                 AND year = $2`,
              [shiftRequest.employee_id, currentYear]
            );

            logger.log(`✅ [BULK] Shift swap balance updated for fully approved request`);
          }

          // Audit log
          await logApprove(
            userId,
            'shift_swap_request',
            shiftRequest.id,
            event,
            {
              approval_stage: currentStage,
              is_final_stage: isFinalStage,
              bulk_action: true
            }
          );

          result.successful++;
          result.approved_requests.push({
            id: shiftRequest.id,
            employee_name: shiftRequest.employee_name_th || shiftRequest.employee_name_en,
            employee_code: shiftRequest.employee_code,
            off_date: shiftRequest.off_date,
            work_date: shiftRequest.work_date,
            status: isFinalStage ? 'approved' : 'pending',
          });

          logger.log(`✅ [BULK] Shift swap request ${shiftRequest.id} processed successfully`);
        } else if (action === 'reject') {
          logger.log(`🔴 [BULK] Rejecting shift swap request at stage ${currentStage}`);

          // Reject the request
          await query(
            `UPDATE shift_swap_requests
             SET status = 'rejected',
                 rejection_stage = $1,
                 rejection_reason_th = $2,
                 rejection_reason_en = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [
              currentStage === 1 || currentStage === 2 ? 'department' : 'hr',
              rejection_reason,
              shiftRequest.id
            ]
          );

          logger.log(`✅ [BULK] Shift swap request ${shiftRequest.id} rejected`);

          // Audit log
          await logApprove(
            userId,
            'shift_swap_request',
            shiftRequest.id,
            event,
            {
              approval_stage: currentStage,
              action: 'reject',
              rejection_reason,
              bulk_action: true
            }
          );

          result.successful++;
          result.approved_requests.push({
            id: shiftRequest.id,
            employee_name: shiftRequest.employee_name_th || shiftRequest.employee_name_en,
            employee_code: shiftRequest.employee_code,
            off_date: shiftRequest.off_date,
            work_date: shiftRequest.work_date,
            status: 'rejected',
          });
        }
      } catch (error: any) {
        logger.error(`❌ [BULK] Failed to process shift swap request ${shiftRequest.id}:`, error);
        result.failed++;
        result.errors.push({
          request_id: shiftRequest.id,
          reason: error.message,
        });
      }
    }

    logger.log('Bulk Approval Result:', result);

    return successResponse({
      ...result,
      message: `Bulk ${action} completed: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`,
    });
  } catch (error: any) {
    logger.error('Bulk approval error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
};

export const handler: Handler = requireAuth(bulkApproveShiftSwaps);
