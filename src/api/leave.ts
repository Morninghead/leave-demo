// src/api/leave.ts
import api from './auth';
import { LeaveType, LeaveBalance, LeaveRequest, CreateLeaveRequestData, UpdateLeaveRequestData, BalanceHistory, LeaveBalanceResponse, BalanceSummary } from '../types/leave';
import { logger } from '../utils/logger';
export type { LeaveType, LeaveBalance, LeaveRequest, CreateLeaveRequestData, UpdateLeaveRequestData, BalanceHistory, LeaveBalanceResponse };

// Get Leave Types
export async function getLeaveTypes(): Promise<LeaveType[]> {
  try {
    const response = await api.get<{ success: boolean; leave_types: LeaveType[] }>(
      '/leave-types'
    );
    if (!response.data.success) {
      throw new Error('Failed to get leave types');
    }
    return response.data.leave_types || [];
  } catch (error: any) {
    logger.error('Get leave types error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to get leave types'
    );
  }
}

// Delete Leave Type
export async function deleteLeaveType(id: string): Promise<{ success: boolean; message: string }> {
  try {
    logger.debug('Calling deleteLeaveType from leave.ts with ID:', id);
    logger.debug('Request URL:', `/.netlify/functions/leave-type-delete/${id}`);

    const response = await api.delete<{ success: boolean; message: string }>(
      `/leave-type-delete/${id}`
    );
    if (!response.data.success) {
      throw new Error('Failed to delete leave type');
    }
    return response.data;
  } catch (error: any) {
    logger.error('Delete leave type error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to delete leave type'
    );
  }
}

// Get Leave Balances
export async function getLeaveBalances(year?: number): Promise<LeaveBalanceResponse> {
  try {
    const currentYear = year || new Date().getFullYear();
    const timestamp = Date.now(); // Cache-busting timestamp
    const response = await api.get<{
      success: boolean;
      leave_balances: LeaveBalance[];
      summary: BalanceSummary;
    }>(`/leave-balance?year=${currentYear}&_t=${timestamp}`);
    logger.log('API Response:', response.data);

    if (response.data && response.data.leave_balances) {
      return {
        balances: response.data.leave_balances,
        summary: response.data.summary,
      };
    }
    return { balances: [], summary: { total_entitled: 0, total_used: 0, total_remaining: 0, total_pending: 0 } };
  } catch (error: any) {
    logger.error('Get leave balances error:', error);
    logger.error('Error response:', error.response?.data);
    return { balances: [], summary: { total_entitled: 0, total_used: 0, total_remaining: 0, total_pending: 0 } };
  }
}

// Get Leave Requests
export async function getLeaveRequests(params?: {
  status?: string;
  for_approval?: boolean;
  for_void_management?: boolean;
}): Promise<LeaveRequest[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.for_approval !== undefined) {
      queryParams.append('for_approval', String(params.for_approval));
    }
    if (params?.for_void_management !== undefined) {
      queryParams.append('for_void_management', String(params.for_void_management));
    }

    const queryString = queryParams.toString();
    const timestamp = Date.now(); // Cache-busting timestamp
    const urlWithTimestamp = queryString ? `/leave-requests?${queryString}&_t=${timestamp}` : `/leave-requests?_t=${timestamp}`;

    const response = await api.get<{
      success: boolean;
      leave_requests: LeaveRequest[];
    }>(urlWithTimestamp);

    if (!response.data.success) {
      throw new Error('Failed to get leave requests');
    }
    return response.data.leave_requests || [];
  } catch (error: any) {
    logger.error('Get leave requests error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to get leave requests'
    );
  }
}

// ✅ Get Pending Leave Requests for Approval
export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const response = await api.get<{
      success: boolean;
      leave_requests: LeaveRequest[];
    }>('/leave-requests', {
      params: { for_approval: 'true' }
    });

    if (!response.data.success) {
      throw new Error('Failed to get pending leave requests');
    }

    return response.data.leave_requests || [];
  } catch (error: any) {
    logger.error('Get pending leave requests error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to fetch pending leave requests'
    );
  }
}

// Get Single Leave Request
export async function getLeaveRequest(id: string): Promise<LeaveRequest> {
  try {
    const response = await api.get<{
      success: boolean;
      leave_request: LeaveRequest;
    }>(`/leave-request/${id}`);

    if (!response.data.success) {
      throw new Error('Failed to get leave request');
    }
    return response.data.leave_request;
  } catch (error: any) {
    logger.error('Get leave request error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to get leave request'
    );
  }
}

