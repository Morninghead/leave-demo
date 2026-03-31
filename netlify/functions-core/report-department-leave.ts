/**
 * Department Leave & Shift Swap Report
 *
 * Comprehensive report for a department showing:
 * - All employees in department
 * - Leave and shift swap summary per employee
 * - Department-wide statistics
 * - Timeline visualization data
 *
 * Used for labor law compliance and department management
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

interface LeaveRecord {
  id: string; // UUID from database
  date: string;
  end_date?: string;
  leave_type: string;
  leave_type_code: string;
  duration: string;
  total_days: number;
  status: string;
  reason?: string;
  is_shift_swap: boolean;
  created_at: string;
  approved_at?: string;
}

interface EmployeeSummary {
  employee_id: string; // UUID from database
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  position_th?: string;
  position_en?: string;
  hire_date?: string;
  total_leave_requests: number;
  total_shift_swaps: number;
  approved_leave_requests: number;
  approved_shift_swaps: number;
  pending_requests: number;
  total_days_taken: number;
  records?: LeaveRecord[]; // Detailed records for law compliance
}

interface DepartmentReportData {
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
  employees: EmployeeSummary[];
  summary: {
    total_employees: number;
    total_leave_requests: number;
    total_shift_swaps: number;
    total_approved_requests: number;
    total_pending_requests: number;
    total_days: number;
  };
}

const getDepartmentLeaveReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const searchParams = new URLSearchParams(event.rawQuery || '');
    const departmentId = searchParams.get('department_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const includeDetails = searchParams.get('include_details') === 'true'; // For law compliance reports

    if (!departmentId) {
      return errorResponse('department_id is required', 400);
    }

    // Default date range: current year
    const defaultStartDate = new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .split('T')[0];
    const defaultEndDate = new Date(new Date().getFullYear(), 11, 31)
      .toISOString()
      .split('T')[0];

    const dateStart = startDate || defaultStartDate;
    const dateEnd = endDate || defaultEndDate;

    // Permission check: Managers can view their own department, HR and Admin can view all
    const userRole = event.user?.role;
    const userId = event.user?.userId; // userId contains the employee's database ID

    if (!['hr', 'admin'].includes(userRole || '')) {
      // Check if user is manager of this department
      const managerCheck = await query(
        `SELECT id FROM employees
         WHERE id = $1 AND department_id = $2::uuid
           AND (is_department_manager = true OR role = 'manager')`,
        [userId, departmentId]
      );

      if (managerCheck.length === 0) {
        return errorResponse(
          'Permission denied - can only view reports for your department',
          403
        );
      }
    }

    // Get department info
    const departmentResult = await query(
      `SELECT id, department_code as code, name_th, name_en
       FROM departments
       WHERE id = $1::uuid AND is_active = true`,
      [departmentId]
    );

    if (departmentResult.length === 0) {
      return errorResponse('Department not found', 404);
    }

    const department = departmentResult[0];

    // Get all employees in department
    const employeesResult = await query(
      `SELECT e.id, e.employee_code,
              e.first_name_th || ' ' || e.last_name_th as employee_name_th,
              e.first_name_en || ' ' || e.last_name_en as employee_name_en,
              e.position_th, e.position_en, e.hire_date
       FROM employees e
       WHERE e.department_id = $1::uuid AND e.is_active = true
       ORDER BY e.employee_code`,
      [departmentId]
    );

    if (employeesResult.length === 0) {
      return successResponse({
        department,
        date_range: { start: dateStart, end: dateEnd },
        employees: [],
        summary: {
          total_employees: 0,
          total_leave_requests: 0,
          total_shift_swaps: 0,
          total_approved_requests: 0,
          total_pending_requests: 0,
          total_days: 0,
        },
      });
    }

    const employeeIds = employeesResult.map((e: any) => e.id);

    // Get leave requests summary per employee
    // Use overlapping date logic: include requests that overlap with the date range
    const leaveRequestsSummary = await query(
      `SELECT employee_id,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'approved') as approved,
              COUNT(*) FILTER (WHERE status = 'pending') as pending,
              COALESCE(SUM(total_days) FILTER (WHERE status = 'approved'), 0) as total_days
       FROM leave_requests
       WHERE employee_id = ANY($1::uuid[])
         AND start_date <= $3
         AND end_date >= $2
       GROUP BY employee_id`,
      [employeeIds, dateStart, dateEnd]
    );

    // Get shift swap requests summary per employee
    // Include shift swaps where work_date is within the date range
    const shiftSwapSummary = await query(
      `SELECT employee_id,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'approved') as approved,
              COUNT(*) FILTER (WHERE status = 'pending') as pending
       FROM shift_swap_requests
       WHERE employee_id = ANY($1::uuid[])
         AND work_date BETWEEN $2 AND $3
       GROUP BY employee_id`,
      [employeeIds, dateStart, dateEnd]
    );

    // Fetch detailed records if requested (for law compliance reports)
    let detailedLeaveRequests: any[] = [];
    let detailedShiftSwaps: any[] = [];

    if (includeDetails) {
      // Get detailed leave requests for all employees
      detailedLeaveRequests = await query(
        `SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.total_days,
                lr.status, lr.reason, lr.created_at,
                GREATEST(
                  lr.department_admin_approved_at,
                  lr.department_manager_approved_at,
                  lr.hr_approved_at
                ) as final_approved_at,
                lt.name_th as leave_type_th, lt.name_en as leave_type_en,
                lt.code as leave_type_code
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ANY($1::uuid[])
           AND lr.start_date <= $3
           AND lr.end_date >= $2
         ORDER BY lr.employee_id, lr.start_date DESC`,
        [employeeIds, dateStart, dateEnd]
      );

      // Get detailed shift swap requests for all employees
      detailedShiftSwaps = await query(
        `SELECT ssr.id, ssr.employee_id, ssr.work_date, ssr.off_date,
                ssr.status,
                COALESCE(ssr.reason_th, ssr.reason_en, '') as reason,
                ssr.created_at,
                GREATEST(
                  ssr.department_admin_approved_at,
                  ssr.department_manager_approved_at,
                  ssr.hr_approved_at
                ) as final_approved_at
         FROM shift_swap_requests ssr
         WHERE ssr.employee_id = ANY($1::uuid[])
           AND ssr.work_date BETWEEN $2 AND $3
         ORDER BY ssr.employee_id, ssr.work_date DESC`,
        [employeeIds, dateStart, dateEnd]
      );
    }

    // Create lookup maps
    const leaveMap = new Map();
    leaveRequestsSummary.forEach((row: any) => {
      leaveMap.set(row.employee_id, {
        total: parseInt(row.total),
        approved: parseInt(row.approved),
        pending: parseInt(row.pending),
        total_days: parseFloat(row.total_days),
      });
    });

    const shiftMap = new Map();
    shiftSwapSummary.forEach((row: any) => {
      shiftMap.set(row.employee_id, {
        total: parseInt(row.total),
        approved: parseInt(row.approved),
        pending: parseInt(row.pending),
      });
    });

    // Create detailed records map (employee_id -> records[])
    const detailedRecordsMap = new Map<string, LeaveRecord[]>();
    if (includeDetails) {
      // Process leave requests
      detailedLeaveRequests.forEach((lr: any) => {
        if (!detailedRecordsMap.has(lr.employee_id)) {
          detailedRecordsMap.set(lr.employee_id, []);
        }
        detailedRecordsMap.get(lr.employee_id)!.push({
          id: lr.id,
          date: lr.start_date,
          end_date: lr.end_date,
          leave_type: lr.leave_type_th || lr.leave_type_en,
          leave_type_code: lr.leave_type_code,
          duration:
            lr.total_days === 1
              ? '1 day'
              : lr.total_days === 0.5
              ? '0.5 day (Half-day)'
              : `${lr.total_days} days`,
          total_days: parseFloat(lr.total_days),
          status: lr.status,
          reason: lr.reason,
          is_shift_swap: false,
          created_at: lr.created_at,
          approved_at: lr.final_approved_at || undefined,
        });
      });

      // Process shift swaps
      detailedShiftSwaps.forEach((ssr: any) => {
        if (!detailedRecordsMap.has(ssr.employee_id)) {
          detailedRecordsMap.set(ssr.employee_id, []);
        }
        detailedRecordsMap.get(ssr.employee_id)!.push({
          id: ssr.id,
          date: ssr.work_date,
          leave_type: 'Shift Swap',
          leave_type_code: 'SHIFT_SWAP',
          duration: `Swap: ${ssr.work_date} ↔ ${ssr.off_date}`,
          total_days: 0,
          status: ssr.status,
          reason: ssr.reason,
          is_shift_swap: true,
          created_at: ssr.created_at,
          approved_at: ssr.final_approved_at || undefined,
        });
      });

      // Sort records by date descending for each employee
      detailedRecordsMap.forEach((records) => {
        records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    }

    // Build employee summary
    const employees: EmployeeSummary[] = employeesResult.map((emp: any) => {
      const leave = leaveMap.get(emp.id) || {
        total: 0,
        approved: 0,
        pending: 0,
        total_days: 0,
      };
      const shift = shiftMap.get(emp.id) || { total: 0, approved: 0, pending: 0 };

      const employeeSummary: EmployeeSummary = {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name_th: emp.employee_name_th,
        employee_name_en: emp.employee_name_en,
        position_th: emp.position_th,
        position_en: emp.position_en,
        hire_date: emp.hire_date,
        total_leave_requests: leave.total,
        total_shift_swaps: shift.total,
        approved_leave_requests: leave.approved,
        approved_shift_swaps: shift.approved,
        pending_requests: leave.pending + shift.pending,
        total_days_taken: leave.total_days,
      };

      // Include detailed records if requested
      if (includeDetails) {
        employeeSummary.records = detailedRecordsMap.get(emp.id) || [];
      }

      return employeeSummary;
    });

    // Calculate department summary
    const summary = {
      total_employees: employees.length,
      total_leave_requests: employees.reduce((sum, e) => sum + e.total_leave_requests, 0),
      total_shift_swaps: employees.reduce((sum, e) => sum + e.total_shift_swaps, 0),
      total_approved_requests: employees.reduce(
        (sum, e) => sum + e.approved_leave_requests + e.approved_shift_swaps,
        0
      ),
      total_pending_requests: employees.reduce((sum, e) => sum + e.pending_requests, 0),
      total_days: employees.reduce((sum, e) => sum + e.total_days_taken, 0),
    };

    const reportData: DepartmentReportData = {
      department,
      date_range: {
        start: dateStart,
        end: dateEnd,
      },
      employees,
      summary,
    };

    return successResponse(reportData);
  } catch (error: any) {
    logger.error('Department leave report error:', error);
    return errorResponse(error.message || 'Failed to generate department leave report', 500);
  }
};

export const handler: Handler = requireAuth(getDepartmentLeaveReport);
