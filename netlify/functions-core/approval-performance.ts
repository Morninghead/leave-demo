import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const getApprovalPerformance = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const year = queryParams.year || new Date().getFullYear().toString();

    // 1. Approval Speed Metrics
    const approvalSpeed = await query(
      `SELECT
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours,
        MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as min_hours,
        MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as max_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as median_hours
      FROM leave_requests
      WHERE status IN ('approved', 'rejected')
        AND EXTRACT(YEAR FROM created_at) = $1`,
      [year]
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
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY current_approval_stage
      ORDER BY current_approval_stage`,
      [year]
    );

    // 3. Monthly Approval Trends
    const monthlyTrends = await query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        EXTRACT(MONTH FROM created_at) as month_number,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        AVG(CASE WHEN status IN ('approved', 'rejected')
          THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
        END) as avg_approval_hours
      FROM leave_requests
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY DATE_TRUNC('month', created_at), EXTRACT(MONTH FROM created_at)
      ORDER BY month_number`,
      [year]
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
      allMonths[index] = {
        month: trend.month,
        month_number: parseInt(trend.month_number),
        total_requests: parseInt(trend.total_requests),
        approved: parseInt(trend.approved),
        rejected: parseInt(trend.rejected),
        avg_approval_hours: parseFloat(trend.avg_approval_hours) || 0
      };
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
      WHERE EXTRACT(YEAR FROM created_at) = $1`,
      [year]
    );

    return successResponse({
      year: parseInt(year),
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
