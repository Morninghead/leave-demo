/**
 * Historical Leave Balance Trending
 *
 * Provides month-over-month and year-over-year leave balance trends
 * for analysis and forecasting
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface MonthlySnapshot {
  year: number;
  month: number;
  month_name: string;
  total_employees: number;
  leave_type: string;
  total_allocated: number;
  total_used: number;
  total_remaining: number;
  avg_utilization: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
}

interface DepartmentTrend {
  department_id: string;
  department_name: string;
  monthly_data: Array<{
    year: number;
    month: number;
    utilization_rate: number;
    employee_count: number;
  }>;
}

const leaveBalanceHistoricalHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const userRole = event.user?.role;

  // Only HR, admin, and managers can view historical trends
  if (!['hr', 'admin', 'manager'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  try {
    const searchParams = new URLSearchParams(event.rawQuery || '');
    const startDate = searchParams.get('start_date') || getDefaultStartDate();
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const leaveType = searchParams.get('leave_type') || 'VAC';
    const departmentId = searchParams.get('department_id');
    const view = searchParams.get('view') || 'monthly'; // monthly or yearly

    // Get historical snapshots
    if (view === 'monthly') {
      const monthlyTrends = await getMonthlyTrends(startDate, endDate, leaveType, departmentId);
      return successResponse({
        view: 'monthly',
        start_date: startDate,
        end_date: endDate,
        leave_type: leaveType,
        data: monthlyTrends
      });
    } else if (view === 'yearly') {
      const yearlyTrends = await getYearlyTrends(startDate, endDate, leaveType, departmentId);
      return successResponse({
        view: 'yearly',
        start_date: startDate,
        end_date: endDate,
        leave_type: leaveType,
        data: yearlyTrends
      });
    } else if (view === 'department') {
      const deptTrends = await getDepartmentTrends(startDate, endDate, leaveType);
      return successResponse({
        view: 'department',
        start_date: startDate,
        end_date: endDate,
        leave_type: leaveType,
        data: deptTrends
      });
    }

    return errorResponse('Invalid view parameter', 400);

  } catch (error: any) {
    console.error('Historical trends error:', error);
    return errorResponse(error.message || 'Failed to get historical trends', 500);
  }
};

/**
 * Get default start date (6 months ago)
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split('T')[0];
}

/**
 * Get monthly trends from leave_balances table
 * Since we're building this now, we'll simulate monthly snapshots
 * In production, you'd want to create a monthly snapshot job
 */
async function getMonthlyTrends(
  startDate: string,
  endDate: string,
  leaveType: string,
  departmentId?: string | null
): Promise<MonthlySnapshot[]> {
  // For now, we'll generate current snapshot and project backwards
  // In production, implement monthly snapshot table

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const sql = `
    WITH monthly_series AS (
      SELECT
        DATE_TRUNC('month', generate_series(
          $1::date,
          $2::date,
          '1 month'::interval
        )) as month_date
    ),
    leave_data AS (
      SELECT
        EXTRACT(YEAR FROM ms.month_date)::int as year,
        EXTRACT(MONTH FROM ms.month_date)::int as month,
        TO_CHAR(ms.month_date, 'Month') as month_name,
        COUNT(DISTINCT e.id) as total_employees,
        lt.code as leave_type,
        COALESCE(SUM(lb.total_days), 0) as total_allocated,
        COALESCE(SUM(lb.used_days), 0) as total_used,
        COALESCE(SUM(lb.remaining_days), 0) as total_remaining,
        CASE
          WHEN COALESCE(SUM(lb.total_days), 0) > 0
          THEN ROUND((COALESCE(SUM(lb.used_days), 0) / SUM(lb.total_days)) * 100, 2)
          ELSE 0
        END as avg_utilization,
        COUNT(*) FILTER (
          WHERE COALESCE(lb.remaining_days, 0) / NULLIF(lb.total_days, 0) < 0.20
        ) as high_risk_count,
        COUNT(*) FILTER (
          WHERE COALESCE(lb.remaining_days, 0) / NULLIF(lb.total_days, 0) >= 0.20
          AND COALESCE(lb.remaining_days, 0) / NULLIF(lb.total_days, 0) < 0.50
        ) as medium_risk_count,
        COUNT(*) FILTER (
          WHERE COALESCE(lb.remaining_days, 0) / NULLIF(lb.total_days, 0) >= 0.50
        ) as low_risk_count
      FROM monthly_series ms
      CROSS JOIN leave_types lt
      LEFT JOIN employees e ON e.is_active = true
        ${departmentId ? 'AND e.department_id = $4' : ''}
      LEFT JOIN leave_balances lb ON lb.employee_id = e.id
        AND lb.leave_type_id = lt.id
        AND lb.year = EXTRACT(YEAR FROM ms.month_date)
      WHERE lt.code = $3
      GROUP BY ms.month_date, lt.code
      ORDER BY ms.month_date
    )
    SELECT * FROM leave_data
  `;

  const params = departmentId
    ? [startDate, endDate, leaveType, departmentId]
    : [startDate, endDate, leaveType];

  const results = await query(sql, params);
  return results as MonthlySnapshot[];
}

