// src/api/dashboard.ts
import api from './auth';
import axios from 'axios';

export interface DashboardStats {
  // ===== Leave Statistics =====
  leave_stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    canceled: number;
  };

  // ===== Shift Statistics =====
  shift_stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };

  // ===== Combined Statistics =====
  combined_stats: {
    total_requests: number;
    pending_total: number;
    approved_total: number;
    rejected_total: number;
  };

  // ===== Leave Balances =====
  leave_balances: Array<{
    leave_type_id: string;
    leave_type_code: string;
    name_th: string;
    name_en: string;
    color: string;              // จาก leave_types.color column
    total_days: number;
    used_days: number;
    remaining_days: number;
  }>;

  // ===== Pending Approvals =====
  pending_approvals: {
    leave_requests: number;
    shift_requests: number;
    total: number;
  };

  // ===== Recent Leaves =====
  recent_leaves: Array<{
    id: string;
    request_number: string;
    start_date: string;
    end_date: string;
    total_days: number;
    status: string;
    leave_type_name_th: string;
    leave_type_name_en: string;
    leave_type_color: string;
    created_at: string;
  }>;

  // ===== Recent Shift Swaps =====
  recent_shifts: Array<{
    id: string;
    request_number: string;
    work_date: string;          // จาก shift_swap_requests.work_date
    off_date: string;           // จาก shift_swap_requests.off_date
    status: string;
    reason_th: string;
    reason_en: string;
    created_at: string;
  }>;

  // ===== Metadata =====
  year: number;
  user_role: string;
}

interface DashboardStatsResponse {
  success: boolean;
  data: DashboardStats;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const timestamp = Date.now(); // Cache-busting timestamp
    const response = await api.get<DashboardStatsResponse | DashboardStats>(
      `/dashboard-stats?_t=${timestamp}`
    );
    // Handle both wrapped { success: true, data: ... } and unwrapped responses
    if (response.data && 'data' in response.data && typeof response.data.success === 'boolean') {
      return response.data.data;
    }
    return response.data as DashboardStats;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as { message?: string };
      throw new Error(data.message || 'Failed to get dashboard stats');
    }
    throw new Error('Failed to get dashboard stats');
  }
}
