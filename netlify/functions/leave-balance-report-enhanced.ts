/**
 * Enhanced Leave Balance Report with Validation, Risk Analysis, and Financial Calculations
 *
 * Features:
 * - Comprehensive leave balance data with all leave types
 * - Validation logic (6 critical rules)
 * - Risk analysis (low balance, high unused, expiring leave)
 * - Financial liability calculations
 * - Pending leave tracking
 * - Historical context (last leave date, days since)
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface LeaveBalanceDetail {
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
  pending_days: number;
  available_days: number;
  accumulated_minutes: number;
  utilization_rate: number;
}

interface ValidationError {
  employee_code: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  details: any;
}

interface RiskFlag {
  low_balance_warning: boolean;
  high_unused_warning: boolean;
  expiring_leave_alert: boolean;
  risk_level: 'low' | 'medium' | 'high';
  risk_messages: string[];
}

interface YearEndMetrics {
  days_until_year_end: number;
  annual_leave_utilization_rate: number;
  thai_labor_compliance_status: 'compliant' | 'at_risk' | 'non_compliant';
  compliance_score: number;
  financial_liability_forecast: number;
  recommended_year_end_action: string;
}

interface EmployeeBalanceReport {
  // Employee info
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  department_id: string;
  department_name_th: string;
  department_name_en: string;
  position_th: string;
  position_en: string;
  hire_date: string;
  years_of_service: number;

  // Leave balances by type
  leave_balances: LeaveBalanceDetail[];

  // Financial impact
  cost_impact: {
    daily_salary_estimate: number;
    unused_leave_liability: number;
  };

  // Risk flags
  risk_flags: RiskFlag;

  // Historical context
  last_leave_date: string | null;
  days_since_last_leave: number | null;

  // Year-End Planning Metrics
  year_end_metrics: YearEndMetrics;

  // Metadata
  year: number;
  validation_errors: ValidationError[];
}

/**
 * Validation Logic - 6 Critical Rules
 */
function validateLeaveBalance(
  employeeCode: string,
  balance: LeaveBalanceDetail
): ValidationError[] {
  const errors: ValidationError[] = [];
  const tolerance = 0.1; // Allow 0.1 day tolerance for rounding

  // Rule 1: Remaining days should never be negative
  if (balance.remaining_days < 0) {
    errors.push({
      employee_code: employeeCode,
      rule: 'NEGATIVE_BALANCE',
      severity: 'error',
      message: `Negative balance detected for ${balance.leave_type_name_en}`,
      details: { remaining: balance.remaining_days }
    });
  }

  // Rule 2: Used + Remaining should equal Allocated
  const total = balance.used_days + balance.remaining_days;
  const discrepancy = Math.abs(total - balance.allocated_days);
  if (discrepancy > tolerance) {
    errors.push({
      employee_code: employeeCode,
      rule: 'BALANCE_MISMATCH',
      severity: 'error',
      message: `Balance integrity violation for ${balance.leave_type_name_en}`,
      details: {
        allocated: balance.allocated_days,
        used: balance.used_days,
        remaining: balance.remaining_days,
        total,
        discrepancy
      }
    });
  }

  // Rule 3: Used days should not exceed allocated days
  if (balance.used_days > balance.allocated_days + tolerance) {
    errors.push({
      employee_code: employeeCode,
      rule: 'OVER_UTILIZATION',
      severity: 'error',
      message: `Over-utilization detected for ${balance.leave_type_name_en}`,
      details: {
        allocated: balance.allocated_days,
        used: balance.used_days,
        overage: balance.used_days - balance.allocated_days
      }
    });
  }

  // Rule 4: Pending should not exceed remaining
  if (balance.pending_days > balance.remaining_days + tolerance) {
    errors.push({
      employee_code: employeeCode,
      rule: 'PENDING_EXCEEDS_REMAINING',
      severity: 'warning',
      message: `Pending requests exceed remaining balance for ${balance.leave_type_name_en}`,
      details: {
        remaining: balance.remaining_days,
        pending: balance.pending_days
      }
    });
  }

  // Rule 5: Available days should be non-negative
  if (balance.available_days < 0) {
    errors.push({
      employee_code: employeeCode,
      rule: 'NEGATIVE_AVAILABLE',
      severity: 'warning',
      message: `Negative available balance for ${balance.leave_type_name_en}`,
      details: {
        remaining: balance.remaining_days,
        pending: balance.pending_days,
        available: balance.available_days
      }
    });
  }

  // Rule 6: Utilization rate calculation accuracy
  const expectedUtilization = balance.allocated_days > 0
    ? (balance.used_days / balance.allocated_days) * 100
    : 0;
  if (Math.abs(expectedUtilization - balance.utilization_rate) > 0.5) {
    errors.push({
      employee_code: employeeCode,
      rule: 'UTILIZATION_MISMATCH',
      severity: 'warning',
      message: `Utilization rate calculation error for ${balance.leave_type_name_en}`,
      details: {
        calculated: balance.utilization_rate,
        expected: expectedUtilization
      }
    });
  }

  return errors;
}

