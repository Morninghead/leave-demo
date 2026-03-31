/**
 * Department Monthly Attendance & Leave Report
 *
 * Thai labor law compliance format:
 * - Table showing each employee as a row
 * - Each day of the month (1-31) as columns
 * - Marks for leave days and shift swap days
 * - Employee signature space for confirmation
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

interface DayRecord {
  day: number;
  leave_type?: string;
  leave_code?: string;
  is_shift_swap: boolean;
  status: string;
}

interface EmployeeMonthlyRecord {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  position_th?: string;
  position_en?: string;
  days: DayRecord[]; // Days 1-31 with leave/swap marks
  total_leave_days: number;
  total_shift_swaps: number;
}

interface MonthlyAttendanceReport {
  department: {
    id: string;
    code: string;
    name_th: string;
    name_en: string;
  };
  year: number;
  month: number;
  days_in_month: number;
  employees: EmployeeMonthlyRecord[];
  summary: {
    total_employees: number;
    total_leave_days: number;
    total_shift_swaps: number;
  };
}

const getMonthlyAttendanceReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const searchParams = new URLSearchParams(event.rawQuery || '');
    const departmentId = searchParams.get('department_id');
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    if (!departmentId) {
      return errorResponse('department_id is required', 400);
    }

    // Default to current year/month if not provided
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return errorResponse('Invalid month (must be 1-12)', 400);
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    const daysInMonth = endDate.getDate();

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Permission check
    const userRole = event.user?.role;
    const userId = event.user?.userId;

    if (!['hr', 'admin'].includes(userRole || '')) {
      const managerCheck = await query(
        `SELECT id FROM employees
         WHERE id = $1 AND department_id = $2::uuid
           AND (is_department_manager = true OR role = 'manager')`,
        [userId, departmentId]
      );

      if (managerCheck.length === 0) {
        return errorResponse('Permission denied', 403);
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
              e.position_th, e.position_en
       FROM employees e
       WHERE e.department_id = $1::uuid AND e.is_active = true
       ORDER BY e.employee_code`,
      [departmentId]
    );

    if (employeesResult.length === 0) {
      return successResponse({
        department,
        year,
        month,
        days_in_month: daysInMonth,
        employees: [],
        summary: {
          total_employees: 0,
          total_leave_days: 0,
          total_shift_swaps: 0,
        },
      });
    }

    const employeeIds = employeesResult.map((e: any) => e.id);

    // Get all leave requests for this month
    const leaveRequests = await query(
      `SELECT lr.employee_id, lr.start_date, lr.end_date, lr.status,
              lt.name_th as leave_type_th, lt.name_en as leave_type_en,
              lt.code as leave_code
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = ANY($1::uuid[])
         AND lr.start_date <= $3
         AND lr.end_date >= $2
       ORDER BY lr.start_date`,
      [employeeIds, startDateStr, endDateStr]
    );

    // Get all shift swap requests for this month
    const shiftSwapRequests = await query(
      `SELECT ssr.employee_id, ssr.work_date, ssr.status
       FROM shift_swap_requests ssr
       WHERE ssr.employee_id = ANY($1::uuid[])
         AND ssr.work_date BETWEEN $2 AND $3
       ORDER BY ssr.work_date`,
      [employeeIds, startDateStr, endDateStr]
    );

    // Build day-by-day records for each employee
    const employees: EmployeeMonthlyRecord[] = employeesResult.map((emp: any) => {
      const days: DayRecord[] = [];

      // Initialize all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push({
          day,
          is_shift_swap: false,
          status: 'working', // Default status
        });
      }

      // Mark leave request days
      leaveRequests.forEach((lr: any) => {
        if (lr.employee_id !== emp.id) return;

        const leaveStart = new Date(lr.start_date);
        const leaveEnd = new Date(lr.end_date);

        // Mark each day in the leave period
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month - 1, day);

          if (currentDate >= leaveStart && currentDate <= leaveEnd) {
            days[day - 1] = {
              day,
              leave_type: lr.leave_type_th || lr.leave_type_en,
              leave_code: lr.leave_code,
              is_shift_swap: false,
              status: lr.status,
            };
          }
        }
      });

      // Mark shift swap days
      shiftSwapRequests.forEach((ssr: any) => {
        if (ssr.employee_id !== emp.id) return;

        const swapDate = new Date(ssr.work_date);
        const day = swapDate.getDate();

        if (swapDate.getMonth() === month - 1 && swapDate.getFullYear() === year) {
          days[day - 1] = {
            day,
            leave_type: 'Shift Swap',
            leave_code: 'SWAP',
            is_shift_swap: true,
            status: ssr.status,
          };
        }
      });

      // Calculate totals
      const total_leave_days = days.filter(d => d.leave_type && !d.is_shift_swap && d.status === 'approved').length;
      const total_shift_swaps = days.filter(d => d.is_shift_swap && d.status === 'approved').length;

      return {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name_th: emp.employee_name_th,
        employee_name_en: emp.employee_name_en,
        position_th: emp.position_th,
        position_en: emp.position_en,
        days,
        total_leave_days,
        total_shift_swaps,
      };
    });

    // Calculate summary
    const summary = {
      total_employees: employees.length,
      total_leave_days: employees.reduce((sum, e) => sum + e.total_leave_days, 0),
      total_shift_swaps: employees.reduce((sum, e) => sum + e.total_shift_swaps, 0),
    };

    const reportData: MonthlyAttendanceReport = {
      department,
      year,
      month,
      days_in_month: daysInMonth,
      employees,
      summary,
    };

    return successResponse(reportData);
  } catch (error: any) {
    logger.error('Monthly attendance report error:', error);
    return errorResponse(error.message || 'Failed to generate monthly attendance report', 500);
  }
};

export const handler: Handler = requireAuth(getMonthlyAttendanceReport);
