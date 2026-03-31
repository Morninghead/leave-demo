// src/types/shift.ts
export interface ShiftSwapRequest {
  id: string;
  request_number?: string; // Added
  employee_id?: string; // Added
  employee_name_th?: string; // Added
  employee_name_en?: string; // Added
  department_name_th?: string; // Added
  department_name_en?: string; // Added
  work_date?: string; // Added
  off_date?: string; // Added
  reason_th?: string; // Added
  reason_en?: string; // Added
  rejection_reason?: string; // Added
  requester_id: string;
  requester_name: string;
  requester_department: string;
  requester_shift_date: string;
  requester_shift_type: 'day' | 'night';

  target_id: string;
  target_name: string;
  target_department: string;
  target_shift_date: string;
  target_shift_type: 'day' | 'night';

  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancel';
  created_at: string;
  updated_at: string;

  // Approver info
  approver_id?: string;
  approved_at?: string;
  approver_note?: string;

  // Additional flags
  is_urgent?: boolean;
  is_mutual?: boolean; // ทั้งสองฝ่ายตกลงแล้ว

  // ✅ Approval fields (from backend)
  current_approval_stage?: number;
  department_id?: string; // Employee's department ID
  employee_department_id?: string; // Alias for approval logic
  employee_code?: string;
  canApprove?: boolean; // Whether current user can approve this request
  approvalStage?: 'department_admin' | 'department_manager' | 'hr' | null; // Current stage role
}

export interface WorkOffSwapFormData {
  work_date: string;
  off_date: string;
  reason_th: string;
  reason_en: string;
  target_employee_id?: string; // ✅ NEW: For Admin/Manager/HR to swap on behalf of an employee
}

export interface ShiftSwapFormData {
  target_id: string;
  requester_shift_date: string;
  target_shift_date: string;
  reason: string;
}