/**
 * Risk Analysis Algorithm
 */
function analyzeRisk(
  employee: any,
  leaveBalances: LeaveBalanceDetail[],
  yearsOfService: number
): RiskFlag {
  const annualLeave = leaveBalances.find(lb => lb.leave_type_code === 'annual');
  const riskMessages: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Default flags
  let lowBalanceWarning = false;
  let highUnusedWarning = false;
  let expiringLeaveAlert = false;

  if (annualLeave && annualLeave.allocated_days > 0) {
    const remainingPercentage = annualLeave.remaining_days / annualLeave.allocated_days;
    const utilizationRate = annualLeave.utilization_rate / 100;

    // Check for low balance (< 20% remaining)
    if (remainingPercentage < 0.20) {
      lowBalanceWarning = true;
      riskLevel = 'high';
      riskMessages.push(
        `Low annual leave balance (${annualLeave.remaining_days.toFixed(1)}/${annualLeave.allocated_days} days). Employee may take unplanned leave soon.`
      );
    }

    // Check for high unused (< 20% utilization for employees with > 1 year service)
    if (utilizationRate < 0.20 && yearsOfService > 1 && annualLeave.allocated_days > 5) {
      highUnusedWarning = true;
      if (riskLevel === 'low') riskLevel = 'medium';
      riskMessages.push(
        `High unused leave (${annualLeave.used_days.toFixed(1)}/${annualLeave.allocated_days} days used). Potential burnout risk.`
      );
    }

    // Check for expiring leave (> 50% remaining with < 3 months until year-end)
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const monthsUntilYearEnd = 12 - currentMonth;
    if (remainingPercentage > 0.50 && monthsUntilYearEnd < 3) {
      expiringLeaveAlert = true;
      if (riskLevel === 'low') riskLevel = 'medium';
      riskMessages.push(
        `High unused leave with ${monthsUntilYearEnd} months until year-end. Leave may expire.`
      );
    }
  }

  return {
    low_balance_warning: lowBalanceWarning,
    high_unused_warning: highUnusedWarning,
    expiring_leave_alert: expiringLeaveAlert,
    risk_level: riskLevel,
    risk_messages: riskMessages
  };
}

/**
 * Calculate Year-End Planning Metrics
 */
