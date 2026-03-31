import api from './auth';

// ===== Leave Report Types =====
export interface LeaveReportData {
  employee_code: string;
  employee_name: string;
  department_name: string;
  department_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  created_at: string;
}

export interface LeaveReportSummary {
  leave_type: string;
  total_requests: number;
  total_days: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
}

export interface DepartmentSummary {
  department_name: string;
  department_id: string;
  total_requests: number;
  total_days: number;
  approved_count: number;
}

export interface LeaveReport {
  report_type: 'leave';
  year: number;
  month: number | null;
  date_range: string | null;
  start_date: string | null;
  end_date: string | null;
  week_number: number | null;
  quarter: number | null;
  department_id: string | null;
  data: LeaveReportData[];
  summary_by_type: LeaveReportSummary[];
  summary_by_department: DepartmentSummary[];
}

// ===== Shift Report Types =====
export interface ShiftReportData {
  employee_code: string;
  employee_name: string;
  department_name: string;
  department_id: string;
  work_date: string;
  off_date: string;
  reason_th: string;
  status: string;
  created_at: string;
}

export interface ShiftReport {
  report_type: 'shift';
  year: number;
  month: number | null;
  date_range: string | null;
  start_date: string | null;
  end_date: string | null;
  week_number: number | null;
  quarter: number | null;
  department_id: string | null;
  data: ShiftReportData[];
  summary: {
    total_requests: string;
    approved_count: string;
    rejected_count: string;
    pending_count: string;
  };
}

// ===== Leave Balance Types (NEW) =====
export interface LeaveBalance {
  id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  department_name_th: string;
  department_name_en: string;
  position_th: string;
  position_en: string;
  sick_leave_balance: number;
  annual_leave_balance: number;
  personal_leave_balance: number;
  sick_leave_used: number;
  annual_leave_used: number;
  personal_leave_used: number;
  // Hourly leave data (in accumulated minutes for more precise tracking)
  sick_leave_accumulated_minutes?: number;
  annual_leave_accumulated_minutes?: number;
  personal_leave_accumulated_minutes?: number;
  year: number;
}

// ===== Combined Types =====
export type Report = LeaveReport | ShiftReport;

// ===== API Functions =====

// Get reports (enhanced with advanced filtering)
export async function getReports(params: {
  type: 'leave' | 'shift';
  year?: number;
  month?: number;
  department_id?: string;
  date_range?: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  start_date?: string;
  end_date?: string;
  week?: number;
  quarter?: number;
}): Promise<Report> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('type', params.type);
    if (params.year) queryParams.append('year', params.year.toString());
    if (params.month) queryParams.append('month', params.month.toString());
    if (params.department_id) queryParams.append('department_id', params.department_id);
    if (params.date_range) queryParams.append('date_range', params.date_range);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.week) queryParams.append('week', params.week.toString());
    if (params.quarter) queryParams.append('quarter', params.quarter.toString());

    const response = await api.get<{ success: boolean } & Report>(
      `/reports?${queryParams.toString()}`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get reports');
  }
}

// Get leave balance report (NEW)
export async function getLeaveBalanceReport(): Promise<LeaveBalance[]> {
  try {
    const response = await api.get<{ success: boolean; balances: LeaveBalance[] }>(
      '/leave-balance-report'
    );
    return response.data.balances;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get leave balance report');
  }
}

// ===== Comprehensive Reports (NEW - Labor Law Compliance) =====

export interface ComprehensiveLeaveRecord {
  id: string; // UUID from database
  date: string;
  leave_type: string;
  leave_type_code: string;
  duration: string;
  total_days: number;
  status: string;
  reason: string;
  is_shift_swap: boolean;
  created_at: string;
  approved_at?: string;
  attachment_urls?: string[]; // Array of URLs to attached files
  is_half_day?: boolean;
  half_day_period?: string;
}

