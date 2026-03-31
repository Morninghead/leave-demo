// netlify/functions/reports.ts
import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

// Helper function to get week start and end dates
const getWeekRange = (dateString: string) => {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Monday start
  const monday = new Date(date.setDate(diff));
  const sunday = new Date(date.setDate(diff + 6));
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
};

// Helper function to get month start and end dates
const getMonthRange = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const end = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
  return { start, end };
};

// Helper function to get quarter start and end dates
const getQuarterRange = (year: number, quarter: number) => {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  return getMonthRange(year, endMonth);
};

// Helper function to build date filter conditions
const buildDateFilter = (params: {
  dateRange: string;
  year: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  weekNumber?: string;
  quarter?: string;
  dateColumn: string;
}) => {
  const { dateRange, year, month, startDate, endDate, weekNumber, quarter, dateColumn } = params;
  const conditions: string[] = [];
  const values: any[] = [];

  // Year filter (always applied if provided)
  if (year) {
    conditions.push(`EXTRACT(YEAR FROM ${dateColumn}) = $${conditions.length + 1}`);
    values.push(parseInt(year));
  }

  // Specific date range filters
  if (dateRange === 'custom' && startDate && endDate) {
    conditions.push(`${dateColumn} >= $${conditions.length + 1}`);
    values.push(startDate);
    conditions.push(`${dateColumn} <= $${conditions.length + 1}`);
    values.push(endDate);
  } else if (dateRange === 'week' && weekNumber) {
    // Get week range for the specified week
    const weekDate = new Date(parseInt(year), 0, 1 + (parseInt(weekNumber) - 1) * 7);
    const weekRange = getWeekRange(weekDate.toISOString());
    conditions.push(`${dateColumn} >= $${conditions.length + 1}`);
    values.push(weekRange.start);
    conditions.push(`${dateColumn} <= $${conditions.length + 1}`);
    values.push(weekRange.end);
  } else if (dateRange === 'month' && month) {
    const monthRange = getMonthRange(parseInt(year), parseInt(month));
    conditions.push(`${dateColumn} >= $${conditions.length + 1}`);
    values.push(monthRange.start);
    conditions.push(`${dateColumn} <= $${conditions.length + 1}`);
    values.push(monthRange.end);
  } else if (dateRange === 'quarter' && quarter) {
    const quarterRange = getQuarterRange(parseInt(year), parseInt(quarter));
    conditions.push(`${dateColumn} >= $${conditions.length + 1}`);
    values.push(quarterRange.start);
    conditions.push(`${dateColumn} <= $${conditions.length + 1}`);
    values.push(quarterRange.end);
  } else if (dateRange === 'year') {
    // Already filtered by year above
  } else if (month) {
    // Legacy month filter
    conditions.push(`EXTRACT(MONTH FROM ${dateColumn}) = $${conditions.length + 1}`);
    values.push(parseInt(month));
  }

  return { conditions, values };
};

