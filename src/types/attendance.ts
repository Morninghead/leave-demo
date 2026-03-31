// src/types/attendance.ts
// Types for Daily Line Attendance System

/**
 * Manufacturing Line Category
 */
export type LineCategory = '5s' | 'asm' | 'pro' | 'tpl' | 'other';

/**
 * Shift Types
 */
export type ShiftType = 'day' | 'night_ab' | 'night_cd';

/**
 * Attendance Status
 */
export type AttendanceStatus = 'draft' | 'submitted' | 'confirmed' | 'revised';

/**
 * Absence Reason Types
 */
export type AbsenceReason = 'leave' | 'sick' | 'no_show' | 'resigned' | 'other';

/**
 * Manufacturing Line
 */
export interface ManufacturingLine {
    id: string;
    code: string;
    name_th: string | null;
    name_en: string | null;
    category: LineCategory;
    headcount_day: number;
    headcount_night_ab: number;
    headcount_night_cd: number;
    line_leader_id?: string;
    line_leader_name?: string;
    line_leader_name_th?: string;
    line_leader_name_en?: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Subcontract Employee
 */
export interface SubcontractEmployee {
    id: string;
    employee_code: string;
    first_name_th: string;
    last_name_th: string;
    first_name_en: string | null;
    last_name_en: string | null;
    nickname: string | null;
    company_name: string;
    company_code: string | null;
    line_id: string | null;
    shift: ShiftType;
    position_th: string | null;
    position_en: string | null;
    phone_number: string | null;
    photo_url: string | null;
    national_id: string | null;
    hire_date: string;
    end_date: string | null;
    hourly_rate: number | null;
    notes: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;

    // Joined data from manufacturing_lines
    line_code?: string;
    line_name_th?: string;
    line_name_en?: string;
    line_category?: LineCategory;
    line?: ManufacturingLine;
}

/**
 * Line Attendance (Header)
 */
export interface LineAttendance {
    id: string;
    line_id: string;
    attendance_date: string;
    shift: ShiftType;

    // Counts
    required_count: number;
    present_count: number;
    absent_count: number;

    // Replacement
    replacement_requested: number;
    replacement_filled: number;
    replacement_notes: string | null;

    // Submission
    submitted_by: string | null;
    submitted_at: string | null;
    is_late: boolean;
    deadline_time: string;

    // Status
    status: AttendanceStatus;
    confirmed_by: string | null;
    confirmed_at: string | null;

    notes: string | null;
    created_at: string;
    updated_at: string;

    // Joined data
    line_code?: string;
    line_name_th?: string;
    line_name_en?: string;
    line_category?: LineCategory;
    line?: ManufacturingLine;
    submitted_by_employee?: { name_th: string; name_en: string };
    confirmed_by_employee?: { name_th: string; name_en: string };
    details?: LineAttendanceDetail[];
}

/**
 * Line Attendance Detail (Individual employee record)
 */
export interface LineAttendanceDetail {
    id: string;
    line_attendance_id: string;
    subcontract_employee_id: string;

    // Attendance
    is_present: boolean;
    check_in_time: string | null;
    check_out_time: string | null;

    // Absence
    absence_reason: AbsenceReason | null;
    absence_notes: string | null;

    // Replacement
    is_replacement: boolean;
    replacing_for: string | null;

    created_at: string;
    updated_at: string;

