import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

const getLeaveUsageAnalytics = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const year = queryParams.year || new Date().getFullYear().toString();
    const departmentId = queryParams.department_id;

    // Build department filter
    let deptFilter = '';
    const deptParams: any[] = [year];
    if (departmentId) {
      deptFilter = 'AND e.department_id = $2';
      deptParams.push(departmentId);
    }

    // 1. Usage by Leave Type - Use start_date for leave analysis, created_at for request metrics
    const usageByType = await query(
      `SELECT
        lt.name_th,
        lt.name_en,
        lt.code,
        COUNT(lr.id) as total_requests,
        SUM(CASE WHEN lr.status = 'approved' AND lr.is_hourly_leave THEN lr.leave_minutes / 480.0
                 WHEN lr.status = 'approved' AND NOT lr.is_hourly_leave THEN lr.total_days
                 ELSE 0 END) as total_days,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      LEFT JOIN employees e ON lr.employee_id = e.id
      WHERE lt.is_active = TRUE ${deptFilter}
      GROUP BY lt.id, lt.name_th, lt.name_en, lt.code
      ORDER BY total_days DESC NULLS LAST`,
      deptParams
    );

    // 2. Monthly Trends - Use start_date for when leave is taken, not when requested
    const monthlyTrends = await query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', lr.start_date), 'Mon') as month,
        EXTRACT(MONTH FROM lr.start_date) as month_number,
        COUNT(lr.id) as requests,
        SUM(CASE WHEN lr.status = 'approved' AND lr.is_hourly_leave THEN lr.leave_minutes / 480.0
                 WHEN lr.status = 'approved' AND NOT lr.is_hourly_leave THEN lr.total_days
                 ELSE 0 END) as days
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE EXTRACT(YEAR FROM lr.start_date) = $1 ${deptFilter}
      GROUP BY DATE_TRUNC('month', lr.start_date), EXTRACT(MONTH FROM lr.start_date)
      ORDER BY month_number`,
      deptParams
    );

    // Fill missing months with zeros
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleString('en-US', { month: 'short' }),
      month_number: i + 1,
      requests: 0,
      days: 0
    }));

    monthlyTrends.forEach(trend => {
      const index = parseInt(trend.month_number) - 1;
      allMonths[index] = {
        month: trend.month,
        month_number: parseInt(trend.month_number),
        requests: parseInt(trend.requests),
        days: parseFloat(trend.days) || 0
      };
    });

    // 3. Peak Periods (months with highest usage)
    const peakPeriods = [...allMonths]
      .sort((a, b) => b.days - a.days)
      .slice(0, 3)
      .map(p => ({
        month: p.month,
        days: p.days,
        requests: p.requests
      }));

    // 4. Day of Week Analysis - Use start_date for day analysis
    const dayOfWeekAnalysis = await query(
      `SELECT
        TO_CHAR(lr.start_date, 'Day') as day_name,
        EXTRACT(DOW FROM lr.start_date) as day_number,
        COUNT(lr.id) as requests,
        SUM(CASE WHEN lr.status = 'approved' AND lr.is_hourly_leave THEN lr.leave_minutes / 480.0
                 WHEN lr.status = 'approved' AND NOT lr.is_hourly_leave THEN lr.total_days
                 ELSE 0 END) as days
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE EXTRACT(YEAR FROM lr.start_date) = $1 ${deptFilter}
      GROUP BY TO_CHAR(lr.start_date, 'Day'), EXTRACT(DOW FROM lr.start_date)
      ORDER BY day_number`,
      deptParams
    );

    // 5. Average Request Duration - Use start_date and only approved requests
    const avgDuration = await query(
      `SELECT
        AVG(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END) as avg_days
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE EXTRACT(YEAR FROM lr.start_date) = $1
        AND lr.status = 'approved' ${deptFilter}`,
      deptParams
    );

    // 6. Top Leave Takers - Use start_date for when leave is taken
    const topLeaveTakers = await query(
      `SELECT
        e.employee_code,
        e.first_name_th || ' ' || e.last_name_th as name_th,
        e.first_name_en || ' ' || e.last_name_en as name_en,
        d.name_th as department_th,
        d.name_en as department_en,
        COUNT(lr.id) as total_requests,
        SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END) as total_days
      FROM employees e
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
        AND lr.status = 'approved'
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.is_active = true ${deptFilter.replace('e.department_id', 'e.department_id')}
      GROUP BY e.id, e.employee_code, e.first_name_th, e.last_name_th, e.first_name_en, e.last_name_en, d.name_th, d.name_en
      HAVING COUNT(lr.id) > 0
      ORDER BY total_days DESC
      LIMIT 10`,
      deptParams
    );

    // 7. Summary Statistics - Use start_date for leave analysis
    const summary = await query(
      `SELECT
        COUNT(DISTINCT lr.employee_id) as unique_employees,
        COUNT(lr.id) as total_requests,
        SUM(CASE WHEN lr.status = 'approved' AND lr.is_hourly_leave THEN lr.leave_minutes / 480.0
                 WHEN lr.status = 'approved' AND NOT lr.is_hourly_leave THEN lr.total_days
                 ELSE 0 END) as total_days,
        AVG(CASE WHEN lr.status = 'approved' AND lr.is_hourly_leave THEN lr.leave_minutes / 480.0
                 WHEN lr.status = 'approved' AND NOT lr.is_hourly_leave THEN lr.total_days
                 ELSE NULL END) as avg_days_per_request,
        COUNT(CASE WHEN lr.is_hourly_leave THEN 1 END) as hourly_requests,
        COUNT(CASE WHEN lr.is_half_day THEN 1 END) as half_day_requests,
        COUNT(CASE WHEN NOT lr.is_hourly_leave AND NOT lr.is_half_day THEN 1 END) as full_day_requests
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE EXTRACT(YEAR FROM lr.start_date) = $1 ${deptFilter}`,
      deptParams
    );

    return successResponse({
      year: parseInt(year),
      department_id: departmentId || null,
      usage_by_type: usageByType,
      monthly_trends: allMonths,
      peak_periods: peakPeriods,
      day_of_week_analysis: dayOfWeekAnalysis,
      avg_duration: parseFloat(avgDuration[0]?.avg_days || 0),
      top_leave_takers: topLeaveTakers,
      summary: {
        unique_employees: parseInt(summary[0]?.unique_employees || 0),
        total_requests: parseInt(summary[0]?.total_requests || 0),
        total_days: parseFloat(summary[0]?.total_days || 0),
        avg_days_per_request: parseFloat(summary[0]?.avg_days_per_request || 0),
        hourly_requests: parseInt(summary[0]?.hourly_requests || 0),
        half_day_requests: parseInt(summary[0]?.half_day_requests || 0),
        full_day_requests: parseInt(summary[0]?.full_day_requests || 0)
      }
    });

  } catch (error: any) {
    logger.error('Leave usage analytics error:', error);
    return errorResponse(error.message || 'Failed to get leave usage analytics', 500);
  }
};

export const handler: Handler = requireAuth(getLeaveUsageAnalytics);
