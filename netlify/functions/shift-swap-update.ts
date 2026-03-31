import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { canUserApprove, getNextStage, getApprovalFlow } from './utils/approval-flow';


const updateShiftSwapRequest = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    if (!userId) {
      return errorResponse('User not authenticated', 401);
    }

    // Note: userId is a UUID string, not an integer
    // We keep it as a string and use string comparison
    const userIdStr = String(userId).trim();
    if (!userIdStr) {
      console.error('❌ Invalid userId format:', userId);
      return errorResponse('Invalid user ID format', 400);
    }

    const requestId = event.path.split('/').pop();
    if (!requestId) {
      return errorResponse('Request ID is required', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { action, rejection_reason } = body;

    console.log('=== UPDATE SHIFT SWAP REQUEST ===');
    console.log('Request ID:', requestId);
    console.log('Action:', action);

    // Validate action
    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return errorResponse('Invalid action. Must be "approve", "reject", or "cancel"', 400);
    }

    // Fetch current shift swap request
    const swapRequestResult = await query(
      `SELECT sr.*, e.department_id
       FROM shift_swap_requests sr
       JOIN employees e ON sr.employee_id = e.id
       WHERE sr.id = $1`,
      [requestId]
    );

    if (swapRequestResult.length === 0) {
      return errorResponse('Shift swap request not found', 404);
    }

    const swapRequest = swapRequestResult[0];
    console.log('✅ Shift swap request found:', {
      id: swapRequest.id,
      employee_id: swapRequest.employee_id,
      status: swapRequest.status,
      current_approval_stage: swapRequest.current_approval_stage,
    });

    // ===== HANDLE CANCEL ACTION =====
    if (action === 'cancel') {
      if (String(swapRequest.employee_id).trim() !== userIdStr) {
        return errorResponse('You can only cancel your own shift swap requests', 403);
      }

      if (swapRequest.status !== 'pending') {
        return errorResponse(
          `Only pending requests can be canceled. Current status: ${swapRequest.status}`,
          400
        );
      }

      // ✅ PROFESSIONAL HRM: Decrement annual swap counter when canceled
      const currentYear = new Date().getFullYear();

      // First update the request status
      await query(
        `UPDATE shift_swap_requests
         SET status = 'canceled',
             canceled_by = $1,
             canceled_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [userIdStr, requestId]
      );

      // Then decrement the annual swap counter for this employee (if year column exists)
      try {
        await query(
          `UPDATE shift_swap_requests
           SET swap_count_for_year = COALESCE(swap_count_for_year, 0) - 1
           WHERE employee_id = $1
             AND EXTRACT(YEAR FROM created_at) = $2
             AND id != $3
             AND swap_count_for_year > 0`,
          [swapRequest.employee_id, currentYear, requestId]
        );
      } catch (yearError) {
        console.log('⚠️ Year column update skipped (column may not exist):', yearError);
      }

      console.log(`✅ Shift swap request canceled for employee ${swapRequest.employee_id}`);

      const updatedRequest = await query(
        `SELECT sr.*, e.employee_code,
                CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
                CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
                d.name_th as department_name_th,
                d.name_en as department_name_en
         FROM shift_swap_requests sr
         JOIN employees e ON sr.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE sr.id = $1`,
        [requestId]
      );

      return successResponse({
        shift_swap_request: updatedRequest[0],
        message: 'Shift swap request canceled successfully',
      });
    }

    // ===== HANDLE APPROVE/REJECT ACTIONS =====
    if (swapRequest.status !== 'pending') {
      return errorResponse(
        `Cannot ${action} a request with status: ${swapRequest.status}`,
        400
      );
    }

    const canApprove = await canUserApprove(
      userId,
      swapRequest.employee_id.toString(),
      swapRequest.department_id.toString(),
      swapRequest.current_approval_stage
    );

    if (!canApprove.allowed) {
      return errorResponse(canApprove.reason || 'Not authorized to approve', 403);
    }

    const currentStage = swapRequest.current_approval_stage;

    // REJECT action
    if (action === 'reject') {
      if (!rejection_reason || rejection_reason.trim() === '') {
        return errorResponse('Rejection reason is required', 400);
      }

      // ✅ PROFESSIONAL HRM: Decrement annual swap counter when rejected
      const currentYear = new Date().getFullYear();

      // First update the request status
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
          requestId,
        ]
      );

      // Then decrement the annual swap counter for this employee (if column exists)
      try {
        await query(
          `UPDATE shift_swap_requests
           SET swap_count_for_year = COALESCE(swap_count_for_year, 0) - 1
           WHERE employee_id = $1
             AND EXTRACT(YEAR FROM created_at) = $2
             AND id != $3
             AND swap_count_for_year > 0`,
          [swapRequest.employee_id, currentYear, requestId]
        );
      } catch (yearError) {
        console.log('⚠️ Year column update skipped (column may not exist):', yearError);
      }

      console.log(`✅ Shift swap request rejected for employee ${swapRequest.employee_id}`);

      const rejectedRequest = await query(
        `SELECT sr.*, e.employee_code,
                CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
                CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
                d.name_th as department_name_th,
                d.name_en as department_name_en
         FROM shift_swap_requests sr
         JOIN employees e ON sr.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE sr.id = $1`,
        [requestId]
      );

      return successResponse({
        shift_swap_request: rejectedRequest[0],
        message: 'Shift swap request rejected',
      });
    }

    // APPROVE action
    const approvalFlow = await getApprovalFlow(swapRequest.employee_id);

    // Check for skipped stages
    const skippedStagesArray = swapRequest.skipped_stages
      ? (typeof swapRequest.skipped_stages === 'string'
        ? JSON.parse(swapRequest.skipped_stages)
        : swapRequest.skipped_stages)
      : [];

    // Find next non-skipped stage
    let nextStage = getNextStage(currentStage, approvalFlow.totalStages);
    while (nextStage && skippedStagesArray.includes(nextStage)) {
      console.log(`⏭️  Stage ${nextStage} is skipped, moving to next...`);
      nextStage = getNextStage(nextStage, approvalFlow.totalStages);
    }

    const isFinalStage = nextStage === null;

    let updateQuery = '';
    let updateParams: any[] = [];

    if (currentStage === 1) {
      if (isFinalStage) {
        updateQuery = `
          UPDATE shift_swap_requests
          SET department_admin_approved_by = $1,
              department_admin_approved_at = NOW(),
              status = 'approved',
              updated_at = NOW()
          WHERE id = $2
        `;
        updateParams = [userIdStr, requestId];
      } else {
        updateQuery = `
          UPDATE shift_swap_requests
          SET department_admin_approved_by = $1,
              department_admin_approved_at = NOW(),
              current_approval_stage = $2,
              updated_at = NOW()
          WHERE id = $3
        `;
        updateParams = [userIdStr, nextStage, requestId];
      }
    } else if (currentStage === 2) {
      if (isFinalStage) {
        updateQuery = `
          UPDATE shift_swap_requests
          SET department_manager_approved_by = $1,
              department_manager_approved_at = NOW(),
              status = 'approved',
              updated_at = NOW()
          WHERE id = $2
        `;
        updateParams = [userIdStr, requestId];
      } else {
        updateQuery = `
          UPDATE shift_swap_requests
          SET department_manager_approved_by = $1,
              department_manager_approved_at = NOW(),
              current_approval_stage = $2,
              updated_at = NOW()
          WHERE id = $3
        `;
        updateParams = [userIdStr, nextStage, requestId];
      }
    } else if (currentStage === 3) {
      updateQuery = `
        UPDATE shift_swap_requests
        SET hr_approved_by = $1,
            hr_approved_at = NOW(),
            status = 'approved',
            updated_at = NOW()
        WHERE id = $2
      `;
      updateParams = [userIdStr, requestId];
    }

    await query(updateQuery, updateParams);
    console.log('✅ Shift swap request approved successfully');

    // ✅ PROFESSIONAL HRM: Update annual swap count if this is the FINAL stage
    if (isFinalStage) {
      const currentYear = new Date().getFullYear();

      try {
        // Count approved swaps for this employee this year
        const approvedCount = await query(
          `SELECT COUNT(*) as count
           FROM shift_swap_requests
           WHERE employee_id = $1
             AND EXTRACT(YEAR FROM created_at) = $2
             AND status = 'approved'`,
          [swapRequest.employee_id, currentYear]
        );

        const newCount = parseInt(approvedCount[0].count);

        // Update this specific request with the correct count
        await query(
          `UPDATE shift_swap_requests
           SET swap_count_for_year = $1
           WHERE id = $2`,
          [newCount, requestId]
        );

        console.log(`✅ Annual swap counter updated: Employee ${swapRequest.employee_id} now has ${newCount} approved swaps for ${currentYear}`);
      } catch (yearError) {
        console.log('⚠️ Year column update skipped (column may not exist):', yearError);
      }
    }

    // Fetch with employee details
    const updatedRequest = await query(
      `SELECT
        sr.*,
        e.employee_code,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en
      FROM shift_swap_requests sr
      JOIN employees e ON sr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE sr.id = $1`,
      [requestId]
    );

    const finalStatus = isFinalStage
      ? 'approved and finalized'
      : 'approved to next stage';

    return successResponse({
      shift_swap_request: updatedRequest[0],
      message: `Shift swap request ${finalStatus}`,
    });

  } catch (error: any) {
    console.error('❌ Update shift swap error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return errorResponse(error.message || 'Failed to update shift swap request', 500);
  }
};

export const handler: Handler = requireAuth(updateShiftSwapRequest);
