import { Handler } from '@netlify/functions';
import { successResponse, errorResponse } from './utils/response';
import { query } from './utils/db';

// Type definitions
interface MonthlyTrends {
  month: string;
  requests: number;
  approved: number;
  rejected: number;
}

export interface DashboardData {
  kpis: {
    totalEmployees: number;
    totalRequests: number;
    avgDaysPerRequest: number;
    approvalRate: number;
  };
  monthlyTrends: Array<{
    month: string;
    requests: number;
    approved: number;
    rejected: number;
  }>;
  leaveTypeDistribution: Array<{
    name: string;
    value: number;
  }>;
  departmentStats: Array<{
    department: string;
    requests: number;
    days: number;
  }>;
  recentActivity: Array<{
    id: string;
    employee: string;
    type: string;
    status: string;
    date: string;
  }>;
  alerts: Array<{
    id: string;
    message: string;
    severity: 'warning' | 'error' | 'info';
  }>;
}

export const handler: Handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    };
  }

  try {
    // Get date range from query parameters or use current year
    const currentYear = new Date().getFullYear();
    const queryParams = event.queryStringParameters || {};

    // Parse date range parameters
    let startDate, endDate;

    if (queryParams.startDate && queryParams.endDate) {
      // Handle DD/MM/YYYY format for start date
      const [startDay, startMonth, startYear] = queryParams.startDate.split('/').map(Number);
      startDate = new Date(startYear, startMonth - 1, startDay);

      // Handle DD/MM/YYYY format for end date
      const [endDay, endMonth, endYear] = queryParams.endDate.split('/').map(Number);
      endDate = new Date(endYear, endMonth - 1, endDay);
      endDate.setHours(23, 59, 59, 999); // End of day
    } else if (queryParams.month) {
      // Handle month filter (format: YYYY-MM)
      const [year, month] = queryParams.month.split('-').map(Number);
      startDate = new Date(year, month - 1, 1); // First day of month
      endDate = new Date(year, month, 0); // Last day of month
      endDate.setHours(23, 59, 59, 999); // End of day
    } else if (queryParams.year) {
      // Handle year filter (format: YYYY)
      const year = parseInt(queryParams.year);
      startDate = new Date(year, 0, 1); // January 1st
      endDate = new Date(year + 1, 0, 1); // January 1st of next year
    } else {
      // Default to current year
      startDate = new Date(currentYear, 0, 1); // January 1st
      endDate = new Date(currentYear + 1, 0, 1); // January 1st of next year
    }

    // Total Employees
    const totalEmployeesResult = await query(
      'SELECT COUNT(*) as count FROM employees WHERE is_active = true'
    );
    const totalEmployees = parseInt(totalEmployeesResult[0]?.count || '0');

    // Format dates for SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Total Leave Requests - Include both leave and shift swap requests
    const totalLeaveRequestsResult = await query(
      'SELECT COUNT(*) as count FROM leave_requests WHERE created_at >= $1 AND created_at < $2',
      [startDateStr, endDateStr]
    );
    const totalSwapRequestsResult = await query(
      'SELECT COUNT(*) as count FROM shift_swap_requests WHERE created_at >= $1 AND created_at < $2',
      [startDateStr, endDateStr]
    );
    const totalLeaveRequests = parseInt(totalLeaveRequestsResult[0]?.count || '0');
    const totalSwapRequests = parseInt(totalSwapRequestsResult[0]?.count || '0');
    const totalRequests = totalLeaveRequests + totalSwapRequests;

    // Average Days per Request - Calculate for leave requests only (shift swaps don't have days)
    let avgDaysPerRequest = 0;
    try {
      const avgDaysResult = await query(
        'SELECT AVG(total_days) as avg_days FROM leave_requests WHERE created_at >= $1 AND created_at < $2 AND total_days IS NOT NULL AND total_days > 0',
        [startDateStr, endDateStr]
      );
      avgDaysPerRequest = parseFloat(avgDaysResult[0]?.avg_days || '0');
    } catch (error) {
      console.error('Error calculating avgDaysPerRequest:', error);
      avgDaysPerRequest = 0;
    }

    // Approval Rate - Calculate for both leave requests and shift swap requests
    const approvedLeaveResult = await query(
      'SELECT COUNT(*) as count FROM leave_requests WHERE status = $1 AND created_at >= $2 AND created_at < $3',
      ['approved', startDateStr, endDateStr]
    );
    const approvedSwapResult = await query(
      'SELECT COUNT(*) as count FROM shift_swap_requests WHERE status = $1 AND created_at >= $2 AND created_at < $3',
      ['approved', startDateStr, endDateStr]
    );
    const approvedLeave = parseInt(approvedLeaveResult[0]?.count || '0');
    const approvedSwap = parseInt(approvedSwapResult[0]?.count || '0');
    const totalApproved = approvedLeave + approvedSwap;
    const approvalRate = totalRequests > 0 ? Math.round((totalApproved / totalRequests) * 100) : 0;

    // Monthly Trends - Show all months with 0 if no data (include both leave and shift swap requests)
    const monthlyTrendsResult = await query(
      `SELECT
        TO_CHAR(dates.month, 'Mon') as month,
        COALESCE(all_data.requests, 0) as requests,
        COALESCE(all_data.approved, 0) as approved,
        COALESCE(all_data.rejected, 0) as rejected
      FROM (
        SELECT generate_series(
          date_trunc('month', $1::date),
          date_trunc('month', $2::date) - interval '1 month',
          interval '1 month'
        ) as month
      ) dates
      LEFT JOIN (
        SELECT
          month,
          SUM(requests) as requests,
          SUM(approved) as approved,
          SUM(rejected) as rejected
        FROM (
          SELECT
            date_trunc('month', created_at) as month,
            COUNT(*) as requests,
            COUNT(*) FILTER (WHERE status = 'approved') as approved,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected
          FROM leave_requests
          WHERE created_at >= $1 AND created_at < $2
          GROUP BY date_trunc('month', created_at)
          UNION ALL
          SELECT
            date_trunc('month', created_at) as month,
            COUNT(*) as requests,
            COUNT(*) FILTER (WHERE status = 'approved') as approved,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected
          FROM shift_swap_requests
          WHERE created_at >= $1 AND created_at < $2
          GROUP BY date_trunc('month', created_at)
        ) combined_data
        GROUP BY month
      ) all_data ON dates.month = all_data.month
      ORDER BY dates.month`,
      [startDateStr, endDateStr]
    );
    const monthlyTrends: MonthlyTrends[] = monthlyTrendsResult.map(row => ({
      month: row.month,
      requests: parseInt(row.requests || '0'),
      approved: parseInt(row.approved || '0'),
      rejected: parseInt(row.rejected || '0')
    }));

    // Leave Type Distribution (exclude test data, use fallback to English if Thai is null/empty)
    const leaveTypeDistributionResult = await query(
      `SELECT
        COALESCE(
          NULLIF(TRIM(lt.name_th), ''),
          NULLIF(TRIM(lt.name_en), ''),
          lt.code
        ) as name,
        COUNT(lr.id) as value
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.created_at >= $1 AND lr.created_at < $2
        AND lt.name_en NOT ILIKE '%test%'
        AND lt.name_en NOT ILIKE '%demo%'
        AND lt.name_en NOT ILIKE '%sample%'
        AND lt.code NOT IN ('TEST', 'DEMO', 'SAMPLE')
        AND lt.is_active = true
      GROUP BY lt.id, lt.name_th, lt.name_en, lt.code
      ORDER BY value DESC`,
      [startDateStr, endDateStr]
    );
    const leaveTypeDistribution = leaveTypeDistributionResult
      .map(row => ({
        name: row.name || 'Unknown',
        value: parseInt(row.value || '0')
      }))
      .filter(row => {
        // Simple filtering to avoid complex regex
        const name = row.name.toString().trim();
        return name && name !== 'Unknown' && name.length > 1;
      });

    // Department Statistics - Show ALL departments, even with 0 requests (include both leave and shift swaps)
    let departmentStats = [];
    try {
      const departmentStatsResult = await query(
        `SELECT
          COALESCE(
            NULLIF(TRIM(d.name_th), ''),
            NULLIF(TRIM(d.name_en), ''),
            d.department_code || ' (Code)'
          ) as department,
          COALESCE(SUM(all_requests), 0) as requests,
          COALESCE(SUM(leave_days), 0) as days,
          COUNT(DISTINCT e.id) as total_employees
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = true
        LEFT JOIN (
          SELECT
            e.department_id,
            COUNT(lr.id) as all_requests,
            COALESCE(SUM(lr.total_days), 0) as leave_days
          FROM employees e
          LEFT JOIN leave_requests lr ON e.id = lr.employee_id
            AND lr.created_at >= $1 AND lr.created_at < $2
          WHERE e.is_active = true
          GROUP BY e.department_id
          UNION ALL
          SELECT
            e.department_id,
            COUNT(ssr.id) as all_requests,
            0 as leave_days
          FROM employees e
          LEFT JOIN shift_swap_requests ssr ON e.id = ssr.employee_id
            AND ssr.created_at >= $1 AND ssr.created_at < $2
          WHERE e.is_active = true
          GROUP BY e.department_id
        ) combined_data ON e.department_id = combined_data.department_id
        WHERE d.is_active = true
        GROUP BY d.id, d.name_th, d.name_en, d.department_code
        ORDER BY requests DESC, d.name_th, d.name_en`,
        [startDateStr, endDateStr]
      );
      departmentStats = departmentStatsResult
        .map(row => ({
          department: row.department || 'Unknown Department',
          requests: typeof row.requests === 'number' ? row.requests : parseInt(row.requests || '0'),
          days: typeof row.days === 'number' ? parseFloat(row.days.toFixed(1)) : parseFloat(parseFloat(row.days || '0').toFixed(1))
        }))
        .filter(row => {
          // Simple filtering to avoid complex regex
          const name = row.department.toString().trim();
          return name && name !== 'Unknown Department' && name.length > 1;
        });
    } catch (error) {
      console.error('Error fetching department stats:', error);
      departmentStats = [];
    }

    // Recent Activity (last 10 activities - simplified query to avoid errors)
    const recentActivityResult = await query(
      `SELECT
        lr.id,
        COALESCE(e.first_name_en || ' ' || e.last_name_en, e.first_name_th || ' ' || e.last_name_th) as employee,
        lt.name_en as type,
        lr.status,
        lr.created_at
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.created_at >= $1 AND lr.created_at < $2
        ORDER BY lr.created_at DESC
        LIMIT 10`,
      [startDateStr, endDateStr]
    );
    const recentActivity = recentActivityResult.map(row => ({
      id: row.id,
      employee: row.employee || 'Unknown',
      type: row.type || 'Unknown',
      status: row.status,
      date: new Date(row.created_at).toLocaleDateString()
    }));

    // System Alerts (potential issues)
    const alerts = [];

    // Check for employees with no leave balance
    const noBalanceResult = await query(
      `SELECT COUNT(*) as count
      FROM employees e
      LEFT JOIN leave_balances lb ON e.id = lb.employee_id AND lb.year = $1
      WHERE e.is_active = true AND lb.id IS NULL`,
      [startDate.getFullYear()]
    );

    if (parseInt(noBalanceResult[0]?.count || '0') > 0) {
      alerts.push({
        id: 'no-balance',
        message: `${noBalanceResult[0]?.count} employees have no leave balance set for ${currentYear}`,
        severity: 'warning'
      });
    }

    // Check for potential duplicate requests
    const duplicateRequestsResult = await query(
      `SELECT COUNT(*) as count
      FROM (
        SELECT employee_id, start_date, end_date, COUNT(*) as cnt
        FROM leave_requests
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY employee_id, start_date, end_date
        HAVING COUNT(*) > 1
      ) duplicates`,
      [startDateStr, endDateStr]
    );

    if (parseInt(duplicateRequestsResult[0]?.count || '0') > 0) {
      alerts.push({
        id: 'duplicates',
        message: `Found ${duplicateRequestsResult[0]?.count} sets of duplicate leave requests (same employee, same dates)`,
        severity: 'warning'
      });
    }

    // Check for test leave types
    const testLeaveTypesResult = await query(
      `SELECT COUNT(*) as count
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.created_at >= $1 AND lr.created_at < $2
        AND (lt.name_th ILIKE '%test%' OR lt.name_th ILIKE '%demo%' OR lt.name_th ILIKE '%sample%')`,
      [startDateStr, endDateStr]
    );

    if (parseInt(testLeaveTypesResult[0]?.count || '0') > 0) {
      alerts.push({
        id: 'test-data',
        message: `Found ${testLeaveTypesResult[0]?.count} requests with test leave types (should be cleaned up)`,
        severity: 'info'
      });
    }

    // Check for high leave usage - Fixed: Calculate actual used days from approved leave requests by date range
    try {
      const highUsageResult = await query(
        `SELECT
          COALESCE(
            NULLIF(TRIM(e.first_name_th || ' ' || e.last_name_th), ''),
            e.first_name_en || ' ' || e.last_name_en,
            'Unknown'
          ) as employee,
          COALESCE(SUM(lr.total_days), 0) as days_used,
          COUNT(lr.id) as approved_requests
        FROM employees e
        LEFT JOIN leave_requests lr ON e.id = lr.employee_id
          AND lr.status = 'approved'
          AND lr.start_date >= $1
          AND lr.start_date < $2
        WHERE e.is_active = true
        GROUP BY e.id, e.first_name_th, e.last_name_th, e.first_name_en, e.last_name_en
        HAVING COALESCE(SUM(lr.total_days), 0) > 15
        ORDER BY days_used DESC
        LIMIT 5`,
        [startDateStr, endDateStr]
      );

      if (highUsageResult && Array.isArray(highUsageResult)) {
        highUsageResult.forEach(row => {
          if (row && parseFloat(row.days_used || 0) > 15) {
            alerts.push({
              id: `high-usage-${row.employee || 'unknown'}`,
              message: `${row.employee} has used ${parseFloat(row.days_used).toFixed(1)} days (${row.approved_requests} requests) of leave in this period`,
              severity: 'info'
            });
          }
        });
      }
    } catch (error) {
      // If high usage query fails, just skip adding high usage alerts
      console.error('High usage query error (non-critical):', error);
    }

    // Check for employees approaching annual swap limit
    try {
      const currentYear = startDate.getFullYear();
      const highSwapUsageResult = await query(
        `SELECT
          COALESCE(
            NULLIF(TRIM(e.first_name_th || ' ' || e.last_name_th), ''),
            e.first_name_en || ' ' || e.last_name_en,
            'Unknown'
          ) as employee,
          COUNT(ssr.id) as approved_swaps,
          MAX(ssr.swap_count_for_year) as swap_count
        FROM employees e
        LEFT JOIN shift_swap_requests ssr ON e.id = ssr.employee_id
          AND ssr.status = 'approved'
          AND ssr.year = $1
        WHERE e.is_active = true
        GROUP BY e.id, e.first_name_th, e.last_name_th, e.first_name_en, e.last_name_en
        HAVING COUNT(ssr.id) >= 10  -- Alert if close to 12 swap limit
        ORDER BY approved_swaps DESC
        LIMIT 5`,
        [currentYear]
      );

      if (highSwapUsageResult && Array.isArray(highSwapUsageResult)) {
        highSwapUsageResult.forEach(row => {
          if (row && parseInt(row.approved_swaps || 0) >= 10) {
            const remainingSwaps = 12 - parseInt(row.approved_swaps || 0);
            alerts.push({
              id: `high-swap-usage-${row.employee || 'unknown'}`,
              message: `${row.employee} has used ${row.approved_swaps} of 12 annual shift swaps (${remainingSwaps} remaining)`,
              severity: remainingSwaps <= 2 ? 'warning' : 'info'
            });
          }
        });
      }
    } catch (error) {
      // If swap usage query fails, just skip adding swap usage alerts
      console.error('Swap usage query error (non-critical):', error);
    }

    const dashboardData: DashboardData = {
      kpis: {
        totalEmployees,
        totalRequests,
        avgDaysPerRequest,
        approvalRate
      },
      monthlyTrends,
      leaveTypeDistribution,
      departmentStats,
      recentActivity,
      alerts
    };

    return successResponse(dashboardData);
  } catch (error: any) {
    console.error('Executive dashboard error:', error);
    const errorMessage = error?.message || 'Failed to fetch dashboard data';
    return errorResponse(errorMessage, 500);
  }
};