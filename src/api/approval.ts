// src/api/approval.ts
import { logger } from '../utils/logger';
import api from './auth';

export interface ApprovalCounts {
  leave_requests: number;
  total: number;
}

export interface BulkApprovalFilters {
  department_id?: string;
  date_range?: {
    start: string;
    end: string;
  };
  month?: string; // YYYY-MM format
  week?: {
    start: string;
    end: string;
  };
  leave_type_id?: string;
}

export interface BulkApprovalRequest {
  request_ids?: string[];
  filters?: BulkApprovalFilters;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

export interface BulkApprovalResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    request_id: string;
    reason: string;
  }>;
  approved_requests: any[];
  message: string;
}

/**
 * Get approval counts for badge display
 * Portfolio demo uses leave approvals only.
 */
export async function getApprovalCounts(): Promise<ApprovalCounts> {
  try {
    const leaveResponse = await api.get<{
      success: boolean;
      leave_requests: any[];
    }>('/leave-requests?for_approval=true');

    const leaveCount = leaveResponse.data.leave_requests?.length || 0;

    return {
      leave_requests: leaveCount,
      total: leaveCount,
    };
  } catch (error: any) {
    logger.error('Failed to fetch approval counts:', error);
    
    // Return zero if failed (graceful degradation)
    return {
      leave_requests: 0,
      total: 0,
    };
  }
}

/**
 * Bulk approve leave requests with filters
 */
export async function bulkApproveLeaveRequests(
  request: BulkApprovalRequest
): Promise<BulkApprovalResult> {
  try {
    const response = await api.post<BulkApprovalResult>(
      '/leave-requests-bulk-approve',
      request
    );
    return response.data;
  } catch (error: any) {
    logger.error('Failed to bulk approve leave requests:', error);
    throw error;
  }
}

/**
 * Bulk approve shift swap requests with filters
 */
export async function bulkApproveShiftSwaps(
  request: BulkApprovalRequest
): Promise<BulkApprovalResult> {
  try {
    const response = await api.post<BulkApprovalResult>(
      '/shift-swaps-bulk-approve',
      request
    );
    return response.data;
  } catch (error: any) {
    logger.error('Failed to bulk approve shift swaps:', error);
    throw error;
  }
}