export interface IndividualReportData {
  employee: {
    id: string; // UUID from database
    employee_code: string;
    employee_name_th: string;
    employee_name_en: string;
    department_th: string;
    department_en: string;
    position_th?: string;
    position_en?: string;
    hire_date: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  records: ComprehensiveLeaveRecord[];
  summary: {
    total_records: number;
    total_leave_requests: number;
    total_shift_swaps: number;
    total_approved: number;
    total_pending: number;
    total_rejected: number;
    total_days_taken: number;
  };
}

export interface DepartmentEmployeeSummary {
  employee_id: string; // UUID from database
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  position_th?: string;
  position_en?: string;
  hire_date?: string; // For law compliance reports
  total_leave_requests: number;
  total_shift_swaps: number;
  approved_leave_requests: number;
  approved_shift_swaps: number;
  pending_requests: number;
  total_days_taken: number;
  records?: ComprehensiveLeaveRecord[]; // Detailed records for law compliance (when include_details=true)
}

export interface DepartmentReportData {
  department: {
    id: string; // UUID from database
    code: string;
    name_th: string;
    name_en: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  employees: DepartmentEmployeeSummary[];
  summary: {
    total_employees: number;
    total_leave_requests: number;
    total_shift_swaps: number;
    total_approved_requests: number;
    total_pending_requests: number;
    total_days: number;
  };
}

export interface EmployeeLeaveSummary {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  leave_stats: Record<string, number>;
}

export interface CompanyWideDepartmentSummary {
  department_id: string; // UUID from database
  department_code: string;
  department_name_th: string;
  department_name_en: string;
  total_employees: number;
  active_employees: number;
  total_leave_requests: number;
  total_shift_swaps: number;
  approved_requests: number;
  pending_requests: number;
  rejected_requests: number;
  total_full_day_requests: number;
  total_half_day_morning: number;
  total_half_day_afternoon: number;
  total_hourly_requests: number;
  total_days: number;
  avg_days_per_employee: number;
  employees?: EmployeeLeaveSummary[];
}

export interface LeaveTypeBreakdown {
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  total_requests: number;
  approved_requests: number;
  total_days: number;
}

export interface CompanyWideReportData {
  date_range: {
    start: string;
    end: string;
  };
  overall_summary: {
    total_departments: number;
    total_employees: number;
    active_employees: number;
    total_leave_requests: number;
    total_shift_swaps: number;
    total_requests: number;
    approved_requests: number;
    pending_requests: number;
    rejected_requests: number;
    total_days: number;
    avg_days_per_employee: number;
  };
  departments: CompanyWideDepartmentSummary[];
  leave_type_breakdown: LeaveTypeBreakdown[];
  monthly_trends?: Array<{
    month: string;
    department_name_th?: string;
    department_name_en?: string;
    total_people?: number;
    leave_requests: number;
    shift_swaps: number;
    total_days: number;
  }>;
  all_leave_types?: { code: string; name_th: string; name_en: string }[];
}

// Get individual comprehensive leave report
export async function getIndividualLeaveReport(params: {
  employee_id: string; // UUID from database
  start_date?: string;
  end_date?: string;
}): Promise<IndividualReportData> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('employee_id', params.employee_id); // Already a string (UUID)
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    const response = await api.get<{ success: boolean } & IndividualReportData>(
      `/report-individual-leave?${queryParams.toString()}`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get individual leave report');
  }
}

// Get department comprehensive leave report
export async function getDepartmentLeaveReport(params: {
  department_id: string; // UUID from database
  start_date?: string;
  end_date?: string;
  include_details?: boolean; // For law compliance reports with detailed records
}): Promise<DepartmentReportData> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('department_id', params.department_id); // Already a string (UUID)
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.include_details) queryParams.append('include_details', 'true');

    const response = await api.get<{ success: boolean } & DepartmentReportData>(
      `/report-department-leave?${queryParams.toString()}`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get department leave report');
  }
}

// ===== Monthly Attendance Report Types (NEW) =====
export interface DayRecord {
  day: number;
  date: string; // YYYY-MM-DD
  leave_type?: string;
  leave_code?: string;
  is_shift_swap: boolean;
  status: string;
  leave_duration?: 'full' | 'half_day_morning' | 'half_day_afternoon' | 'hourly';
  leave_hours?: number;
}

export interface EmployeeMonthlyRecord {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  position_th?: string;
  position_en?: string;
  days: DayRecord[];
  total_leave_days: number;
  total_shift_swaps: number;
}

export interface MonthlyAttendanceReport {
  department: {
    id: string;
    code: string;
    name_th: string;
    name_en: string;
  };
  year: number;
  month: number;
  days_in_month: number;
  calendar_dates: string[]; // List of YYYY-MM-DD for column headers
  employees: EmployeeMonthlyRecord[];
  summary: {
    total_employees: number;
    total_leave_days: number;
    total_shift_swaps: number;
  };
}

// Get department monthly attendance report (table format for labor law compliance)
export async function getMonthlyAttendanceReport(params: {
  department_id: string;
  year: number;
  month: number; // 1-12
}): Promise<MonthlyAttendanceReport> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('department_id', params.department_id);
    queryParams.append('year', params.year.toString());
    queryParams.append('month', params.month.toString());

    const response = await api.get<{ success: boolean } & MonthlyAttendanceReport>(
      `/report-department-monthly-attendance?${queryParams.toString()}`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get monthly attendance report');
  }
}

// Get company-wide comprehensive leave report
export async function getCompanyWideLeaveReport(params?: {
  start_date?: string;
  end_date?: string;
  include_trends?: boolean;
}): Promise<CompanyWideReportData> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.include_trends) queryParams.append('include_trends', 'true');

    const response = await api.get<{ success: boolean } & CompanyWideReportData>(
      `/report-company-wide-leave?${queryParams.toString()}`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get company-wide leave report');
  }
}

// Generate test data (Admin only)
export async function generateTestData(params: {
  num_leave_requests?: number;
  num_shift_swaps?: number;
  months_back?: number;
  months_forward?: number;
}): Promise<any> {
  try {
    const response = await api.post('/admin-generate-test-data', params);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to generate test data');
  }
}

// Cleanup test data (Admin only)
export async function cleanupTestData(confirm: boolean = false): Promise<any> {
  try {
    const response = await api.delete('/admin-cleanup-test-data', {
      data: { confirm },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to cleanup test data');
  }
}
