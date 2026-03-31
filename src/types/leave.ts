export interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description_th?: string;
  description_en?: string;
  is_active: boolean;
  requires_attachment?: boolean;
  default_days?: number | string;
  is_paid?: boolean;
  color?: string;
  color_code?: string;
  allow_hourly_leave?: boolean;
  working_hours_per_day?: number;
  minutes_per_day?: number;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  year: number;
  total_days: number | string;
  used_days: number | string;
  remaining_days: number | string;
  created_at: string;
  updated_at: string;
  color?: string;
  is_paid?: boolean;
  is_unpaid_leave?: boolean; // For unpaid leave types
  pending_days?: number;
  available_days?: number | string; // Available days (remaining - pending)
  // Hourly leave fields
  allow_hourly_leave?: boolean;
  accumulated_minutes?: number;
  used_minutes?: number;
  remaining_minutes?: number;
  minutes_per_day?: number;
  working_hours_per_day?: number;
  // Display fields from backend
  display_days?: number | string;
  display_hours?: number | string;
  display_minutes?: number | string;
  display_text_th?: string;
  display_text_en?: string;
}

export interface LeaveRequest {
  id: string;
  request_number: string;
  employee_id: string;
  employee_code?: string;
  employee_name_th?: string;
  employee_name_en?: string;
  department_id?: string; // Employee's department ID
  employee_department_id?: string; // Alias for department_id (for approval logic)
  department_name_th?: string;
  department_name_en?: string;
  leave_type_id: string;
  leave_type_code?: string;
  leave_type_name_th?: string;
  leave_type_name_en?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason_th?: string;
  reason_en?: string;
  reason?: string; // Added from api/leave.ts
  reason_language?: "th" | "en"; // Added from api/leave.ts
  attachment_urls?: string[]; // Added from api/leave.ts
  status:
    | "pending"
    | "department_approved"
    | "approved"
    | "rejected"
    | "canceled"
    | "voided"
    | "cancellation_pending";
  current_approval_stage?: number;
  // ⭐ NEW FIELDS for half-day & shift
  is_half_day: boolean;
  half_day_period?:
    | "morning"
    | "afternoon"
    | "first_half"
    | "second_half"
    | null;
  shift_type: "day" | "night" | "evening";
  start_time?: string | null;
  end_time?: string | null;
  // ⭐ NEW FIELDS for hourly leave
  is_hourly_leave?: boolean;
  leave_minutes?: number;
  leave_hours?: number;
  leave_start_time?: string;
  leave_end_time?: string;
  // Approval info
  rejection_stage?: "department" | "hr";
  rejection_reason_th?: string;
  rejection_reason_en?: string;
  department_admin_approved_by?: string;
  department_admin_approved_at?: string;
  department_manager_approved_by?: string;
  department_manager_approved_at?: string;
  department_approved_by?: string;
  department_approved_by_name?: string;
  department_approved_at?: string;
  hr_approved_by?: string;
  hr_approved_by_name?: string;
  hr_approved_at?: string;
  canceled_by?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
  admin_name_th?: string; // Added from api/leave.ts
  admin_name_en?: string; // Added from api/leave.ts
  admin_approver_needs_review?: boolean;
  manager_name_th?: string; // Added from api/leave.ts
  manager_name_en?: string; // Added from api/leave.ts
  manager_approver_needs_review?: boolean;
  hr_name_th?: string; // Added from api/leave.ts
  hr_name_en?: string; // Added from api/leave.ts
  hr_approver_needs_review?: boolean;
  // ✅ Approval permission from backend
  canApprove?: boolean; // Whether current user can approve this request
  approvalStage?: "department_admin" | "department_manager" | "hr" | null; // Current stage role
  // ✅ Next approver name for pending display
  next_approver_name_th?: string;
  next_approver_name_en?: string;
  // ⭐ NEW FIELDS for cancellation request workflow
  cancellation_requested_at?: string;
  cancellation_requested_by?: string;
  cancellation_reason?: string;
  cancellation_approved_at?: string;
  cancellation_approved_by?: string;
  cancellation_rejected_at?: string;
  cancellation_rejected_by?: string;
  cancellation_rejection_reason?: string;
}

// Calendar conflict data for enhanced date picker
export interface CalendarConflictData {
  date: string;
  status: "available" | "partial_conflict" | "full_conflict";
  conflictType?:
    | "pending_leave"
    | "approved_leave"
    | "holiday"
    | "weekend"
    | "past_date";
  conflictDetails?: {
    employeeName: string;
    leaveType: string;
    status: string;
  }[];
  tooltipMessage?: string;
}

export interface BalanceHistory {
  id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  leave_type_code: string;
  change_type: "accrual" | "usage" | "adjustment" | "carry_forward" | "reset";
  previous_days: number;
  new_days: number;
  change_amount: number;
  reason: string;
  changed_at: string;
  changed_by_name: string;
}

export interface BalanceSummary {
  total_entitled: number;
  total_used: number;
  total_remaining: number;
  total_pending: number;
}

export interface LeaveBalanceResponse {
  balances: LeaveBalance[];
  summary: BalanceSummary;
}

export interface CreateLeaveRequestData {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason_th?: string;
  reason_en?: string;
  attachment_urls?: string[];
  is_half_day?: boolean;
  half_day_period?:
    | "morning"
    | "afternoon"
    | "first_half"
    | "second_half"
    | null;
  shift_type?: "day" | "night" | "evening";
  is_hourly_leave?: boolean;
  leave_minutes?: number;
  leave_start_time?: string;
  leave_end_time?: string;
}

export interface UpdateLeaveRequestData {
  action: "approve" | "reject" | "cancel";
  rejection_reason?: string;
}
