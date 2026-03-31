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
import { getFiscalSettings } from './utils/fiscal-year';

interface DayRecord {
  day: number;
  date: string; // YYYY-MM-DD
  leave_type?: string;
  leave_code?: string;
  is_shift_swap: boolean;
  status: string;
  leave_duration?: 'full' | 'half_day_morning' | 'half_day_afternoon' | 'hourly'; // For half-day/hourly tracking
  leave_hours?: number; // Number of hours for hourly leave
}

interface EmployeeMonthlyRecord {
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
  calendar_dates: string[]; // List of YYYY-MM-DD for column headers
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
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1; // 1-12

    if (month < 1 || month > 12) {
      return errorResponse('Invalid month (must be 1-12)', 400);
    }

    // Fiscal Month Logic (Dynamic)
    const settings = await getFiscalSettings();
    let startDate: Date;
    let endDate: Date;

    if (settings.cycle_type === 'day_of_month') {
      // Payroll cycle: e.g. 26th of previous month to 25th of current month
      const cycleStartDay = settings.cycle_start_day;
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
      }
      startDate = new Date(Date.UTC(prevYear, prevMonth - 1, cycleStartDay, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month - 1, cycleStartDay - 1, 0, 0, 0));
    } else {
      // Calendar based (calendar or thai_government often use full calendar months for attendance)
      // Start: 1st of Current Month
      // End: Last day of Current Month
      startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month, 0, 0, 0, 0));
    }

    // Calculate total days (should be around 30-31)
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysInMonth = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    // Generate array of expected dates
    const calendarDates: string[] = [];
    const currentDateIter = new Date(startDate);
    while (currentDateIter <= endDate) {
      calendarDates.push(currentDateIter.toISOString().split('T')[0]);
      currentDateIter.setDate(currentDateIter.getDate() + 1);
    }

    const startDateStr = calendarDates[0];
    const endDateStr = calendarDates[calendarDates.length - 1];

    // Permission check
    const userRole = event.user?.role;
    const userId = event.user?.userId;

    if (!['hr', 'admin', 'dev'].includes(userRole || '')) {
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
        calendar_dates: calendarDates,
        employees: [],
        summary: {
          total_employees: 0,
          total_leave_days: 0,
          total_shift_swaps: 0,
        },
      });
    }

    const employeeIds = employeesResult.map((e: any) => e.id);

    // Get all leave requests for this period (exclude rejected/cancelled)
    const leaveRequests = await query(
      `SELECT lr.employee_id, lr.start_date, lr.end_date, lr.status,
              lt.name_th as leave_type_th, lt.name_en as leave_type_en,
              lt.code as leave_code,
              lr.is_half_day, lr.half_day_period, 
              lr.is_hourly_leave, lr.leave_hours
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = ANY($1::uuid[])
         AND lr.start_date <= $3
         AND lr.end_date >= $2
         AND lr.status NOT IN ('rejected', 'canceled', 'voided')
       ORDER BY lr.start_date`,
      [employeeIds, startDateStr, endDateStr]
    );

    // Get all shift swap requests for this period (exclude rejected/cancelled)
    const shiftSwapRequests = await query(
      `SELECT ssr.employee_id, ssr.work_date, ssr.status
       FROM shift_swap_requests ssr
       WHERE ssr.employee_id = ANY($1::uuid[])
         AND ssr.work_date BETWEEN $2 AND $3
         AND ssr.status NOT IN ('rejected', 'canceled', 'voided')
       ORDER BY ssr.work_date`,
      [employeeIds, startDateStr, endDateStr]
    );

    // Build day-by-day records for each employee
    const employees: EmployeeMonthlyRecord[] = employeesResult.map((emp: any) => {
      const days: DayRecord[] = [];

      // Initialize all days based on calendarDates
      calendarDates.forEach((dateStr, index) => {
        const dayNum = parseInt(dateStr.split('-')[2]);
        days.push({
          day: dayNum,
          date: dateStr,
          is_shift_swap: false,
          status: 'working',
        });
      });

      // Mark leave request days
      leaveRequests.forEach((lr: any) => {
        if (lr.employee_id !== emp.id) return;

        // Normalize dates to YYYY-MM-DD strings
        const lrStartStr = typeof lr.start_date === 'string'
          ? lr.start_date.split('T')[0]
          : new Date(lr.start_date).toISOString().split('T')[0];
        const lrEndStr = typeof lr.end_date === 'string'
          ? lr.end_date.split('T')[0]
          : new Date(lr.end_date).toISOString().split('T')[0];

        // Check each day in our fiscal period
        days.forEach((dayRecord) => {
          if (dayRecord.date >= lrStartStr && dayRecord.date <= lrEndStr) {
            dayRecord.leave_type = lr.leave_type_th || lr.leave_type_en;
            dayRecord.leave_code = lr.leave_code;
            dayRecord.status = lr.status;
            // Derive duration type from database fields
            if (lr.is_hourly_leave) {
              dayRecord.leave_duration = 'hourly';
              dayRecord.leave_hours = lr.leave_hours;
            } else if (lr.is_half_day) {
              // Map half_day_period to leave_duration
              if (lr.half_day_period === 'morning' || lr.half_day_period === 'first_half') {
                dayRecord.leave_duration = 'half_day_morning';
              } else {
                dayRecord.leave_duration = 'half_day_afternoon';
              }
            } else {
              dayRecord.leave_duration = 'full';
            }
          }
        });
      });

      // Mark shift swap days
      shiftSwapRequests.forEach((ssr: any) => {
        if (ssr.employee_id !== emp.id) return;

        const swapRecord = days.find(d => d.date === ssr.work_date);
        if (swapRecord) {
          swapRecord.leave_type = 'Shift Swap';
          swapRecord.leave_code = 'SWAP';
          swapRecord.is_shift_swap = true;
          swapRecord.status = ssr.status;
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
      calendar_dates: calendarDates,
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
