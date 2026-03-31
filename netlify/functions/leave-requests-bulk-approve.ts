/**
 * Bulk Approve Leave Requests
 *
 * Allows managers/HR to approve multiple leave requests at once with filtering
 * Filters: department, date range, month, week, status
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { canUserApprove, getNextStage, getApprovalFlow } from './utils/approval-flow';
import { sendLeaveRequestApproved } from './utils/email-service';
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
    leave_type_id?: string;
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

const bulkApproveLeaveRequests = async (event: AuthenticatedEvent) => {
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

    logger.log('=== BULK APPROVE LEAVE REQUESTS ===');
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

    // Build query to fetch pending leave requests
    let queryText = `
      SELECT
        lr.*,
        e.department_id,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        lt.name_th as leave_type_th,
        lt.name_en as leave_type_en
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'pending'
    `;

    const queryParams: any[] = [];
    let paramCounter = 1;

    // Apply filters
    if (request_ids && request_ids.length > 0) {
      queryText += ` AND lr.id = ANY($${paramCounter}::uuid[])`;
      queryParams.push(request_ids);
      paramCounter++;
    }

    if (filters?.department_id) {
      queryText += ` AND e.department_id = $${paramCounter}`;
      queryParams.push(filters.department_id);
      paramCounter++;
    }

    if (filters?.leave_type_id) {
      queryText += ` AND lr.leave_type_id = $${paramCounter}`;
      queryParams.push(filters.leave_type_id);
      paramCounter++;
    }

    if (filters?.date_range) {
      queryText += ` AND lr.start_date >= $${paramCounter}`;
      queryParams.push(filters.date_range.start);
      paramCounter++;
      queryText += ` AND lr.end_date <= $${paramCounter}`;
      queryParams.push(filters.date_range.end);
      paramCounter++;
    }

    if (filters?.month) {
      // YYYY-MM format
      const [year, month] = filters.month.split('-');
      queryText += ` AND EXTRACT(YEAR FROM lr.start_date) = $${paramCounter}`;
      queryParams.push(parseInt(year));
      paramCounter++;
      queryText += ` AND EXTRACT(MONTH FROM lr.start_date) = $${paramCounter}`;
      queryParams.push(parseInt(month));
      paramCounter++;
    }

    if (filters?.week) {
      queryText += ` AND lr.start_date >= $${paramCounter}`;
      queryParams.push(filters.week.start);
      paramCounter++;
      queryText += ` AND lr.start_date <= $${paramCounter}`;
      queryParams.push(filters.week.end);
      paramCounter++;
    }

    queryText += ` ORDER BY lr.created_at ASC`;

    logger.log('Fetch Query:', queryText);
    logger.log('Query Params:', queryParams);

    const leaveRequests = await query(queryText, queryParams);

    if (leaveRequests.length === 0) {
      return successResponse({
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        approved_requests: [],
        message: 'No pending leave requests found matching filters',
      });
    }

    logger.log(`Found ${leaveRequests.length} pending leave requests`);

    const result: BulkApproveResult = {
      total: leaveRequests.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      approved_requests: [],
    };

    // Process each leave request
    for (const leaveRequest of leaveRequests) {
      try {
        logger.log(`\n📋 [BULK] Processing request ${leaveRequest.id}`, {
          employee_id: leaveRequest.employee_id,
          employee_code: leaveRequest.employee_code,
          current_stage: leaveRequest.current_approval_stage
        });

        // ⭐ CHECK FOR SELF-APPROVAL: Skip if user is approving their own request
        if (userId === leaveRequest.employee_id) {
          logger.warn(`⏭️  [BULK] Skipping request ${leaveRequest.id}: User cannot approve own request`);
          result.skipped++;
          result.errors.push({
            request_id: leaveRequest.id,
            reason: 'Self-approval not allowed - skipped',
          });
          continue;
        }

        // Check if user can approve this request
        const canApprove = await canUserApprove(
          userId,
          leaveRequest.employee_id,
          leaveRequest.department_id,
          leaveRequest.current_approval_stage
        );

        if (!canApprove.allowed) {
          logger.warn(`⏭️  [BULK] Skipping request ${leaveRequest.id}: ${canApprove.reason}`);
          result.skipped++;
          result.errors.push({
            request_id: leaveRequest.id,
            reason: `Permission denied: ${canApprove.reason}`,
          });
          continue;
        }

        logger.log(`✅ [BULK] User authorized to approve - shouldBypassToFinal: ${canApprove.shouldBypassToFinal}`);

        // Get approval flow for this employee
        const approvalFlow = await getApprovalFlow(leaveRequest.employee_id);
        const currentStage = leaveRequest.current_approval_stage;

        if (action === 'approve') {
          logger.log(`🔵 [BULK] Approving request at stage ${currentStage}`);

          // ⭐ HR BYPASS: If HR is approving and should bypass to final, set isFinalStage to true
          let isFinalStage = false;
          let nextStage: number | null = null;

          if (canApprove.shouldBypassToFinal) {
            logger.log('⭐ [BULK] HR BYPASS DETECTED - Immediately approving request!');
            isFinalStage = true;
          } else {
            // Get skipped stages if any
            const skippedStagesArray = leaveRequest.skipped_stages
              ? (typeof leaveRequest.skipped_stages === 'string'
                ? JSON.parse(leaveRequest.skipped_stages)
                : leaveRequest.skipped_stages)
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
            // Stage 1: Department Manager
            if (isFinalStage) {
              // ⭐ HR BYPASS: Also set HR approval fields if HR is bypassing
              if (canApprove.shouldBypassToFinal) {
                logger.log('⭐ [BULK] HR BYPASS at stage 1 - Setting both manager and HR approval fields');
                updateQuery = `
                  UPDATE leave_requests
                  SET department_manager_approved_by = $1,
                      department_manager_approved_at = NOW(),
                      hr_approved_by = $1,
                      hr_approved_at = NOW(),
                      status = 'approved',
                      updated_at = NOW()
                  WHERE id = $2
                `;
                updateParams = [userId, leaveRequest.id];
              } else {
                updateQuery = `
                  UPDATE leave_requests
                  SET department_manager_approved_by = $1,
                      department_manager_approved_at = NOW(),
                      status = 'approved',
                      updated_at = NOW()
                  WHERE id = $2
                `;
                updateParams = [userId, leaveRequest.id];
              }
            } else {
              // Move to Stage 2 (HR)
              updateQuery = `
                UPDATE leave_requests
                SET department_manager_approved_by = $1,
                    department_manager_approved_at = NOW(),
                    current_approval_stage = $2,
                    updated_at = NOW()
                WHERE id = $3
              `;
              updateParams = [userId, nextStage, leaveRequest.id];
            }
          } else if (currentStage === 2) {
            // Stage 2: HR Confirmation (Final)
            updateQuery = `
              UPDATE leave_requests
              SET hr_approved_by = $1,
                  hr_approved_at = NOW(),
                  status = 'approved',
                  updated_at = NOW()
              WHERE id = $2
            `;
            updateParams = [userId, leaveRequest.id];
            isFinalStage = true; // Ensure it's treated as final
          } else if (currentStage === 3) {
            // Fallback/Legacy
            updateQuery = `
              UPDATE leave_requests
              SET hr_approved_by = $1,
                  hr_approved_at = NOW(),
                  status = 'approved',
                  updated_at = NOW()
              WHERE id = $2
            `;
            updateParams = [userId, leaveRequest.id];
            isFinalStage = true;
          }

          // Execute update
          await query(updateQuery, updateParams);
          logger.log(`✅ [BULK] Request updated successfully`);

          // If fully approved, deduct from balance
          if (isFinalStage) {
            const currentYear = new Date().getFullYear();
            await query(
              `UPDATE leave_balances
               SET pending_days = pending_days - $1,
                   used_days = used_days + $1,
                   updated_at = NOW()
               WHERE employee_id = $2
                 AND leave_type_id = $3
                 AND year = $4`,
              [
                leaveRequest.total_days,
                leaveRequest.employee_id,
                leaveRequest.leave_type_id,
                currentYear,
              ]
            );

            logger.log(`✅ [BULK] Leave balance updated for fully approved request`);
          }

          // Audit log
          await logApprove(
            userId,
            'leave_request',
            leaveRequest.id,
            event,
            {
              approval_stage: currentStage,
              is_final_stage: isFinalStage,
              bulk_action: true
            }
          );

          result.successful++;
          result.approved_requests.push({
            id: leaveRequest.id,
            employee_name: leaveRequest.employee_name_th || leaveRequest.employee_name_en,
            employee_code: leaveRequest.employee_code,
            leave_type: leaveRequest.leave_type_th || leaveRequest.leave_type_en,
            status: isFinalStage ? 'approved' : 'pending',
          });

          logger.log(`✅ [BULK] Request ${leaveRequest.id} processed successfully`);
        } else if (action === 'reject') {
          logger.log(`🔴 [BULK] Rejecting request at stage ${currentStage}`);

          // Reject the request
          await query(
            `UPDATE leave_requests
             SET status = 'rejected',
                 rejection_stage = $1,
                 rejection_reason_th = $2,
                 rejection_reason_en = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [
              currentStage === 1 || currentStage === 2 ? 'department' : 'hr',
              rejection_reason,
              leaveRequest.id
            ]
          );

          // Release pending balance
          const currentYear = new Date().getFullYear();
          await query(
            `UPDATE leave_balances
             SET pending_days = pending_days - $1,
                 updated_at = NOW()
             WHERE employee_id = $2
               AND leave_type_id = $3
               AND year = $4`,
            [leaveRequest.total_days, leaveRequest.employee_id, leaveRequest.leave_type_id, currentYear]
          );

          logger.log(`✅ [BULK] Request ${leaveRequest.id} rejected and balance released`);

          // Audit log
          await logApprove(
            userId,
            'leave_request',
            leaveRequest.id,
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
            id: leaveRequest.id,
            employee_name: leaveRequest.employee_name_th || leaveRequest.employee_name_en,
            employee_code: leaveRequest.employee_code,
            leave_type: leaveRequest.leave_type_th || leaveRequest.leave_type_en,
            status: 'rejected',
          });
        }
      } catch (error: any) {
        logger.error(`❌ [BULK] Failed to process request ${leaveRequest.id}:`, error);
        result.failed++;
        result.errors.push({
          request_id: leaveRequest.id,
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

export const handler: Handler = requireAuth(bulkApproveLeaveRequests);
