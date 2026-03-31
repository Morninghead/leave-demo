/**
 * Year-End Leave Balance Planning Report
 *
 * Specialized endpoint for year-end planning with Thai labor law compliance focus
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface YearEndEmployeeMetrics {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  department_name_th: string;
  department_name_en: string;
  position_th: string;
  position_en: string;

  // Annual Leave Focus
  annual_leave_allocated: number;
  annual_leave_used: number;
  annual_leave_remaining: number;
  annual_leave_utilization_rate: number;

  // Thai Labor Law Compliance
  thai_labor_compliance_status: 'compliant' | 'at_risk' | 'non_compliant';
  compliance_score: number;
  recommended_action: string;

  // Year-End Planning
  financial_liability_forecast: number;
  days_until_year_end: number;
  urgency_level: 'low' | 'medium' | 'high' | 'critical';

  // Department Context
  department_compliance_ranking: number;
  department_total_employees: number;
}

interface YearEndDepartmentMetrics {
  department_id: string;
  department_name_th: string;
  department_name_en: string;
  total_employees: number;
  avg_annual_utilization_rate: number;
  compliance_distribution: {
    compliant: number;
    at_risk: number;
    non_compliant: number;
  };
  avg_compliance_score: number;
  total_financial_forecast: number;
  compliance_ranking: number;
}

interface YearEndPlanningReport {
  // Company Overview
  company_metrics: {
    total_employees: number;
    total_departments: number;
    days_until_year_end: number;
    overall_compliance_score: number;
    avg_annual_utilization_rate: number;
    total_financial_forecast: number;
  };

  // Employee Details
  employees: YearEndEmployeeMetrics[];

  // Department Summary
  departments: YearEndDepartmentMetrics[];

  // Compliance Summary
  compliance_summary: {
    compliant_count: number;
    at_risk_count: number;
    non_compliant_count: number;
    compliance_rate: number;
  };

  // Action Items
  urgent_actions_needed: number;
  employees_requiring_immediate_attention: string[];
}

const leaveBalanceYearEndReport = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;
  const userId = event.user?.userId;

  try {
    // Get company settings
    const settingsResult = await query(
      `SELECT setting_value FROM company_settings WHERE setting_key = 'avg_daily_salary'`
    );
    const avgDailySalary = settingsResult.length > 0
      ? parseFloat(settingsResult[0].setting_value)
      : 800; // Default 800 THB

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const yearEnd = new Date(currentYear, 11, 31);
    const daysUntilYearEnd = Math.ceil((yearEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    // Build employee query with role-based filtering
    let employeeSql = `
      SELECT
        e.id,
        e.employee_code,
        e.first_name_th,
        e.last_name_th,
        e.first_name_en,
        e.last_name_en,
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

    // Get department employee counts
    const deptCounts = await query(`
      SELECT
        department_id,
        COUNT(*) as total_employees
      FROM employees
      WHERE is_active = true
      GROUP BY department_id
    `);

    const deptCountMap = new Map(deptCounts.map((d: any) => [d.department_id, parseInt(d.total_employees)]));

    // Process each employee
    const employeeMetrics: YearEndEmployeeMetrics[] = [];
    const allUtilizationRates: number[] = [];

    for (const emp of employees) {
      // Get annual leave balance
      const annualLeaveData = await query(`
        SELECT
          COALESCE(lb.total_days, 0) as allocated_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.remaining_days, 0) as remaining_days
        FROM leave_types lt
        LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id
          AND lb.employee_id = $1
          AND lb.year = $2
        WHERE lt.code = 'annual'
          AND lt.is_active = true
      `, [emp.id, currentYear]);

      const annualLeave = annualLeaveData[0] || { allocated_days: 0, used_days: 0, remaining_days: 0 };

      // Calculate utilization rate
      const utilizationRate = annualLeave.allocated_days > 0
        ? (annualLeave.used_days / annualLeave.allocated_days) * 100
        : 0;

      // Determine compliance status and score
      let complianceStatus: 'compliant' | 'at_risk' | 'non_compliant' = 'non_compliant';
      let complianceScore = 0;
      let recommendedAction = '';
      let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'critical';

      if (utilizationRate >= 70) {
        complianceStatus = 'compliant';
        complianceScore = 90 + Math.min(10, utilizationRate / 10);
        recommendedAction = 'Maintain good work-life balance. Consider strategic leave planning.';
        urgencyLevel = 'low';
      } else if (utilizationRate >= 40) {
        complianceStatus = 'at_risk';
        complianceScore = 60 + (utilizationRate * 0.3);
        recommendedAction = 'Plan remaining leave strategically. Consider time off before year-end.';
        urgencyLevel = daysUntilYearEnd < 90 ? 'medium' : 'high';
      } else {
        complianceStatus = 'non_compliant';
        complianceScore = Math.max(0, utilizationRate * 0.5);
        recommendedAction = 'URGENT: Schedule leave immediately to avoid burnout and ensure compliance.';
        urgencyLevel = daysUntilYearEnd < 60 ? 'critical' : 'high';
      }

      const financialLiability = annualLeave.remaining_days * avgDailySalary;

      const employeeMetric: YearEndEmployeeMetrics = {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name_th: `${emp.first_name_th} ${emp.last_name_th}`,
        employee_name_en: `${emp.first_name_en} ${emp.last_name_en}`,
        department_name_th: emp.department_name_th || '-',
        department_name_en: emp.department_name_en || '-',
        position_th: emp.position_th || '-',
        position_en: emp.position_en || '-',
        annual_leave_allocated: parseFloat(annualLeave.allocated_days),
        annual_leave_used: parseFloat(annualLeave.used_days),
        annual_leave_remaining: parseFloat(annualLeave.remaining_days),
        annual_leave_utilization_rate: parseFloat(utilizationRate.toFixed(1)),
        thai_labor_compliance_status: complianceStatus,
        compliance_score: Math.round(complianceScore),
        recommended_action: recommendedAction,
        financial_liability_forecast: parseFloat(financialLiability.toFixed(2)),
        days_until_year_end: daysUntilYearEnd,
        urgency_level: urgencyLevel,
        department_compliance_ranking: 0, // Will be calculated later
        department_total_employees: deptCountMap.get(emp.department_id) || 1
      };

      employeeMetrics.push(employeeMetric);
      allUtilizationRates.push(utilizationRate);
    }

    // Calculate department metrics
    const departmentMap = new Map<string, YearEndEmployeeMetrics[]>();
    employeeMetrics.forEach(emp => {
      const deptId = emp.employee_id; // We'll group by department_id once we add it
      if (!departmentMap.has(deptId)) {
        departmentMap.set(deptId, []);
      }
      departmentMap.get(deptId)!.push(emp);
    });

    // Process department data
    const departmentMetrics: YearEndDepartmentMetrics[] = [];

    // Get unique departments
    const departments = await query(`
      SELECT DISTINCT
        d.id,
        d.name_th,
        d.name_en
      FROM departments d
      WHERE d.id IN (SELECT DISTINCT department_id FROM employees WHERE is_active = true)
      ORDER BY d.name_th
    `);

    for (const dept of departments) {
      const deptEmployees = employeeMetrics.filter(e => {
        // Find the employee's department by looking them up
        const emp = employees.find(emp => emp.id === e.employee_id);
        return emp?.department_id === dept.id;
      });

      if (deptEmployees.length === 0) continue;

      const avgUtilizationRate = deptEmployees.reduce((sum, e) => sum + e.annual_leave_utilization_rate, 0) / deptEmployees.length;
      const avgComplianceScore = deptEmployees.reduce((sum, e) => sum + e.compliance_score, 0) / deptEmployees.length;

      const complianceDistribution = {
        compliant: deptEmployees.filter(e => e.thai_labor_compliance_status === 'compliant').length,
        at_risk: deptEmployees.filter(e => e.thai_labor_compliance_status === 'at_risk').length,
        non_compliant: deptEmployees.filter(e => e.thai_labor_compliance_status === 'non_compliant').length
      };

      const totalFinancialForecast = deptEmployees.reduce((sum, e) => sum + e.financial_liability_forecast, 0);

      const deptMetric: YearEndDepartmentMetrics = {
        department_id: dept.id,
        department_name_th: dept.name_th,
        department_name_en: dept.name_en,
        total_employees: deptEmployees.length,
        avg_annual_utilization_rate: parseFloat(avgUtilizationRate.toFixed(1)),
        compliance_distribution: complianceDistribution,
        avg_compliance_score: parseFloat(avgComplianceScore.toFixed(1)),
        total_financial_forecast: parseFloat(totalFinancialForecast.toFixed(2)),
        compliance_ranking: 0 // Will be calculated later
      };

      departmentMetrics.push(deptMetric);
    }

    // Sort departments by compliance score and assign rankings
    departmentMetrics.sort((a, b) => b.avg_compliance_score - a.avg_compliance_score);
    departmentMetrics.forEach((dept, index) => {
      dept.compliance_ranking = index + 1;
    });

    // Calculate department rankings for employees
    employeeMetrics.forEach(emp => {
      // Find the employee's department by looking them up
      const empRecord = employees.find(employeeRecord => employeeRecord.id === emp.employee_id);
      const deptId = empRecord?.department_id;
      const dept = departmentMetrics.find(d => d.department_id === deptId);
      emp.department_compliance_ranking = dept?.compliance_ranking || 0;
    });

    // Calculate compliance summary
    const complianceCounts = {
      compliant_count: employeeMetrics.filter(e => e.thai_labor_compliance_status === 'compliant').length,
      at_risk_count: employeeMetrics.filter(e => e.thai_labor_compliance_status === 'at_risk').length,
      non_compliant_count: employeeMetrics.filter(e => e.thai_labor_compliance_status === 'non_compliant').length,
      compliance_rate: 0
    };

    complianceCounts.compliance_rate = employeeMetrics.length > 0
      ? parseFloat(((complianceCounts.compliant_count / employeeMetrics.length) * 100).toFixed(1))
      : 0;

    // Identify urgent actions needed
    const urgentEmployees = employeeMetrics
      .filter(e => e.urgency_level === 'critical' || e.urgency_level === 'high')
      .slice(0, 10)
      .map(e => `${e.employee_code} - ${e.employee_name_th}`);

    const overallUtilizationRate = allUtilizationRates.length > 0
      ? allUtilizationRates.reduce((sum, rate) => sum + rate, 0) / allUtilizationRates.length
      : 0;

    const overallComplianceScore = employeeMetrics.length > 0
      ? employeeMetrics.reduce((sum, e) => sum + e.compliance_score, 0) / employeeMetrics.length
      : 0;

    const totalFinancialForecast = employeeMetrics.reduce((sum, e) => sum + e.financial_liability_forecast, 0);

    const report: YearEndPlanningReport = {
      company_metrics: {
        total_employees: employeeMetrics.length,
        total_departments: departmentMetrics.length,
        days_until_year_end: daysUntilYearEnd,
        overall_compliance_score: parseFloat(overallComplianceScore.toFixed(1)),
        avg_annual_utilization_rate: parseFloat(overallUtilizationRate.toFixed(1)),
        total_financial_forecast: parseFloat(totalFinancialForecast.toFixed(2))
      },
      employees: employeeMetrics,
      departments: departmentMetrics,
      compliance_summary: complianceCounts,
      urgent_actions_needed: complianceCounts.non_compliant_count + complianceCounts.at_risk_count,
      employees_requiring_immediate_attention: urgentEmployees
    };

    return successResponse({
      report,
      generated_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Year-end planning report error:', error);
    return errorResponse(error.message || 'Failed to generate year-end planning report', 500);
  }
};

export const handler: Handler = requireAuth(leaveBalanceYearEndReport);