/**
 * Individual Leave & Shift Swap Report
 *
 * Comprehensive report for a single employee showing:
 * - All leave requests (approved, pending, rejected)
 * - All shift swap requests
 * - Timeline of absences
 * - Summary statistics
 *
 * Used for labor law compliance documentation
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { getCurrentFiscalYearDateRange } from './utils/fiscal-year';

interface LeaveRecord {
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
  attachment_urls?: string[];
}

interface IndividualReportData {
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
  records: LeaveRecord[];
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

const getIndividualLeaveReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const searchParams = new URLSearchParams(event.rawQuery || '');
    const employeeId = searchParams.get('employee_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!employeeId) {
      return errorResponse('employee_id is required', 400);
    }


    // Default date range: Fiscal Year of current year
    const { start: defaultStartDate, end: defaultEndDate } = await getCurrentFiscalYearDateRange();

    const dateStart = startDate || defaultStartDate;
    const dateEnd = endDate || defaultEndDate;

    // Permission check: Employees can only view their own report
    // Managers can view their department
    // HR and Admin can view all
    const userRole = event.user?.role;
    const userId = event.user?.userId; // userId contains the employee's database ID

    const employeeResult = await query(
      `SELECT e.id, e.employee_code,
              e.first_name_th || ' ' || e.last_name_th as employee_name_th,
              e.first_name_en || ' ' || e.last_name_en as employee_name_en,
              e.department_id, e.position_th, e.position_en, e.hire_date,
              d.name_th as department_th, d.name_en as department_en
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = $1::uuid AND e.is_active = true`,
      [employeeId]
    );

    if (employeeResult.length === 0) {
      return errorResponse('Employee not found', 404);
    }

    const employee = employeeResult[0];

    // Check permissions
    if (userRole === 'employee' && userId !== employeeId) {
      return errorResponse('Permission denied - can only view your own report', 403);
    }

    if (userRole === 'manager') {
      // Check if manager is in same department
      const managerResult = await query(
        `SELECT department_id FROM employees WHERE id = $1::uuid`,
        [userId]
      );
      if (
        managerResult.length === 0 ||
        managerResult[0].department_id !== employee.department_id
      ) {
        return errorResponse('Permission denied - can only view reports from your department', 403);
      }
    }

    // Get leave requests
    const leaveRequests = await query(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.total_days,
              lr.status, lr.reason, lr.created_at,
              GREATEST(
                lr.department_admin_approved_at,
                lr.department_manager_approved_at,
                lr.hr_approved_at
              ) as final_approved_at,
              lt.name_th as leave_type_th, lt.name_en as leave_type_en,
              lt.code as leave_type_code,
              lr.attachment_urls,
              false as is_shift_swap
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = $1::uuid
         AND lr.start_date <= $3
         AND lr.end_date >= $2
       ORDER BY lr.start_date DESC, lr.created_at DESC`,
      [employeeId, dateStart, dateEnd]
    );

    // Get shift swap requests
    const shiftSwapRequests = await query(
      `SELECT ssr.id, ssr.work_date, ssr.off_date,
              ssr.status,
              COALESCE(ssr.reason_th, ssr.reason_en, '') as reason,
              ssr.created_at,
              GREATEST(
                ssr.department_admin_approved_at,
                ssr.department_manager_approved_at,
                ssr.hr_approved_at
              ) as final_approved_at,
              true as is_shift_swap
       FROM shift_swap_requests ssr
       WHERE ssr.employee_id = $1::uuid
         AND ssr.work_date >= $2
         AND ssr.work_date <= $3
       ORDER BY ssr.work_date DESC, ssr.created_at DESC`,
      [employeeId, dateStart, dateEnd]
    );

    // Combine and format records
    const records: LeaveRecord[] = [];

    // Add leave requests
    leaveRequests.forEach((lr: any) => {
      const totalHours = lr.total_days * 8; // Assuming 8-hour workday
      const hours = Math.floor(totalHours);
      const minutes = Math.round((totalHours - hours) * 60);

      let durationStr = `${lr.total_days} days`;
      if (lr.total_days === 1) {
        durationStr = '1 day';
      } else if (lr.total_days === 0.5) {
        durationStr = 'Half-day (4h)';
      } else if (lr.total_days < 1) {
        durationStr = minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
      }

      records.push({
        id: lr.id,
        date: lr.start_date,
        leave_type: lr.leave_type_th || lr.leave_type_en,
        leave_type_code: lr.leave_type_code,
        duration: durationStr,
        total_days: parseFloat(lr.total_days),
        status: lr.status,
        reason: lr.reason,
        is_shift_swap: false,
        created_at: lr.created_at,
        approved_at: lr.final_approved_at || undefined,
        attachment_urls: typeof lr.attachment_urls === 'string'
          ? JSON.parse(lr.attachment_urls)
          : lr.attachment_urls || [],
      });
    });

    // Add shift swap requests
    shiftSwapRequests.forEach((ssr: any) => {
      records.push({
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

    // Sort by date descending
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate summary
    const totalRecords = records.length;
    const totalLeaveRequests = records.filter((r) => !r.is_shift_swap).length;
    const totalShiftSwaps = records.filter((r) => r.is_shift_swap).length;
    const totalApproved = records.filter((r) => r.status === 'approved').length;
    const totalPending = records.filter((r) => r.status === 'pending').length;
    const totalRejected = records.filter((r) => r.status === 'rejected').length;
    const totalDaysTaken = records
      .filter((r) => r.status === 'approved' && !r.is_shift_swap)
      .reduce((sum, r) => sum + r.total_days, 0);

    const reportData: IndividualReportData = {
      employee: {
        id: employee.id,
        employee_code: employee.employee_code,
        employee_name_th: employee.employee_name_th,
        employee_name_en: employee.employee_name_en,
        department_th: employee.department_th,
        department_en: employee.department_en,
        position_th: employee.position_th,
        position_en: employee.position_en,
        hire_date: employee.hire_date,
      },
      date_range: {
        start: dateStart,
        end: dateEnd,
      },
      records,
      summary: {
        total_records: totalRecords,
        total_leave_requests: totalLeaveRequests,
        total_shift_swaps: totalShiftSwaps,
        total_approved: totalApproved,
        total_pending: totalPending,
        total_rejected: totalRejected,
        total_days_taken: totalDaysTaken,
      },
    };

    return successResponse(reportData);
  } catch (error: any) {
    logger.error('Individual leave report error:', error);
    return errorResponse(error.message || 'Failed to generate individual leave report', 500);
  }
};

export const handler: Handler = requireAuth(getIndividualLeaveReport);
