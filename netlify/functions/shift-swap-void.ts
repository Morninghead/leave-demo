import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { logUpdate } from './utils/audit-logger';

/**
 * Void Approved Shift Swap Request API
 * 
 * This endpoint allows HR/Admin to void an approved shift swap request.
 * When voided:
 * 1. The shift swap request status is changed to 'voided'
 * 2. An audit log is created
 * 
 * Use case: Shift swap didn't actually happen
 */

const voidShiftSwapRequest = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    const userId = event.user?.userId;
    const userRole = event.user?.role;

    if (!userId) {
        return errorResponse('User not authenticated', 401);
    }

    // Only HR and Admin can void approved requests
    if (!['hr', 'admin'].includes(userRole || '')) {
        return errorResponse('Only HR and Admin can void approved shift swap requests', 403);
    }

    try {
        logger.log('=== [BACKEND] VOID SHIFT SWAP REQUEST ===');

        if (!event.body) {
            return errorResponse('Request body is required', 400);
        }

        const body = JSON.parse(event.body);
        const { request_id, void_reason } = body;

        if (!request_id) {
            return errorResponse('request_id is required', 400);
        }

        if (!void_reason || void_reason.trim().length < 5) {
            return errorResponse('void_reason is required (minimum 5 characters)', 400);
        }

        logger.log('Voiding shift swap request:', request_id);
        logger.log('Reason:', void_reason);
        logger.log('By user:', userId, 'Role:', userRole);

        // Fetch the shift swap request
        const swapRequestResult = await query(
            `SELECT 
        ss.*,
        req.employee_code as requester_code,
        CONCAT(req.first_name_th, ' ', req.last_name_th) as requester_name_th,
        tgt.employee_code as target_code,
        CONCAT(tgt.first_name_th, ' ', tgt.last_name_th) as target_name_th
       FROM shift_swap_requests ss
       JOIN employees req ON ss.requester_id = req.id
       JOIN employees tgt ON ss.target_employee_id = tgt.id
       WHERE ss.id = $1`,
            [request_id]
        );

        if (swapRequestResult.length === 0) {
            return errorResponse('Shift swap request not found', 404);
        }

        const swapRequest = swapRequestResult[0];

        logger.log('Shift swap request found:', {
            id: swapRequest.id,
            requester_code: swapRequest.requester_code,
            target_code: swapRequest.target_code,
            status: swapRequest.status,
            swap_date: swapRequest.swap_date,
        });

        // Only approved requests can be voided
        if (swapRequest.status !== 'approved') {
            return errorResponse(
                `Only approved requests can be voided. Current status: ${swapRequest.status}`,
                400
            );
        }

        // Update the shift swap request status to 'voided'
        await query(
            `UPDATE shift_swap_requests
       SET status = 'voided',
           void_reason = $1,
           voided_by = $2,
           voided_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
            [void_reason, userId, request_id]
        );

        logger.log('✅ Shift swap request voided successfully');

        // Audit log
        await logUpdate(
            userId,
            'shift_swap_request',
            request_id,
            event,
            {
                action: 'void',
                void_reason,
                requester_id: swapRequest.requester_id,
                target_employee_id: swapRequest.target_employee_id,
                swap_date: swapRequest.swap_date,
                original_status: 'approved',
                new_status: 'voided',
            }
        );

        // Fetch updated request
        const updatedRequest = await query(
            `SELECT 
        ss.*,
        req.employee_code as requester_code,
        CONCAT(req.first_name_th, ' ', req.last_name_th) as requester_name_th,
        CONCAT(req.first_name_en, ' ', req.last_name_en) as requester_name_en,
        tgt.employee_code as target_code,
        CONCAT(tgt.first_name_th, ' ', tgt.last_name_th) as target_name_th,
        CONCAT(tgt.first_name_en, ' ', tgt.last_name_en) as target_name_en
       FROM shift_swap_requests ss
       LEFT JOIN employees req ON ss.requester_id = req.id
       LEFT JOIN employees tgt ON ss.target_employee_id = tgt.id
       WHERE ss.id = $1`,
            [request_id]
        );

        return successResponse({
            success: true,
            shift_swap_request: updatedRequest[0],
            message: 'Shift swap request voided successfully.',
        });

    } catch (error: any) {
        logger.error('❌ [BACKEND] Void shift swap request error:', {
            message: error.message,
            stack: error.stack,
        });
        return errorResponse(error.message || 'Failed to void shift swap request', 500);
    }
};

export const handler: Handler = requireAuth(voidShiftSwapRequest);
