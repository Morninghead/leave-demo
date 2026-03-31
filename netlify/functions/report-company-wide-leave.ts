/**
 * Company-wide Leave & Shift Swap Report
 *
 * Comprehensive report for entire organization showing:
 * - All departments summary
 * - Company-wide statistics
 * - Trends and analytics
 * - Compliance metrics
 *
 * Used for executive dashboard and labor law compliance
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { getFiscalSettings } from './utils/fiscal-year';

interface EmployeeLeaveSummary {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  leave_stats: Record<string, number>; // leave_type_code -> total_days
}

interface DepartmentSummary {
  department_id: number;
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

interface LeaveTypeBreakdown {
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  total_requests: number;
  approved_requests: number;
  total_days: number;
}

interface CompanyWideReportData {
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
  departments: DepartmentSummary[];
  leave_type_breakdown: LeaveTypeBreakdown[];
  monthly_trends?: Array<{
    month: string;
    leave_requests: number;
    shift_swaps: number;
    total_days: number;
  }>;
  all_leave_types?: { code: string; name_th: string; name_en: string }[];
}

const getCompanyWideLeaveReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Only HR, Admin, and Dev can access company-wide report
    const userRole = event.user?.role;
    if (!['hr', 'admin', 'dev'].includes(userRole || '')) {
      return errorResponse('Permission denied - HR, Admin, or Dev only', 403);
    }

    const searchParams = new URLSearchParams(event.rawQuery || '');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const includeMonthlyTrends = searchParams.get('include_trends') === 'true';

    // Load dynamic fiscal settings
    const fiscalSettings = await getFiscalSettings();
    const cycleStartDay = fiscalSettings.cycle_start_day; // e.g. 26

    // Default date range: Fiscal Year of current year
    const currentYear = new Date().getFullYear();
    let defaultStartDate, defaultEndDate;

    if (fiscalSettings.cycle_type === 'thai_government') {
      // Oct 1 - Sep 30
      defaultStartDate = `${currentYear - 1}-10-01`;
      defaultEndDate = `${currentYear}-09-30`;
    } else if (fiscalSettings.cycle_type === 'calendar') {
      // Jan 1 - Dec 31
      defaultStartDate = `${currentYear}-01-01`;
      defaultEndDate = `${currentYear}-12-31`;
    } else {
      // Day of Month (e.g. 26 - 25)
      defaultStartDate = new Date(currentYear - 1, 11, cycleStartDay).toISOString().split('T')[0];
      defaultEndDate = new Date(currentYear, 11, cycleStartDay - 1).toISOString().split('T')[0];
    }



    // ... (existing code)

    const dateStart = startDate || defaultStartDate;
    const dateEnd = endDate || defaultEndDate;

    // Get department summaries (Existing Query)
    const departmentSummaries = await query(
      `SELECT
        d.id as department_id,
        d.department_code as department_code,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) as active_employees,
        COUNT(DISTINCT lr.id) as total_leave_requests,
        COUNT(DISTINCT ssr.id) as total_shift_swaps,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.status = 'approved') +
          COUNT(DISTINCT ssr.id) FILTER (WHERE ssr.status = 'approved') as approved_requests,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.status = 'pending') +
          COUNT(DISTINCT ssr.id) FILTER (WHERE ssr.status = 'pending') as pending_requests,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.status = 'rejected') +
          COUNT(DISTINCT ssr.id) FILTER (WHERE ssr.status = 'rejected') as rejected_requests,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.is_half_day = false AND lr.is_hourly_leave = false) as total_full_day_requests,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.is_half_day = true AND lr.half_day_period IN ('morning', 'first_half')) as total_half_day_morning,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.is_half_day = true AND lr.half_day_period IN ('afternoon', 'second_half')) as total_half_day_afternoon,
        COUNT(DISTINCT lr.id) FILTER (WHERE lr.is_hourly_leave = true) as total_hourly_requests,
        COALESCE(SUM(lr.total_days) FILTER (WHERE lr.status = 'approved'), 0) as total_days
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id
        AND lr.start_date <= $2 AND lr.end_date >= $1
      LEFT JOIN shift_swap_requests ssr ON e.id = ssr.employee_id
        AND ssr.work_date >= $1 AND ssr.work_date <= $2
      WHERE d.is_active = true
      GROUP BY d.id, d.department_code, d.name_th, d.name_en
      ORDER BY d.department_code`,
      [dateStart, dateEnd]
    );

    // Get Detailed Employee Leave Breakdown (NEW)
    const employeeLeaveDetails = await query(
      `SELECT 
        d.id as department_id,
        e.id as employee_uuid,
        e.employee_code as employee_code,
        e.first_name_th as fname_th,
        e.last_name_th as lname_th,
        e.first_name_en as fname_en,
        e.last_name_en as lname_en,
        lt.code as leave_type_code,
        COALESCE(SUM(lr.total_days), 0) as total_days
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id 
        AND lr.start_date <= $2 AND lr.end_date >= $1 
        AND lr.status = 'approved'
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE d.is_active = true AND e.is_active = true
      GROUP BY d.id, e.id, e.employee_code, e.first_name_th, e.last_name_th, e.first_name_en, e.last_name_en, lt.code
      ORDER BY d.department_code, e.employee_code`,
      [dateStart, dateEnd]
    );

    // Organize employee details into Map<DeptID, Employee[]>
    const deptEmployeesMap = new Map<number, EmployeeLeaveSummary[]>();

    employeeLeaveDetails.forEach((row: any) => {
      const deptId = row.department_id;
      if (!deptEmployeesMap.has(deptId)) {
        deptEmployeesMap.set(deptId, []);
      }

      const list = deptEmployeesMap.get(deptId)!;
      let emp = list.find(x => x.employee_id === row.employee_uuid);

      if (!emp) {
        emp = {
          employee_id: row.employee_uuid,
          employee_code: row.employee_code,
          employee_name_th: `${row.fname_th || ''} ${row.lname_th || ''}`.trim(),
          employee_name_en: `${row.fname_en || ''} ${row.lname_en || ''}`.trim(),
          leave_stats: {}
        };
        list.push(emp);
      }

      if (row.leave_type_code) {
        emp.leave_stats[row.leave_type_code] = parseFloat(row.total_days);
      }
    });

    // Merge into departments array
    const departments: DepartmentSummary[] = departmentSummaries.map((row: any) => {
      const activeEmployees = parseInt(row.active_employees || 0);
      const totalDays = parseFloat(row.total_days || 0);

      return {
        department_id: row.department_id,
        department_code: row.department_code,
        department_name_th: row.department_name_th,
        department_name_en: row.department_name_en,
        total_employees: parseInt(row.total_employees || 0),
        active_employees: activeEmployees,
        total_leave_requests: parseInt(row.total_leave_requests || 0),
        total_shift_swaps: parseInt(row.total_shift_swaps || 0),
        approved_requests: parseInt(row.approved_requests || 0),
        pending_requests: parseInt(row.pending_requests || 0),
        rejected_requests: parseInt(row.rejected_requests || 0),
        total_full_day_requests: parseInt(row.total_full_day_requests || 0),
        total_half_day_morning: parseInt(row.total_half_day_morning || 0),
        total_half_day_afternoon: parseInt(row.total_half_day_afternoon || 0),
        total_hourly_requests: parseInt(row.total_hourly_requests || 0),
        total_days: totalDays,
        avg_days_per_employee: activeEmployees > 0 ? totalDays / activeEmployees : 0,
        employees: deptEmployeesMap.get(row.department_id) || []
      };
    });

    // Get all leave types for reference in frontend/PDF
    const allLeaveTypesResult = await query(
      `SELECT code, name_th, name_en FROM leave_types WHERE is_active = true ORDER BY name_en`
    );
    const all_leave_types = allLeaveTypesResult.map((r: any) => ({
      code: r.code,
      name_th: r.name_th,
      name_en: r.name_en
    }));

    // Get leave type breakdown
    const leaveTypeBreakdownResult = await query(
      `SELECT
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        COUNT(lr.id) as total_requests,
        COUNT(lr.id) FILTER (WHERE lr.status = 'approved') as approved_requests,
        COALESCE(SUM(lr.total_days) FILTER (WHERE lr.status = 'approved'), 0) as total_days
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id
        AND lr.start_date <= $2 AND lr.end_date >= $1
      WHERE lt.is_active = true
      GROUP BY lt.id, lt.code, lt.name_th, lt.name_en
      HAVING COUNT(lr.id) > 0
      ORDER BY total_requests DESC`,
      [dateStart, dateEnd]
    );

    const leave_type_breakdown: LeaveTypeBreakdown[] = leaveTypeBreakdownResult.map(
      (row: any) => ({
        leave_type_code: row.leave_type_code,
        leave_type_name_th: row.leave_type_name_th,
        leave_type_name_en: row.leave_type_name_en,
        total_requests: parseInt(row.total_requests || 0),
        approved_requests: parseInt(row.approved_requests || 0),
        total_days: parseFloat(row.total_days || 0),
      })
    );

    // Calculate overall summary
    const overall_summary = {
      total_departments: departments.length,
      total_employees: departments.reduce((sum, d) => sum + d.total_employees, 0),
      active_employees: departments.reduce((sum, d) => sum + d.active_employees, 0),
      total_leave_requests: departments.reduce((sum, d) => sum + d.total_leave_requests, 0),
      total_shift_swaps: departments.reduce((sum, d) => sum + d.total_shift_swaps, 0),
      total_requests:
        departments.reduce((sum, d) => sum + d.total_leave_requests, 0) +
        departments.reduce((sum, d) => sum + d.total_shift_swaps, 0),
      approved_requests: departments.reduce((sum, d) => sum + d.approved_requests, 0),
      pending_requests: departments.reduce((sum, d) => sum + d.pending_requests, 0),
      rejected_requests: departments.reduce((sum, d) => sum + d.rejected_requests, 0),
      total_days: departments.reduce((sum, d) => sum + d.total_days, 0),
      avg_days_per_employee: 0,
    };

    overall_summary.avg_days_per_employee =
      overall_summary.active_employees > 0
        ? overall_summary.total_days / overall_summary.active_employees
        : 0;

    // Get monthly trends if requested
    let monthly_trends: any[] | undefined = undefined;

    if (includeMonthlyTrends) {
      try {
        // Construct the SQL CASE statement dynamically based on cycle type
        let dateGroupingLogic = '';
        let seriesStartDate = dateStart;
        let seriesEndDate = dateEnd;

        if (fiscalSettings.cycle_type === 'calendar') {
          // Simple calendar month grouping
          dateGroupingLogic = `date_trunc('month', date_column)`;
        } else if (fiscalSettings.cycle_type === 'thai_government') {
          // Calendar month is fine, but fiscal year starts in Oct
          dateGroupingLogic = `date_trunc('month', date_column)`;
        } else {
          // Day of month cycle (e.g. 26th starts next month)
          // For the series generation, we need fiscal months (not calendar months)
          // If start date is Dec 26, 2025, the fiscal month is Jan 2026
          const startDateObj = new Date(dateStart);
          const startDay = startDateObj.getDate();
          if (startDay >= cycleStartDay) {
            // Shift to next calendar month for fiscal month series
            startDateObj.setDate(1); // Avoid overflow (e.g. Jan 31 -> Feb 28/29)
            startDateObj.setMonth(startDateObj.getMonth() + 1);
          }
          seriesStartDate = startDateObj.toISOString().split('T')[0];

          // For end date, if it's before cycleStartDay, it's still current fiscal month
          const endDateObj = new Date(dateEnd);
          const endDay = endDateObj.getDate();
          if (endDay >= cycleStartDay) {
            endDateObj.setDate(1); // Avoid overflow (e.g. Jan 31 -> Feb 28/29)
            endDateObj.setMonth(endDateObj.getMonth() + 1);
          }
          seriesEndDate = endDateObj.toISOString().split('T')[0];

          dateGroupingLogic = `
              CASE 
                WHEN EXTRACT(DAY FROM date_column) >= ${cycleStartDay}
                THEN date_trunc('month', date_column) + interval '1 month'
                ELSE date_trunc('month', date_column)
              END
             `;
        }

        const monthlyTrendsResult = await query(
          `SELECT
            TO_CHAR(dates.month, 'YYYY-MM') as month,
            d.name_th as department_name_th,
            d.name_en as department_name_en,
            COALESCE(COUNT(DISTINCT lr.employee_id), 0) as total_people,
            COALESCE(COUNT(DISTINCT lr.id), 0) as leave_requests,
            COALESCE(COUNT(DISTINCT ssr.id), 0) as shift_swaps,
            COALESCE(SUM(lr.total_days) FILTER (WHERE lr.status = 'approved'), 0) as total_days
          FROM (
            SELECT generate_series(
              date_trunc('month', $1::date),
              date_trunc('month', $2::date),
              interval '1 month'
            ) as month
          ) dates
          CROSS JOIN (SELECT id, name_th, name_en FROM departments WHERE is_active = true) d
          LEFT JOIN employees e ON e.department_id = d.id
          LEFT JOIN leave_requests lr ON 
            e.id = lr.employee_id
            AND (${dateGroupingLogic.replace(/date_column/g, 'lr.start_date')}) = dates.month
          LEFT JOIN shift_swap_requests ssr ON 
            e.id = ssr.employee_id
            AND (${dateGroupingLogic.replace(/date_column/g, 'ssr.work_date')}) = dates.month
          GROUP BY dates.month, d.id, d.name_th, d.name_en
          ORDER BY dates.month, d.name_th`,
          [seriesStartDate, seriesEndDate]
        );

        monthly_trends = monthlyTrendsResult.map((row: any) => ({
          month: row.month,
          department_name_th: row.department_name_th,
          department_name_en: row.department_name_en,
          total_people: parseInt(row.total_people || 0),
          leave_requests: parseInt(row.leave_requests || 0),
          shift_swaps: parseInt(row.shift_swaps || 0),
          total_days: parseFloat(row.total_days || 0),
        }));
      } catch (error) {
        logger.error('Error fetching monthly trends (non-critical):', error);
        monthly_trends = undefined; // Gracefully degrade without trends
      }
    }

    const reportData: CompanyWideReportData = {
      date_range: {
        start: dateStart,
        end: dateEnd,
      },
      overall_summary,
      departments,
      leave_type_breakdown,
      monthly_trends,
      all_leave_types,
    };

    return successResponse(reportData);
  } catch (error: any) {
    logger.error('Company-wide leave report error:', error);
    return errorResponse(error.message || 'Failed to generate company-wide leave report', 500);
  }
};

export const handler: Handler = requireAuth(getCompanyWideLeaveReport);
