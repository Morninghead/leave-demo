// src/api/shift.ts - FIXED VERSION
import { logger } from '../utils/logger';
import api from './auth';
import axios from 'axios';
import { ShiftSwapRequest, ShiftSwapFormData, WorkOffSwapFormData } from '../types/shift';

const handleApiError = (error: unknown, defaultMessage: string): never => {
  logger.error(`${defaultMessage} error:`, error);
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as { error?: string; message?: string };
    throw new Error(data.error || data.message || defaultMessage);
  }
  throw new Error(defaultMessage);
};
export type { ShiftSwapRequest, ShiftSwapFormData, WorkOffSwapFormData };

/**
 * Get shift swap requests (for history/list view)
 */
export async function getShiftSwapRequests(status?: string): Promise<ShiftSwapRequest[]> {
  try {
    const params = status ? { status } : {};

    const response = await api.get<{
      success: boolean;
      shift_swap_requests: ShiftSwapRequest[];
    }>('/shift-swap-requests', { params });

    if (!response.data.success) {
      throw new Error('Failed to get shift swaps');
    }

    return response.data.shift_swap_requests || [];
  } catch (error) {
    return handleApiError(error, 'Failed to fetch shift swap requests');
  }
}

/**
 * Get MY shift swap requests (for current user)
 */
export async function getMyShiftSwaps(): Promise<ShiftSwapRequest[]> {
  try {
    const response = await api.get<{
      success: boolean;
      shift_swap_requests: ShiftSwapRequest[];
    }>('/shift-swap-requests?for_approval=false');

    if (!response.data.success) {
      throw new Error('Failed to get my shift swaps');
    }

    return response.data.shift_swap_requests || [];
  } catch (error) {
    return handleApiError(error, 'Failed to fetch your shift swap requests');
  }
}

/**
 * Get all pending shift swap requests for approval
 */
export async function getPendingShiftSwaps(): Promise<ShiftSwapRequest[]> {
  try {
    const response = await api.get<{
      success: boolean;
      shift_requests: ShiftSwapRequest[];
    }>('/shift-requests?for_approval=true');

    if (!response.data.success) {
      throw new Error('Failed to get shift swaps');
    }

    return response.data.shift_requests || [];
  } catch (error) {
    return handleApiError(error, 'Failed to fetch shift swaps');
  }
}

/**
 * Get shift swap request by ID
 */
export async function getShiftSwapById(id: string): Promise<ShiftSwapRequest> {
  try {
    const response = await api.get<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest; // ✅ แก้เป็น shift_swap_request
    }>(`/shift-swap/${id}`);

    if (!response.data.success) {
      throw new Error('Failed to get shift swap');
    }

    return response.data.shift_swap_request; // ✅ แก้เป็น shift_swap_request
  } catch (error) {
    return handleApiError(error, 'Failed to fetch shift swap');
  }
}

/**
 * Create new work/off swap request
 */
export async function createWorkOffSwapRequest(data: WorkOffSwapFormData): Promise<ShiftSwapRequest> {
  try {
    const response = await api.post<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest;
    }>('/shift-swap-create', data);

    if (!response.data.success) {
      throw new Error('Failed to create shift swap');
    }

    return response.data.shift_swap_request;
  } catch (error) {
    return handleApiError(error, 'Failed to create shift swap');
  }
}

/**
 * Create new shift swap request
 */
export async function createShiftSwapRequest(data: ShiftSwapFormData): Promise<ShiftSwapRequest> {
  try {
    const response = await api.post<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest; // ✅ แก้เป็น shift_swap_request
    }>('/shift-swap-create', data);

    if (!response.data.success) {
      throw new Error('Failed to create shift swap');
    }

    return response.data.shift_swap_request; // ✅ แก้เป็น shift_swap_request
  } catch (error: any) {
    logger.error('Create shift swap error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to create shift swap'
    );
  }
}

/**
 * Approve shift swap request
 */
export async function approveShiftSwap(id: string, note?: string): Promise<ShiftSwapRequest> {
  try {
    const response = await api.put<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest;
    }>(`/shift-swap-update/${id}`, {
      action: 'approve',  // ✅ Changed from 'status' to 'action'
      approver_note: note,
    });

    if (!response.data.success) {
      throw new Error('Failed to approve shift swap');
    }

    return response.data.shift_swap_request;
  } catch (error) {
    return handleApiError(error, 'Failed to approve shift swap');
  }
}

/**
 * Reject shift swap request
 */
export async function rejectShiftSwap(id: string, note: string): Promise<ShiftSwapRequest> {
  try {
    const response = await api.put<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest;
    }>(`/shift-swap-update/${id}`, {
      action: 'reject',  // ✅ Changed from 'status' to 'action'
      rejection_reason: note,
    });

    if (!response.data.success) {
      throw new Error('Failed to reject shift swap');
    }

    return response.data.shift_swap_request;
  } catch (error) {
    return handleApiError(error, 'Failed to reject shift swap');
  }
}

/**
 * Cancel shift swap request (by requester)
 */
export async function cancelShiftSwap(id: string): Promise<ShiftSwapRequest> {
  try {
    const response = await api.put<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest;
    }>(`/shift-swap-update/${id}`, {
      action: 'cancel',  // ✅ Changed from 'status' to 'action'
    });

    if (!response.data.success) {
      throw new Error('Failed to cancel shift swap');
    }

    return response.data.shift_swap_request;
  } catch (error) {
    return handleApiError(error, 'Failed to cancel shift swap');
  }
}

/**
 * Update shift request status (generic function)
 * เพิ่ม function นี้เพื่อ compatibility กับ ShiftSwapApprovalPage
 */
export async function updateShiftRequestStatus(
  id: string,
  data: { status: string; rejection_reason?: string }
): Promise<void> {
  // ✅ Convert 'status' to 'action' for backend compatibility
  const action = data.status === 'approved' ? 'approve'
    : data.status === 'rejected' ? 'reject'
      : data.status === 'canceled' ? 'cancel'
        : data.status;

  await api.put(`/shift-swap-update/${id}`, {
    action,
    rejection_reason: data.rejection_reason,
  });
}

/**
 * Void an approved shift swap request (HR/Admin only)
 */
export async function voidShiftSwap(
  id: string,
  voidReason: string
): Promise<{ success: boolean; shift_swap_request: ShiftSwapRequest; message: string }> {
  try {
    logger.log('🔵 [FRONTEND] Calling voidShiftSwap:', { id, voidReason });

    const response = await api.post<{
      success: boolean;
      shift_swap_request: ShiftSwapRequest;
      message: string;
    }>('/shift-swap-void', {
      request_id: id,
      void_reason: voidReason,
    });

    logger.log('✅ [FRONTEND] Void shift swap response:', response.data);

    if (!response.data.success) {
      throw new Error('Failed to void shift swap request');
    }

    return response.data;
  } catch (error) {
    return handleApiError(error, 'Failed to void shift swap request');
  }
}