const getReports = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  // ✅ Allow manager, hr, and admin
  const userRole = event.user?.role;

  if (!['manager', 'hr', 'admin', 'dev'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  try {
    const searchParams = new URLSearchParams(event.rawQuery || '');
    const reportType = searchParams.get('type') || 'leave';
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const month = searchParams.get('month') || '';
    const departmentId = searchParams.get('department_id') || '';
    
    // Advanced filtering options
    const dateRange = searchParams.get('date_range') || ''; // 'week', 'month', 'quarter', 'year', 'custom'
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const weekNumber = searchParams.get('week') || '';
    const quarter = searchParams.get('quarter') || '';

    if (reportType === 'leave') {
      // รายงานการลา
      let sql = `
        SELECT 
          e.employee_code,
          e.first_name_th || ' ' || e.last_name_th as employee_name,
          d.name_th as department_name,
          d.id as department_id,
          lt.name_th as leave_type,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.status,
          lr.created_at
        FROM leave_requests lr
        INNER JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
      `;

      const whereConditions: string[] = [];
      const params: any[] = [];

      // Build date filter for leave requests
      const dateFilter = buildDateFilter({
        dateRange,
        year,
        month,
        startDate,
        endDate,
        weekNumber,
        quarter,
        dateColumn: 'lr.start_date'
      });

      if (dateFilter.conditions.length > 0) {
        whereConditions.push(`(${dateFilter.conditions.join(' AND ')})`);
        params.push(...dateFilter.values);
      }

      // Department filter
      if (departmentId) {
        whereConditions.push(`e.department_id = $${params.length + 1}`);
        params.push(departmentId);
      }

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY lr.start_date DESC, e.employee_code`;

      const leaveReports = await query(sql, params);

      // สรุปตามประเภทการลา
      let summaryBySql = `
        SELECT 
          lt.name_th as leave_type,
          COUNT(*) as total_requests,
          SUM(lr.total_days) as total_days,
          COUNT(*) FILTER (WHERE lr.status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE lr.status = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE lr.status = 'pending') as pending_count
        FROM leave_requests lr
        INNER JOIN employees e ON lr.employee_id = e.id
        INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
      `;

      const summaryWhereConditions: string[] = [];
      const summaryParams: any[] = [];

      // Apply same filters to summary
      const summaryDateFilter = buildDateFilter({
        dateRange,
        year,
        month,
        startDate,
        endDate,
        weekNumber,
        quarter,
        dateColumn: 'lr.start_date'
      });

      if (summaryDateFilter.conditions.length > 0) {
        summaryWhereConditions.push(`(${summaryDateFilter.conditions.join(' AND ')})`);
        summaryParams.push(...summaryDateFilter.values);
      }

      if (departmentId) {
        summaryWhereConditions.push(`e.department_id = $${summaryParams.length + 1}`);
        summaryParams.push(departmentId);
      }

      if (summaryWhereConditions.length > 0) {
        summaryBySql += ` WHERE ${summaryWhereConditions.join(' AND ')}`;
      }

      summaryBySql += ` GROUP BY lt.name_th ORDER BY total_days DESC`;

      const summaryByType = await query(summaryBySql, summaryParams);

      // สรุปตามแผนก
      let summaryByDeptSql = `
        SELECT 
          d.name_th as department_name,
          d.id as department_id,
          COUNT(*) as total_requests,
          SUM(lr.total_days) as total_days,
          COUNT(*) FILTER (WHERE lr.status = 'approved') as approved_count
        FROM leave_requests lr
        INNER JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
      `;

      const deptWhereConditions: string[] = [];
      const deptParams: any[] = [];

      const deptDateFilter = buildDateFilter({
        dateRange,
        year,
        month,
        startDate,
        endDate,
        weekNumber,
        quarter,
        dateColumn: 'lr.start_date'
      });

      if (deptDateFilter.conditions.length > 0) {
        deptWhereConditions.push(`(${deptDateFilter.conditions.join(' AND ')})`);
        deptParams.push(...deptDateFilter.values);
      }

      if (departmentId) {
        deptWhereConditions.push(`e.department_id = $${deptParams.length + 1}`);
        deptParams.push(departmentId);
      }

      if (deptWhereConditions.length > 0) {
        summaryByDeptSql += ` WHERE ${deptWhereConditions.join(' AND ')}`;
      }

      summaryByDeptSql += ` GROUP BY d.name_th, d.id ORDER BY total_days DESC`;

      const summaryByDept = await query(summaryByDeptSql, deptParams);

      return successResponse({
        report_type: 'leave',
        year: parseInt(year),
        month: month ? parseInt(month) : null,
        date_range: dateRange || null,
        start_date: startDate || null,
        end_date: endDate || null,
        week_number: weekNumber ? parseInt(weekNumber) : null,
        quarter: quarter ? parseInt(quarter) : null,
        department_id: departmentId || null,
        data: leaveReports,
        summary_by_type: summaryByType,
        summary_by_department: summaryByDept,
      });

    } else if (reportType === 'shift') {
      // รายงานการสลับวัน
      let sql = `
        SELECT 
          e.employee_code,
          e.first_name_th || ' ' || e.last_name_th as employee_name,
          d.name_th as department_name,
          d.id as department_id,
          sr.work_date,
          sr.off_date,
          sr.reason_th,
          sr.status,
          sr.created_at
        FROM shift_swap_requests sr
        INNER JOIN employees e ON sr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
      `;

      const whereConditions: string[] = [];
      const params: any[] = [];

      // Build date filter for shift requests (using created_at for shift requests)
      const dateFilter = buildDateFilter({
        dateRange,
        year,
        month,
        startDate,
        endDate,
        weekNumber,
        quarter,
        dateColumn: 'sr.created_at'
      });

      if (dateFilter.conditions.length > 0) {
        whereConditions.push(`(${dateFilter.conditions.join(' AND ')})`);
        params.push(...dateFilter.values);
      }

      // Department filter
      if (departmentId) {
        whereConditions.push(`e.department_id = $${params.length + 1}`);
        params.push(departmentId);
      }

      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      sql += ` ORDER BY sr.created_at DESC, e.employee_code`;

      const shiftReports = await query(sql, params);

      // สรุปตามสถานะ
      let summarySql = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
        FROM shift_swap_requests sr
        INNER JOIN employees e ON sr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
      `;

      const summaryWhereConditions: string[] = [];
      const summaryParams: any[] = [];

      const summaryDateFilter = buildDateFilter({
        dateRange,
        year,
        month,
        startDate,
        endDate,
        weekNumber,
        quarter,
        dateColumn: 'sr.created_at'
      });

      if (summaryDateFilter.conditions.length > 0) {
        summaryWhereConditions.push(`(${summaryDateFilter.conditions.join(' AND ')})`);
        summaryParams.push(...summaryDateFilter.values);
      }

      if (departmentId) {
        summaryWhereConditions.push(`e.department_id = $${summaryParams.length + 1}`);
        summaryParams.push(departmentId);
      }

      if (summaryWhereConditions.length > 0) {
        summarySql += ` WHERE ${summaryWhereConditions.join(' AND ')}`;
      }

      const summary = await query(summarySql, summaryParams);

      return successResponse({
        report_type: 'shift',
        year: parseInt(year),
        month: month ? parseInt(month) : null,
        date_range: dateRange || null,
        start_date: startDate || null,
        end_date: endDate || null,
        week_number: weekNumber ? parseInt(weekNumber) : null,
        quarter: quarter ? parseInt(quarter) : null,
        department_id: departmentId || null,
        data: shiftReports,
        summary: summary[0],
      });

    } else {
      return errorResponse('Invalid report type', 400);
    }

  } catch (error: any) {
    console.error('Get reports error:', error);
    return errorResponse(error.message || 'Failed to get reports', 500);
  }
};

export const handler: Handler = requireAuth(getReports);
