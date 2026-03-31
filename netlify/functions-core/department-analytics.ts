import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

const getDepartmentAnalytics = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const year = queryParams.year || new Date().getFullYear().toString();

    // 1. Department Overview
    // Filter by start_date (when leave is taken) not created_at (when requested)
    const departmentOverview = await query(
      `SELECT
        d.id,
        d.department_code as code,
        d.name_th,
        d.name_en,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT CASE WHEN e.is_active = true THEN e.id END) as active_employees,
        COUNT(DISTINCT lr.id) as total_requests,
        COALESCE(SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) as total_days,
        COALESCE(AVG(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) as avg_days_per_request,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_requests
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE d.is_active = TRUE
      GROUP BY d.id, d.department_code, d.name_th, d.name_en
      ORDER BY total_days DESC NULLS LAST`,
      [year]
    );

    // 2. Leave Type Distribution by Department
    const leaveTypeByDept = await query(
      `SELECT
        d.id as department_id,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        lt.name_th as leave_type_th,
        lt.name_en as leave_type_en,
        lt.code as leave_type_code,
        COUNT(lr.id) as requests,
        COALESCE(SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) as days
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE d.is_active = TRUE
      GROUP BY d.id, d.name_th, d.name_en, lt.id, lt.name_th, lt.name_en, lt.code
      HAVING COUNT(lr.id) > 0
      ORDER BY d.name_en, days DESC`,
      [year]
    );

    // 3. Department Utilization Rates
    const utilizationRates = await query(
      `SELECT
        d.id,
        d.name_th,
        d.name_en,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) as active_employees,
        COUNT(DISTINCT lr.employee_id) as employees_with_leave,
        CASE
          WHEN COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) > 0
          THEN ROUND((COUNT(DISTINCT lr.employee_id)::numeric / COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true)::numeric) * 100, 1)
          ELSE 0
        END as utilization_rate
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
        AND lr.status = 'approved'
      WHERE d.is_active = TRUE
      GROUP BY d.id, d.name_th, d.name_en
      ORDER BY utilization_rate DESC`,
      [year]
    );

    // 4. Monthly Department Trends (Top 5 departments)
    const monthlyDeptTrends = await query(
      `WITH top_depts AS (
        SELECT d.id
        FROM departments d
        JOIN employees e ON e.department_id = d.id
        JOIN leave_requests lr ON lr.employee_id = e.id
          AND EXTRACT(YEAR FROM lr.start_date) = $1
        WHERE d.is_active = TRUE
        GROUP BY d.id
        ORDER BY COUNT(lr.id) DESC
        LIMIT 5
      )
      SELECT
        d.id as department_id,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        EXTRACT(MONTH FROM lr.start_date) as month,
        TO_CHAR(DATE_TRUNC('month', lr.start_date), 'Mon') as month_name,
        COUNT(lr.id) as requests,
        COALESCE(SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) as days
      FROM departments d
      JOIN employees e ON e.department_id = d.id
      JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE d.id IN (SELECT id FROM top_depts)
      GROUP BY d.id, d.name_th, d.name_en, EXTRACT(MONTH FROM lr.start_date), TO_CHAR(DATE_TRUNC('month', lr.start_date), 'Mon')
      ORDER BY d.name_en, month`,
      [year]
    );

    // 5. Department Comparison Metrics
    const comparisonMetrics = await query(
      `SELECT
        d.name_th,
        d.name_en,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) as active_employees,
        COALESCE(SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) as total_days,
        CASE
          WHEN COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) > 0
          THEN ROUND(COALESCE(SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) / COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true), 2)
          ELSE 0
        END as days_per_employee,
        CASE
          WHEN COUNT(lr.id) > 0
          THEN ROUND((COUNT(CASE WHEN lr.status = 'approved' THEN 1 END)::numeric / COUNT(lr.id)::numeric) * 100, 1)
          ELSE 0
        END as approval_rate
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE d.is_active = TRUE
      GROUP BY d.id, d.name_th, d.name_en
      ORDER BY total_days DESC`,
      [year]
    );

    // 6. Summary
    const summary = await query(
      `SELECT
        COUNT(DISTINCT d.id) as total_departments,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT lr.id) as total_requests,
        COALESCE(SUM(CASE WHEN lr.is_hourly_leave THEN lr.leave_minutes / 480.0 ELSE lr.total_days END), 0) as total_days
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE d.is_active = TRUE`,
      [year]
    );

    return successResponse({
      year: parseInt(year),
      department_overview: departmentOverview.map(dept => ({
        ...dept,
        total_days: parseFloat(dept.total_days) || 0,
        avg_days_per_request: parseFloat(dept.avg_days_per_request) || 0
      })),
      leave_type_by_department: leaveTypeByDept.map(item => ({
        ...item,
        requests: parseInt(item.requests),
        days: parseFloat(item.days) || 0
      })),
      utilization_rates: utilizationRates.map(item => ({
        ...item,
        utilization_rate: parseFloat(item.utilization_rate) || 0
      })),
      monthly_department_trends: monthlyDeptTrends.map(item => ({
        ...item,
        month: parseInt(item.month),
        requests: parseInt(item.requests),
        days: parseFloat(item.days) || 0
      })),
      comparison_metrics: comparisonMetrics.map(item => ({
        ...item,
        total_days: parseFloat(item.total_days) || 0,
        days_per_employee: parseFloat(item.days_per_employee) || 0,
        approval_rate: parseFloat(item.approval_rate) || 0
      })),
      summary: {
        total_departments: parseInt(summary[0]?.total_departments || 0),
        total_employees: parseInt(summary[0]?.total_employees || 0),
        total_requests: parseInt(summary[0]?.total_requests || 0),
        total_days: parseFloat(summary[0]?.total_days || 0)
      }
    });

  } catch (error: any) {
    logger.error('Department analytics error:', error);
    return errorResponse(error.message || 'Failed to get department analytics', 500);
  }
};

export const handler: Handler = requireAuth(getDepartmentAnalytics);
