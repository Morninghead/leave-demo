// netlify/functions/shift-swap-create.ts - Enhanced with auto-skip
import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getApprovalFlowWithAutoSkip } from './utils/approval-flow';

// Generate unique request number
async function generateRequestNumber(year: number): Promise<string> {
  const prefix = `SS${year}`;
  
  const result = await query(
    `SELECT request_number 
     FROM shift_swap_requests 
     WHERE request_number LIKE $1 
     ORDER BY request_number DESC 
     LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].request_number.replace(prefix, '');
    nextNumber = parseInt(lastNumber, 10) + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

const createShiftSwapRequest = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const userId = event.user?.userId;
  if (!userId) {
    return errorResponse('User not authenticated', 401);
  }

  try {
    console.log('=== CREATE SHIFT SWAP REQUEST ===');
    console.log('User ID:', userId);
    console.log('Request Body:', event.body);

    const body = JSON.parse(event.body || '{}');
    const { work_date, off_date, reason_th, reason_en } = body;

    // Validation
    if (!work_date || !off_date) {
      return errorResponse('Work date and off date are required', 400);
    }

    // Check if dates are different
    if (work_date === off_date) {
      return errorResponse('Work date and off date must be different', 400);
    }

    // Check if request already exists
    const existingRequest = await query(
      `SELECT id FROM shift_swap_requests 
       WHERE employee_id = $1 
       AND work_date = $2 
       AND off_date = $3 
       AND status IN ('pending', 'approved')`,
      [userId, work_date, off_date]
    );

    if (existingRequest.length > 0) {
      return errorResponse('A similar swap request already exists', 400);
    }

    // Get employee department for approval flow
    const employeeResult = await query(
      'SELECT id, department_id FROM employees WHERE id = $1',
      [userId]
    );

    if (employeeResult.length === 0) {
      return errorResponse('Employee not found', 404);
    }

    const employee = employeeResult[0];

    // Generate request number
    const currentYear = new Date().getFullYear();
    const requestNumber = await generateRequestNumber(currentYear);

    console.log('✅ Generated request number:', requestNumber);

    // ===== CHECK FOR AUTO-SKIP (NEW!) =====
    console.log('🔍 [CREATE] Checking for auto-skip stages...');
    const approvalFlow = await getApprovalFlowWithAutoSkip(userId, employee.department_id);

    const initialStage = approvalFlow.initialStage;
    const skippedStages = approvalFlow.skippedStages;
    const autoSkipReason = approvalFlow.autoSkipReason;

    // Determine initial status
    let initialStatus = 'pending';
    if (skippedStages.length === approvalFlow.totalStages) {
      // All stages skipped = auto-approved
      initialStatus = 'approved';
      console.log('✅ [CREATE] All stages skipped - shift swap will be auto-approved');
    } else if (skippedStages.length > 0) {
      console.log(`⏭️  [CREATE] Skipping stages: ${skippedStages.join(', ')}`);
      console.log(`📍 [CREATE] Starting at stage: ${initialStage}`);
    }

    // ✅ PROFESSIONAL HRM: Calculate annual swap count and validate limit
    const ANNUAL_SWAP_LIMIT = 12; // Thailand labor law standard

    // Get current approved swaps count for this employee/year
    const currentApprovedCount = await query(
      `SELECT COUNT(*) as approved_count
       FROM shift_swap_requests
       WHERE employee_id = $1
         AND year = $2
         AND status = 'approved'`,
      [userId, currentYear]
    );

    const approvedCount = parseInt(currentApprovedCount[0].approved_count);
    const newSwapCount = approvedCount + 1; // This will be the count if this request gets approved

    console.log(`📊 [CREATE] Employee ${userId} has ${approvedCount} approved swaps for ${currentYear}`);
    console.log(`📊 [CREATE] New swap will count as #${newSwapCount} if approved`);
    console.log(`📊 [CREATE] Annual limit: ${ANNUAL_SWAP_LIMIT} swaps`);

    // Validate annual swap limit
    if (approvedCount >= ANNUAL_SWAP_LIMIT) {
      return errorResponse(
        `Annual shift swap limit exceeded. You have used ${approvedCount} out of ${ANNUAL_SWAP_LIMIT} allowed swaps for ${currentYear}.`,
        400
      );
    }

    if (newSwapCount > ANNUAL_SWAP_LIMIT && initialStatus === 'approved') {
      return errorResponse(
        `This swap request would exceed your annual limit of ${ANNUAL_SWAP_LIMIT} swaps. You have ${approvedCount} approved swaps and this would make it ${newSwapCount}.`,
        400
      );
    }

    // Create shift swap request
    const result = await query(
      `INSERT INTO shift_swap_requests (
        request_number,
        employee_id,
        work_date,
        off_date,
        reason_th,
        reason_en,
        year,
        swap_count_for_year,
        status,
        current_approval_stage,
        skipped_stages,
        auto_skip_reason,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        requestNumber,
        userId,
        work_date,
        off_date,
        reason_th || '',
        reason_en || '',
        currentYear,
        initialStatus === 'approved' ? newSwapCount : newSwapCount - 1, // Only count if approved
        initialStatus,
        initialStage,
        JSON.stringify(skippedStages),
        autoSkipReason
      ]
    );

    console.log('✅ Shift swap request created:', result[0].id);

    // Fetch with employee details
    const swapRequest = await query(
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
      [result[0].id]
    );

    return successResponse({
      shift_swap_request: swapRequest[0],
      message: 'Shift swap request created successfully',
    });

  } catch (error: any) {
    console.error('❌ Create shift swap error:', error);
    return errorResponse(error.message || 'Failed to create shift swap request', 500);
  }
};

export const handler: Handler = requireAuth(createShiftSwapRequest);