// Create Leave Request
export async function createLeaveRequest(
  data: CreateLeaveRequestData
): Promise<LeaveRequest> {
  try {
    const response = await api.post<{
      success: boolean;
      leave_request: LeaveRequest;
    }>('/leave-request-create', data);

    if (!response.data.success) {
      throw new Error('Failed to create leave request');
    }
    return response.data.leave_request;
  } catch (error: any) {
    logger.error('Create leave request error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to create leave request'
    );
  }
}

// Update Leave Request Status
export async function updateLeaveRequestStatus(
  id: string,
  action: 'approve' | 'reject' | 'cancel',
  rejection_reason?: string
): Promise<LeaveRequest> {
  try {
    const payload = {
      action,
      rejection_reason,
    };

    logger.log('🔵 [FRONTEND] Calling updateLeaveRequestStatus:', {
      id,
      payload,
      url: `/leave-request-update/${id}`,
    });

    const response = await api.put<{
      success: boolean;
      leave_request: LeaveRequest;
    }>(`/leave-request-update/${id}`, payload);

    logger.log('✅ [FRONTEND] Response received:', response.data);

    if (!response.data.success) {
      throw new Error('Failed to update leave request');
    }

    return response.data.leave_request;
  } catch (error: any) {
    logger.error('❌ [FRONTEND] Update leave request status error:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
    });

    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to update leave request'
    );
  }
}

// Approve leave request
export async function approveLeaveRequest(id: string, note?: string): Promise<LeaveRequest> {
  try {
    const response = await api.put<{
      success: boolean;
      leave_request: LeaveRequest;
    }>(`/leave-request-update/${id}`, {
      action: 'approve',
      approver_note: note,
    });

    if (!response.data.success) {
      throw new Error('Failed to approve leave request');
    }

    return response.data.leave_request;
  } catch (error: any) {
    logger.error('Approve leave request error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to approve leave request'
    );
  }
}

// Reject leave request
export async function rejectLeaveRequest(id: string, reason: string): Promise<LeaveRequest> {
  try {
    const response = await api.put<{
      success: boolean;
      leave_request: LeaveRequest;
    }>(`/leave-request-update/${id}`, {
      action: 'reject',
      rejection_reason: reason,
    });

    if (!response.data.success) {
      throw new Error('Failed to reject leave request');
    }

    return response.data.leave_request;
  } catch (error: any) {
    logger.error('Reject leave request error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to reject leave request'
    );
  }
}

export async function adjustLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  adjustmentDays: number,
  reason: string
): Promise<LeaveBalance> {
  try {
    const response = await api.post<{
      success: boolean;
      leave_balance: LeaveBalance;
    }>('/admin-leave-balance-adjust', {
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      year,
      adjustment_days: adjustmentDays,
      reason,
    });

    if (!response.data.success) {
      throw new Error('Failed to adjust leave balance');
    }

    return response.data.leave_balance;
  } catch (error: any) {
    logger.error('Adjust leave balance error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to adjust leave balance'
    );
  }
}
export async function getLeaveBalanceHistory(employeeId?: string): Promise<{ history: BalanceHistory[] }> {
  try {
    const url = employeeId ? `/leave-balance-history?employee_id=${employeeId}` : '/leave-balance-history';
    const response = await api.get<{ success: boolean; history: BalanceHistory[] }>(url);
    if (!response.data.success) {
      throw new Error('Failed to get leave balance history');
    }
    return response.data;
  } catch (error: any) {
    logger.error('Get leave balance history error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to get leave balance history'
    );
  }
}

export async function resetAllLeaveBalances(year: number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post<{ success: boolean; message: string }>(
      '/admin-reset-all-balances',
      { year }
    );
    if (!response.data.success) {
      throw new Error('Failed to reset leave balances');
    }
    return response.data;
  } catch (error: any) {
    logger.error('Reset leave balances error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to reset leave balances'
    );
  }
}

