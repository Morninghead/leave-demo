import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getFiscalSettings, getFiscalYearDateRange } from './utils/fiscal-year';

const getShiftSwapReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {




    const queryParams = event.queryStringParameters || {};
    const yearParam = queryParams.year || new Date().getFullYear().toString();
    const year = parseInt(yearParam);
    const departmentId = queryParams.department_id;

    // Calculate Fiscal Year Date Range (Dynamic)
    const settings = await getFiscalSettings();
    const { start: fiscalStartDate, end: fiscalEndDate } = getFiscalYearDateRange(year, settings);

    let deptFilter = '';
    const deptParams: any[] = [fiscalStartDate, fiscalEndDate];
    if (departmentId) {
      deptFilter = 'AND e.department_id = $3';
      deptParams.push(departmentId);
    }

    // 1. All Shift Swaps
    const swaps = await query(
      `SELECT
        ssr.id,
        ssr.employee_id,
        e.employee_code,
        e.first_name_th || ' ' || e.last_name_th as employee_name_th,
        e.first_name_en || ' ' || e.last_name_en as employee_name_en,
        d.name_th as department_th,
        d.name_en as department_en,
        ssr.work_date,
        ssr.off_date,
        ssr.reason_th,
        ssr.reason_en,
        ssr.status,
        ssr.created_at
      FROM shift_swap_requests ssr
      JOIN employees e ON ssr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE ssr.created_at >= $1 AND ssr.created_at <= $2 ${deptFilter}
      ORDER BY ssr.created_at DESC`,
      deptParams
    );

    // Dynamic Month Grouping
    let monthCaseSql = 'ssr.created_at';
    if (settings.cycle_type === 'day_of_month') {
      monthCaseSql = `CASE 
            WHEN EXTRACT(DAY FROM ssr.created_at) >= ${settings.cycle_start_day} THEN ssr.created_at + interval '1 month'
            ELSE ssr.created_at 
          END`;
    }

    // 2. Monthly Trends
    const monthlyTrends = await query(
      `SELECT
        TO_CHAR((${monthCaseSql}), 'Mon') as month,
        EXTRACT(MONTH FROM (${monthCaseSql})) as month_number,
        COUNT(ssr.id) as requests,
        COUNT(CASE WHEN ssr.status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN ssr.status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN ssr.status = 'pending' THEN 1 END) as pending
      FROM shift_swap_requests ssr
      JOIN employees e ON ssr.employee_id = e.id
      WHERE ssr.created_at >= $1 AND ssr.created_at <= $2 ${deptFilter}
      GROUP BY 
        TO_CHAR((${monthCaseSql}), 'Mon'),
        EXTRACT(MONTH FROM (${monthCaseSql}))
      ORDER BY month_number`,
      deptParams
    );

    // Fill missing months
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleString('en-US', { month: 'short' }),
      month_number: i + 1,
      requests: 0,
      approved: 0,
      rejected: 0,
      pending: 0
    }));

    monthlyTrends.forEach(trend => {
      const index = parseInt(trend.month_number) - 1;
      // Handle edge case where fiscal month calculation results in month 13 -> 1 (Jan)
      // Actually EXTRACT(MONTH) returns 1-12. If adding 1 month to Dec leads to Jan, it is 1.
      if (index >= 0 && index < 12) {
        allMonths[index] = {
          month: trend.month,
          month_number: parseInt(trend.month_number),
          requests: parseInt(trend.requests),
          approved: parseInt(trend.approved),
          rejected: parseInt(trend.rejected),
          pending: parseInt(trend.pending)
        };
      }
    });

    // 3. Summary
    const summary = await query(
      `SELECT
        COUNT(ssr.id) as total_requests,
        COUNT(CASE WHEN ssr.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN ssr.status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN ssr.status = 'pending' THEN 1 END) as pending_count,
        COUNT(DISTINCT ssr.employee_id) as unique_employees
      FROM shift_swap_requests ssr
      JOIN employees e ON ssr.employee_id = e.id
      WHERE ssr.created_at >= $1 AND ssr.created_at <= $2 ${deptFilter}`,
      deptParams
    );

    // 4. Top Requesters
    const topRequesters = await query(
      `SELECT
        e.employee_code,
        e.first_name_th || ' ' || e.last_name_th as name_th,
        e.first_name_en || ' ' || e.last_name_en as name_en,
        d.name_th as department_th,
        d.name_en as department_en,
        COUNT(ssr.id) as total_requests,
        COUNT(CASE WHEN ssr.status = 'approved' THEN 1 END) as approved_count
      FROM employees e
      JOIN shift_swap_requests ssr ON ssr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE ssr.created_at >= $1 AND ssr.created_at <= $2 ${deptFilter}
      GROUP BY e.id, e.employee_code, e.first_name_th, e.last_name_th, e.first_name_en, e.last_name_en, d.name_th, d.name_en
      HAVING COUNT(ssr.id) > 0
      ORDER BY total_requests DESC
      LIMIT 10`,
      deptParams
    );

    return successResponse({
      year: parseInt(yearParam),
      swap_requests: swaps,
      monthly_trends: allMonths,
      summary: {
        total_requests: parseInt(summary[0]?.total_requests || 0),
        approved_count: parseInt(summary[0]?.approved_count || 0),
        rejected_count: parseInt(summary[0]?.rejected_count || 0),
        pending_count: parseInt(summary[0]?.pending_count || 0),
        unique_employees: parseInt(summary[0]?.unique_employees || 0)
      },
      top_requesters: topRequesters.map(r => ({
        ...r,
        total_requests: parseInt(r.total_requests),
        approved_count: parseInt(r.approved_count)
      }))
    });

  } catch (error: any) {
    console.error('Shift swap report error:', error);
    return errorResponse(error.message || 'Failed to get shift swap report', 500);
  }
};

export const handler: Handler = requireAuth(getShiftSwapReport);