    // Joined data
    employee?: SubcontractEmployee;
    replacing_for_employee?: SubcontractEmployee;
}

// ============================================
// FORM DATA TYPES
// ============================================

/**
 * Form data for creating/updating a Manufacturing Line
 */
export interface ManufacturingLineFormData {
    code: string;
    name_th?: string;
    name_en?: string;
    category: LineCategory;
    headcount_day: number;
    headcount_night_ab: number;
    headcount_night_cd: number;
    description?: string;
    sort_order?: number;
    is_active?: boolean;
    line_leader_id?: string;
}

/**
 * Form data for creating/updating a Subcontract Employee
 */
export interface SubcontractEmployeeFormData {
    employee_code: string;
    first_name_th: string;
    last_name_th: string;
    first_name_en?: string;
    last_name_en?: string;
    nickname?: string;
    company_name: string;
    company_code?: string;
    line_id?: string;
    shift: ShiftType;
    position_th?: string;
    position_en?: string;
    phone_number?: string;
    photo_url?: string;
    national_id?: string;
    hire_date: string;
    end_date?: string;
    hourly_rate?: number;
    notes?: string;
    is_active?: boolean;
}

/**
 * Form data for submitting daily attendance
 */
export interface AttendanceSubmitFormData {
    line_id: string;
    attendance_date: string;
    shift: ShiftType;
    employees: AttendanceEmployeeEntry[];
    replacement_requested?: number;
    replacement_notes?: string;
    notes?: string;
}

/**
 * Individual employee attendance entry in form
 */
export interface AttendanceEmployeeEntry {
    subcontract_employee_id: string;
    is_present: boolean;
    check_in_time?: string;
    check_out_time?: string;
    absence_reason?: AbsenceReason;
    absence_notes?: string;
    is_replacement?: boolean;
    replacing_for?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Summary statistics for attendance dashboard
 */
export interface AttendanceSummary {
    date: string;
    shift: ShiftType;

    // By category
    by_category: {
        category: LineCategory;
        total_lines: number;
        submitted_lines: number;
        late_submissions: number;
        total_required: number;
        total_present: number;
        total_absent: number;
        attendance_rate: number;
    }[];

    // Overall
    total_lines: number;
    submitted_lines: number;
    pending_lines: number;
    late_submissions: number;
    total_required: number;
    total_present: number;
    total_absent: number;
    overall_attendance_rate: number;

    // Replacement status
    total_replacements_requested: number;
    total_replacements_filled: number;
}

/**
 * Line status for dashboard
 */
export interface LineAttendanceStatus {
    line: ManufacturingLine;
    shift: ShiftType;
    status: AttendanceStatus | 'not_submitted';
    is_late: boolean;
    submitted_at: string | null;
    required_count: number;
    present_count: number;
    absent_count: number;
    replacement_requested: number;
    replacement_filled: number;
}

// ============================================
// HELPER TYPE GUARDS
// ============================================

export function isValidShift(shift: string): shift is ShiftType {
    return ['day', 'night_ab', 'night_cd'].includes(shift);
}

export function isValidCategory(category: string): category is LineCategory {
    return ['5s', 'asm', 'pro', 'tpl', 'other'].includes(category);
}

export function isValidAbsenceReason(reason: string): reason is AbsenceReason {
    return ['leave', 'sick', 'no_show', 'resigned', 'other'].includes(reason);
}

// ============================================
// DISPLAY HELPERS
// ============================================

export const SHIFT_NAMES = {
    day: { th: 'กลางวัน (Day)', en: 'Day Shift' },
    night_ab: { th: 'กลางคืน AB', en: 'Night AB' },
    night_cd: { th: 'กลางคืน CD', en: 'Night CD' },
} as const;

export const CATEGORY_NAMES = {
    '5s': { th: '5S', en: '5S' },
    asm: { th: 'Assembly', en: 'Assembly' },
    pro: { th: 'Processing', en: 'Processing' },
    tpl: { th: 'TPL', en: 'TPL' },
    other: { th: 'อื่นๆ', en: 'Other' },
} as const;

export const ABSENCE_REASON_NAMES = {
    leave: { th: 'ลา', en: 'Leave' },
    sick: { th: 'ป่วย', en: 'Sick' },
    no_show: { th: 'ไม่มา', en: 'No Show' },
    resigned: { th: 'ลาออก', en: 'Resigned' },
    other: { th: 'อื่นๆ', en: 'Other' },
} as const;

export const STATUS_NAMES = {
    draft: { th: 'แบบร่าง', en: 'Draft' },
    submitted: { th: 'ส่งแล้ว', en: 'Submitted' },
    confirmed: { th: 'ยืนยันแล้ว', en: 'Confirmed' },
    revised: { th: 'แก้ไขแล้ว', en: 'Revised' },
    not_submitted: { th: 'ยังไม่ส่ง', en: 'Not Submitted' },
} as const;

export const CATEGORY_COLORS = {
    '5s': 'purple',
    asm: 'blue',
    pro: 'green',
    tpl: 'orange',
    other: 'gray',
} as const;