function calculateYearEndMetrics(
  leaveBalances: LeaveBalanceDetail[],
  yearsOfService: number,
  avgDailySalary: number = 800
): YearEndMetrics {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const yearEnd = new Date(currentYear, 11, 31); // December 31st
  const daysUntilYearEnd = Math.ceil((yearEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

  // Find annual leave balance
  const annualLeave = leaveBalances.find(lb => lb.leave_type_code === 'annual');

  let utilizationRate = 0;
  let complianceStatus: 'compliant' | 'at_risk' | 'non_compliant' = 'non_compliant';
  let complianceScore = 0;
  let recommendedAction = '';

  if (annualLeave && annualLeave.allocated_days > 0) {
    utilizationRate = annualLeave.utilization_rate / 100;

    // Thai Labor Law compliance assessment
    // Employees should take reasonable annual leave throughout the year
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const expectedUtilizationByMonth = (currentMonth / 12) * 0.6; // 60% expected by year-end
    const remainingDaysPercentage = annualLeave.remaining_days / annualLeave.allocated_days;

    if (utilizationRate >= 0.7) {
      complianceStatus = 'compliant';
      complianceScore = 90 + Math.min(10, utilizationRate * 10);
      recommendedAction = 'Maintain good work-life balance. Consider strategic leave planning.';
    } else if (utilizationRate >= 0.4 || (remainingDaysPercentage < 0.3 && daysUntilYearEnd > 90)) {
      complianceStatus = 'at_risk';
      complianceScore = 60 + (utilizationRate * 30);
      recommendedAction = 'Plan remaining leave strategically. Consider time off before year-end.';
    } else {
      complianceStatus = 'non_compliant';
      complianceScore = Math.max(0, utilizationRate * 50);
      recommendedAction = 'URGENT: Schedule leave immediately to avoid burnout and ensure compliance.';
    }
  }

  // Calculate financial liability forecast (what might be lost if leave expires)
  const annualLeaveRemaining = annualLeave ? annualLeave.remaining_days : 0;
  const financialLiabilityForecast = annualLeaveRemaining * avgDailySalary;

  return {
    days_until_year_end: Math.max(0, daysUntilYearEnd),
    annual_leave_utilization_rate: parseFloat((utilizationRate * 100).toFixed(1)),
    thai_labor_compliance_status: complianceStatus,
    compliance_score: Math.round(complianceScore),
    financial_liability_forecast: parseFloat(financialLiabilityForecast.toFixed(2)),
    recommended_year_end_action: recommendedAction
  };
}

/**
 * Calculate Financial Impact
 */
function calculateFinancialImpact(
  leaveBalances: LeaveBalanceDetail[],
  avgDailySalary: number = 800 // Default 800 THB/day
): { daily_salary_estimate: number; unused_leave_liability: number } {
  const totalRemainingDays = leaveBalances.reduce(
    (sum, lb) => sum + lb.remaining_days,
    0
  );

  return {
    daily_salary_estimate: avgDailySalary,
    unused_leave_liability: parseFloat((totalRemainingDays * avgDailySalary).toFixed(2))
  };
}

const leaveBalanceReportEnhanced = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;
  const userId = event.user?.userId;

  try {
    // Get company settings for average salary
    const settingsResult = await query(
      `SELECT setting_value FROM company_settings WHERE setting_key = 'avg_daily_salary'`
    );
    const avgDailySalary = settingsResult.length > 0
      ? parseFloat(settingsResult[0].setting_value)
      : 400; // Rayong Province Minimum Wage 2025-2026: 400 THB/day

    // Build employee query with role-based filtering
    let employeeSql = `
      SELECT
        e.id,
        e.employee_code,
        e.first_name_th,
        e.last_name_th,
        e.first_name_en,
        e.last_name_en,
        e.hire_date,
        d.id as department_id,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        e.position_th,
        e.position_en,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) +
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date)) / 12.0 as years_of_service
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.is_active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Apply role-based filtering
    if (!['hr', 'admin'].includes(userRole || '')) {
      if (userRole === 'manager') {
        const userDept = await query('SELECT department_id FROM employees WHERE id = $1', [userId]);
        if (userDept.length > 0 && userDept[0].department_id) {
          employeeSql += ` AND e.department_id = $${paramIndex}`;
          params.push(userDept[0].department_id);
          paramIndex++;
        }
      } else {
        employeeSql += ` AND e.id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }
    }

    employeeSql += ` ORDER BY d.name_th, e.employee_code`;

    const employees = await query(employeeSql, params);

    // For each employee, get detailed leave balances
    const enhancedBalances: EmployeeBalanceReport[] = [];
    const allValidationErrors: ValidationError[] = [];

    for (const emp of employees) {
      // Get all leave balances for this employee
      const balancesData = await query(`
        SELECT
          lb.id,
          lt.id as leave_type_id,
          lt.code as leave_type_code,
          lt.name_th as leave_type_name_th,
          lt.name_en as leave_type_name_en,
          COALESCE(lb.total_days, 0) as allocated_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.remaining_days, 0) as remaining_days,
          COALESCE(lb.accumulated_minutes, 0) as accumulated_minutes
        FROM leave_types lt
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id
          AND lb.employee_id = $1
          AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
        WHERE lt.is_active = true
        ORDER BY lt.sort_order, lt.code
      `, [emp.id]);

      // Get pending leave days for each leave type
      const pendingData = await query(`
        SELECT
          lt.code as leave_type_code,
          COALESCE(SUM(lr.total_days), 0) as pending_days
        FROM leave_requests lr
        INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = $1
          AND lr.status = 'pending'
          AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        GROUP BY lt.code
      `, [emp.id]);

      const pendingMap = new Map(pendingData.map((p: any) => [p.leave_type_code, parseFloat(p.pending_days)]));

      // Get last leave date
      const lastLeaveData = await query(`
        SELECT MAX(end_date) as last_leave_date
        FROM leave_requests
        WHERE employee_id = $1
          AND status = 'approved'
      `, [emp.id]);

      const lastLeaveDate = lastLeaveData[0]?.last_leave_date || null;
      const daysSinceLastLeave = lastLeaveDate
        ? Math.floor((Date.now() - new Date(lastLeaveDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Build leave balance details with validation
      const leaveBalances: LeaveBalanceDetail[] = balancesData.map((lb: any) => {
        const pendingDays = pendingMap.get(lb.leave_type_code) || 0;
        const availableDays = lb.remaining_days - pendingDays;
        const utilizationRate = lb.allocated_days > 0
          ? (lb.used_days / lb.allocated_days) * 100
          : 0;

        const balance: LeaveBalanceDetail = {
          leave_type_id: lb.leave_type_id,
          leave_type_code: lb.leave_type_code,
          leave_type_name_th: lb.leave_type_name_th,
          leave_type_name_en: lb.leave_type_name_en,
          allocated_days: parseFloat(lb.allocated_days),
          used_days: parseFloat(lb.used_days),
          remaining_days: parseFloat(lb.remaining_days),
          pending_days: parseFloat(pendingDays.toFixed(1)),
          available_days: parseFloat(availableDays.toFixed(1)),
          accumulated_minutes: parseInt(lb.accumulated_minutes),
          utilization_rate: parseFloat(utilizationRate.toFixed(1))
        };

        // Validate this balance
        const validationErrors = validateLeaveBalance(emp.employee_code, balance);
        allValidationErrors.push(...validationErrors);

        return balance;
      });

      // Calculate financial impact
      const costImpact = calculateFinancialImpact(leaveBalances, avgDailySalary);

      // Calculate year-end planning metrics
      const yearEndMetrics = calculateYearEndMetrics(leaveBalances, emp.years_of_service, avgDailySalary);

      // Analyze risk
      const riskFlags = analyzeRisk(emp, leaveBalances, emp.years_of_service);

      // Get validation errors for this employee
      const employeeValidationErrors = allValidationErrors.filter(
        e => e.employee_code === emp.employee_code
      );

      // Build complete employee report
      const employeeReport: EmployeeBalanceReport = {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name_th: `${emp.first_name_th} ${emp.last_name_th}`,
        employee_name_en: `${emp.first_name_en} ${emp.last_name_en}`,
        department_id: emp.department_id,
        department_name_th: emp.department_name_th || '-',
        department_name_en: emp.department_name_en || '-',
        position_th: emp.position_th || '-',
        position_en: emp.position_en || '-',
        hire_date: emp.hire_date,
        years_of_service: parseFloat(emp.years_of_service.toFixed(1)),
        leave_balances: leaveBalances,
        cost_impact: costImpact,
        risk_flags: riskFlags,
        last_leave_date: lastLeaveDate,
        days_since_last_leave: daysSinceLastLeave,
        year_end_metrics: yearEndMetrics,
        year: new Date().getFullYear(),
        validation_errors: employeeValidationErrors
      };

      enhancedBalances.push(employeeReport);
    }

    // Calculate summary statistics
    const summary = {
      total_employees: enhancedBalances.length,
      total_departments: new Set(enhancedBalances.map(e => e.department_id)).size,
      total_validation_errors: allValidationErrors.filter(e => e.severity === 'error').length,
      total_validation_warnings: allValidationErrors.filter(e => e.severity === 'warning').length,
      risk_counts: {
        high: enhancedBalances.filter(e => e.risk_flags.risk_level === 'high').length,
        medium: enhancedBalances.filter(e => e.risk_flags.risk_level === 'medium').length,
        low: enhancedBalances.filter(e => e.risk_flags.risk_level === 'low').length
      },
      financial: {
        total_liability: parseFloat(
          enhancedBalances.reduce((sum, e) => sum + e.cost_impact.unused_leave_liability, 0).toFixed(2)
        ),
        avg_liability_per_employee: parseFloat(
          (enhancedBalances.reduce((sum, e) => sum + e.cost_impact.unused_leave_liability, 0) / enhancedBalances.length).toFixed(2)
        )
      },
      year_end_metrics: {
        days_until_year_end: enhancedBalances[0]?.year_end_metrics?.days_until_year_end || 0,
        compliance_counts: {
          compliant: enhancedBalances.filter(e => e.year_end_metrics.thai_labor_compliance_status === 'compliant').length,
          at_risk: enhancedBalances.filter(e => e.year_end_metrics.thai_labor_compliance_status === 'at_risk').length,
          non_compliant: enhancedBalances.filter(e => e.year_end_metrics.thai_labor_compliance_status === 'non_compliant').length
        },
        avg_compliance_score: enhancedBalances.length > 0
          ? parseFloat((enhancedBalances.reduce((sum, e) => sum + e.year_end_metrics.compliance_score, 0) / enhancedBalances.length).toFixed(1))
          : 0,
        avg_annual_utilization_rate: enhancedBalances.length > 0
          ? parseFloat((enhancedBalances.reduce((sum, e) => sum + e.year_end_metrics.annual_leave_utilization_rate, 0) / enhancedBalances.length).toFixed(1))
          : 0,
        total_financial_forecast: parseFloat(
          enhancedBalances.reduce((sum, e) => sum + e.year_end_metrics.financial_liability_forecast, 0).toFixed(2)
        )
      }
    };

    return successResponse({
      balances: enhancedBalances,
      summary,
      validation_errors: allValidationErrors,
      generated_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Enhanced leave balance report error:', error);
    return errorResponse(error.message || 'Failed to generate enhanced leave balance report', 500);
  }
};

export const handler: Handler = requireAuth(leaveBalanceReportEnhanced);
