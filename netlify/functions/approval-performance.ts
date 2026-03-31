import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getFiscalSettings, getFiscalYearDateRange } from './utils/fiscal-year';

const getApprovalPerformance = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const yearParam = queryParams.year || new Date().getFullYear().toString();
    const year = parseInt(yearParam);

    // Calculate Fiscal Year Date Range (Dynamic)
    const settings = await getFiscalSettings();
    const { start: fiscalStartDate, end: fiscalEndDate } = getFiscalYearDateRange(year, settings);

    const dateParams = [fiscalStartDate, fiscalEndDate];

    // Dynamic Month Grouping
    let monthCaseSql = 'created_at';
    if (settings.cycle_type === 'day_of_month') {
      monthCaseSql = `CASE 
            WHEN EXTRACT(DAY FROM created_at) >= ${settings.cycle_start_day} THEN created_at + interval '1 month'
            ELSE created_at 
          END`;
    }

    // 1. Approval Speed Metrics
    const approvalSpeed = await query(
      `SELECT
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours,
        MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as min_hours,
        MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as max_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as median_hours
      FROM leave_requests
      WHERE status IN ('approved', 'rejected')
        AND created_at >= $1 AND created_at <= $2`,
      dateParams
    );

    // 2. Approval Rate by Stage
    const rateByStage = await query(
      `SELECT
        current_approval_stage,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM leave_requests
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY current_approval_stage
      ORDER BY current_approval_stage`,
      dateParams
    );

    // 3. Monthly Approval Trends
    const monthlyTrends = await query(
      `SELECT
        TO_CHAR((${monthCaseSql}), 'Mon') as month,
        EXTRACT(MONTH FROM (${monthCaseSql})) as month_number,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        AVG(CASE WHEN status IN ('approved', 'rejected')
          THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
        END) as avg_approval_hours
      FROM leave_requests
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY 
        TO_CHAR((${monthCaseSql}), 'Mon'),
        EXTRACT(MONTH FROM (${monthCaseSql}))
      ORDER BY month_number`,
      dateParams
    );

    // Fill missing months
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleString('en-US', { month: 'short' }),
      month_number: i + 1,
      total_requests: 0,
      approved: 0,
      rejected: 0,
      avg_approval_hours: 0
    }));

    monthlyTrends.forEach(trend => {
      const index = parseInt(trend.month_number) - 1;
      if (index >= 0 && index < 12) {
        allMonths[index] = {
          month: trend.month,
          month_number: parseInt(trend.month_number),
          total_requests: parseInt(trend.total_requests),
          approved: parseInt(trend.approved),
          rejected: parseInt(trend.rejected),
          avg_approval_hours: parseFloat(trend.avg_approval_hours) || 0
        };
      }
    });

    // 4. Summary
    const summary = await query(
      `SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        ROUND((COUNT(CASE WHEN status = 'approved' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as approval_rate
      FROM leave_requests
      WHERE created_at >= $1 AND created_at <= $2`,
      dateParams
    );

    return successResponse({
      year: parseInt(yearParam),
      approval_speed: {
        avg_hours: parseFloat(approvalSpeed[0]?.avg_hours || 0),
        min_hours: parseFloat(approvalSpeed[0]?.min_hours || 0),
        max_hours: parseFloat(approvalSpeed[0]?.max_hours || 0),
        median_hours: parseFloat(approvalSpeed[0]?.median_hours || 0)
      },
      rate_by_stage: rateByStage.map(stage => ({
        ...stage,
        total: parseInt(stage.total),
        approved: parseInt(stage.approved),
        rejected: parseInt(stage.rejected),
        pending: parseInt(stage.pending),
        approval_rate: stage.total > 0 ? ((parseInt(stage.approved) / parseInt(stage.total)) * 100).toFixed(1) : '0'
      })),
      monthly_trends: allMonths,
      summary: {
        total_requests: parseInt(summary[0]?.total_requests || 0),
        approved_count: parseInt(summary[0]?.approved_count || 0),
        rejected_count: parseInt(summary[0]?.rejected_count || 0),
        pending_count: parseInt(summary[0]?.pending_count || 0),
        approval_rate: parseFloat(summary[0]?.approval_rate || 0)
      }
    });

  } catch (error: any) {
    console.error('Approval performance error:', error);
    return errorResponse(error.message || 'Failed to get approval performance', 500);
  }
};

export const handler: Handler = requireAuth(getApprovalPerformance);
