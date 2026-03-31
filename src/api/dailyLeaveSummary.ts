import api from './auth';

/**
 * Daily Leave Summary Report API
 */

export interface LeaveEmployeeEntry {
    employee_id: string;
    employee_code: string;
    employee_name_th: string;
    employee_name_en: string;
    department_name_th: string;
    department_name_en: string;
    leave_type_code: string;
    leave_type_name_th: string;
    leave_type_name_en: string;
    is_hourly_leave: boolean;
    leave_minutes: number;
    total_days: number;
    leave_date?: string;
    leave_dates?: string[];
    leave_request_id?: string;
    request_number?: string;
    start_date?: string;
    end_date?: string;
    status: 'approved' | 'pending';
}

export interface LeaveTypeGroup {
    leave_type_code: string;
    leave_type_name_th: string;
    leave_type_name_en: string;
    count: number;
    employees: LeaveEmployeeEntry[];
}

export interface DailyLeaveGroup {
    date: string;
    total_employees: number;
    by_leave_type: LeaveTypeGroup[];
    employees: LeaveEmployeeEntry[];
}

export interface WeeklyLeaveGroup {
    week: string;
    week_start: string;
    week_end: string;
    total_leave_instances: number;
    unique_employee_count: number;
    by_leave_type: LeaveTypeGroup[];
    employees: LeaveEmployeeEntry[];
}

export interface MonthlyLeaveGroup {
    month: string;
    year: number;
    month_number: number;
    total_leave_instances: number;
    unique_employee_count: number;
    by_leave_type: LeaveTypeGroup[];
    employees: LeaveEmployeeEntry[];
}

export interface DailyLeaveSummaryReport {
    report_type: string;
    group_by: 'daily' | 'weekly' | 'monthly';
    date_range: {
        start: string;
        end: string;
    };
    department_id: string | null;
    summary: {
        total_leave_instances: number;
        unique_employees: number;
        by_leave_type: {
            leave_type_code: string;
            leave_type_name_th: string;
            leave_type_name_en: string;
            total_instances: number;
        }[];
        periods_count: number;
    };
    data: DailyLeaveGroup[] | WeeklyLeaveGroup[] | MonthlyLeaveGroup[];
}

export interface DailyLeaveSummaryParams {
    start_date: string;
    end_date: string;
    department_id?: string;
    group_by?: 'daily' | 'weekly' | 'monthly';
}

export async function getDailyLeaveSummaryReport(
    params: DailyLeaveSummaryParams
): Promise<DailyLeaveSummaryReport> {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.start_date);
    queryParams.append('end_date', params.end_date);

    if (params.department_id) {
        queryParams.append('department_id', params.department_id);
    }

    if (params.group_by) {
        queryParams.append('group_by', params.group_by);
    }

    const response = await api.get(`/reports-daily-leave-summary?${queryParams.toString()}`);
    return response.data;
}