/**
 * Get yearly trends
 */
async function getYearlyTrends(
  startDate: string,
  endDate: string,
  leaveType: string,
  departmentId?: string | null
): Promise<any[]> {
  const sql = `
    WITH yearly_data AS (
      SELECT
        lb.year,
        COUNT(DISTINCT e.id) as total_employees,
        lt.code as leave_type,
        SUM(lb.total_days) as total_allocated,
        SUM(lb.used_days) as total_used,
        SUM(lb.remaining_days) as total_remaining,
        CASE
          WHEN SUM(lb.total_days) > 0
          THEN ROUND((SUM(lb.used_days) / SUM(lb.total_days)) * 100, 2)
          ELSE 0
        END as avg_utilization
      FROM leave_balances lb
      INNER JOIN employees e ON lb.employee_id = e.id
      INNER JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lt.code = $1
        AND lb.year >= EXTRACT(YEAR FROM $2::date)
        AND lb.year <= EXTRACT(YEAR FROM $3::date)
        ${departmentId ? 'AND e.department_id = $4' : ''}
      GROUP BY lb.year, lt.code
      ORDER BY lb.year
    )
    SELECT * FROM yearly_data
  `;

  const params = departmentId
    ? [leaveType, startDate, endDate, departmentId]
    : [leaveType, startDate, endDate];

  return await query(sql, params);
}

/**
 * Get department trends for heatmap visualization
 */
async function getDepartmentTrends(
  startDate: string,
  endDate: string,
  leaveType: string
): Promise<DepartmentTrend[]> {
  const sql = `
    WITH dept_monthly AS (
      SELECT
        d.id as department_id,
        d.name_th as department_name,
        EXTRACT(YEAR FROM generate_series(
          $1::date,
          $2::date,
          '1 month'::interval
        ))::int as year,
        EXTRACT(MONTH FROM generate_series(
          $1::date,
          $2::date,
          '1 month'::interval
        ))::int as month,
        COUNT(DISTINCT e.id) as employee_count,
        CASE
          WHEN SUM(lb.total_days) > 0
          THEN ROUND((SUM(lb.used_days) / SUM(lb.total_days)) * 100, 2)
          ELSE 0
        END as utilization_rate
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = true
      LEFT JOIN leave_balances lb ON lb.employee_id = e.id
      LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id AND lt.code = $3
      WHERE d.is_active = true
      GROUP BY d.id, d.name_th, year, month
      ORDER BY d.name_th, year, month
    )
    SELECT
      department_id,
      department_name,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'year', year,
          'month', month,
          'utilization_rate', utilization_rate,
          'employee_count', employee_count
        ) ORDER BY year, month
      ) as monthly_data
    FROM dept_monthly
    GROUP BY department_id, department_name
    ORDER BY department_name
  `;

  const results = await query(sql, [startDate, endDate, leaveType]);
  return results as DepartmentTrend[];
}

export const handler: Handler = requireAuth(leaveBalanceHistoricalHandler);