// Get approval flow information with approver names and auto-skip logic
export async function getApprovalFlowInfo(employeeId: string, departmentId: string) {
  try {
    const response = await api.get<{
      success: boolean;
      approvalFlow: {
        stages: Array<{
          stage: number;
          role: 'department_admin' | 'department_manager' | 'hr';
          description_th: string;
          description_en: string;
          approvers: Array<{
            id: string;
            employee_code: string;
            name_th: string;
            name_en: string;
            role: string;
          }>;
        }>;
        totalStages: number;
        currentStage: number;
        skippedStages: number[];
        autoSkipReason: string;
        originalStages: Array<{
          stage: number;
          role: 'department_admin' | 'department_manager' | 'hr';
          description_th: string;
          description_en: string;
          isAutoSkipped: boolean;
          autoSkipReason: string;
        }>;
      };
    }>('/approval-flow-info', {
      params: {
        employee_id: employeeId,
        department_id: departmentId,
      },
    });

    if (!response.data.success) {
      throw new Error('Failed to get approval flow information');
    }

    return response.data.approvalFlow;
  } catch (error: any) {
    logger.error('Get approval flow info error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to get approval flow information'
    );
  }
}

// Void an approved leave request and restore balance
export async function voidLeaveRequest(
  requestId: string,
  voidReason: string
): Promise<{ success: boolean; leave_request: LeaveRequest; balance_restored: number; message: string }> {
  try {
    logger.log('🔵 [FRONTEND] Calling voidLeaveRequest:', {
      requestId,
      voidReason,
    });

    const response = await api.post<{
      success: boolean;
      leave_request: LeaveRequest;
      balance_restored: number;
      message: string;
    }>('/leave-request-void', {
      request_id: requestId,
      void_reason: voidReason,
    });

    logger.log('✅ [FRONTEND] Void response received:', response.data);

    if (!response.data.success) {
      throw new Error('Failed to void leave request');
    }

    return response.data;
  } catch (error: any) {
    logger.error('❌ [FRONTEND] Void leave request error:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to void leave request'
    );
  }
}

// =============================================
// CANCELLATION REQUEST APIs
// =============================================

/**
 * Request cancellation of a leave request (Employee action)
 * - For PENDING requests: Cancels immediately
 * - For APPROVED requests: Creates cancellation request for HR approval
 */
export async function requestLeaveCancellation(
  requestId: string,
  cancellationReason: string
): Promise<{
  success: boolean;
  message: string;
  message_th?: string;
  status: string;
  requires_hr_approval: boolean;
}> {
  try {
    logger.log('🔵 [FRONTEND] Calling requestLeaveCancellation:', {
      requestId,
      cancellationReason,
    });

    const response = await api.post<{
      success: boolean;
      message: string;
      message_th?: string;
      status: string;
      requires_hr_approval: boolean;
    }>('/leave-request-cancellation', {
      request_id: requestId,
      cancellation_reason: cancellationReason,
    });

    logger.log('✅ [FRONTEND] Cancellation request response:', response.data);

    if (!response.data.success) {
      throw new Error('Failed to request cancellation');
    }

    return response.data;
  } catch (error: any) {
    logger.error('❌ [FRONTEND] Request cancellation error:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to request cancellation'
    );
  }
}

/**
 * Review cancellation request (HR/Admin action)
 * - approve: Status → 'canceled', restore balance
 * - reject: Status → 'approved' (revert)
 */
export async function reviewLeaveCancellation(
  requestId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<{
  success: boolean;
  message: string;
  message_th?: string;
  status: string;
  days_restored?: number;
  rejection_reason?: string;
}> {
  try {
    logger.log('🔵 [FRONTEND] Calling reviewLeaveCancellation:', {
      requestId,
      action,
      rejectionReason,
    });

    const response = await api.post<{
      success: boolean;
      message: string;
      message_th?: string;
      status: string;
      days_restored?: number;
      rejection_reason?: string;
    }>('/leave-request-cancellation-review', {
      request_id: requestId,
      action,
      rejection_reason: rejectionReason,
    });

    logger.log('✅ [FRONTEND] Cancellation review response:', response.data);

    if (!response.data.success) {
      throw new Error('Failed to review cancellation');
    }

    return response.data;
  } catch (error: any) {
    logger.error('❌ [FRONTEND] Review cancellation error:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to review cancellation'
    );
  }
}

/**
 * Get pending cancellation requests (HR view)
 */
export async function getCancellationPendingRequests(): Promise<LeaveRequest[]> {
  try {
    const response = await api.get<{
      success: boolean;
      leave_requests: LeaveRequest[];
    }>('/leave-requests?status=cancellation_pending');

    if (!response.data.success) {
      throw new Error('Failed to get cancellation pending requests');
    }

    return response.data.leave_requests || [];
  } catch (error: any) {
    logger.error('Get cancellation pending requests error:', error);
    throw new Error(
      error.response?.data?.error ||
      error.response?.data?.message ||
      'Failed to get cancellation pending requests'
    );
  }
}

