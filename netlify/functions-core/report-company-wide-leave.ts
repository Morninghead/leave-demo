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
  total_days: number;
  avg_days_per_employee: number;
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
}

const getCompanyWideLeaveReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Only HR and Admin can access company-wide report
    const userRole = event.user?.role;
    if (!['hr', 'admin'].includes(userRole || '')) {
      return errorResponse('Permission denied - HR or Admin only', 403);
    }

    const searchParams = new URLSearchParams(event.rawQuery || '');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const includeMonthlyTrends = searchParams.get('include_trends') === 'true';

    // Default date range: current year
    const defaultStartDate = new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .split('T')[0];
    const defaultEndDate = new Date(new Date().getFullYear(), 11, 31)
      .toISOString()
      .split('T')[0];

    const dateStart = startDate || defaultStartDate;
    const dateEnd = endDate || defaultEndDate;

    // Get department summaries
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
        COALESCE(SUM(lr.total_days) FILTER (WHERE lr.status = 'approved'), 0) as total_days
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id
        AND lr.start_date >= $1 AND lr.end_date <= $2
      LEFT JOIN shift_swap_requests ssr ON e.id = ssr.employee_id
        AND ssr.work_date >= $1 AND ssr.work_date <= $2
      WHERE d.is_active = true
      GROUP BY d.id, d.department_code, d.name_th, d.name_en
      ORDER BY d.department_code`,
      [dateStart, dateEnd]
    );

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
        total_days: totalDays,
        avg_days_per_employee: activeEmployees > 0 ? totalDays / activeEmployees : 0,
      };
    });

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
        AND lr.start_date >= $1 AND lr.end_date <= $2
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
        const monthlyTrendsResult = await query(
          `SELECT
            TO_CHAR(dates.month, 'YYYY-MM') as month,
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
          LEFT JOIN leave_requests lr ON date_trunc('month', lr.start_date) = dates.month
            AND lr.start_date >= $1 AND lr.end_date <= $2
          LEFT JOIN shift_swap_requests ssr ON date_trunc('month', ssr.work_date) = dates.month
            AND ssr.work_date >= $1 AND ssr.work_date <= $2
          GROUP BY dates.month
          ORDER BY dates.month`,
          [dateStart, dateEnd]
        );

        monthly_trends = monthlyTrendsResult.map((row: any) => ({
          month: row.month,
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
    };

    return successResponse(reportData);
  } catch (error: any) {
    logger.error('Company-wide leave report error:', error);
    return errorResponse(error.message || 'Failed to generate company-wide leave report', 500);
  }
};

export const handler: Handler = requireAuth(getCompanyWideLeaveReport);
