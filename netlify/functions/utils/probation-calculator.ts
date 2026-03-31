// netlify/functions/utils/probation-calculator.ts

/**
 * Probation-based annual leave calculation utilities
 * Implements Thailand labor law: 119-day probation period with 6 days annual leave after completion
 * User can use annual leave starting from day 120 (first day after probation)
 * Pro rata calculation with "more than half month" rounding rule (> 15 days = full month)
 */

/**
 * Calculate probation end date (119 days from hire date per Thailand labor law)
 * User can use annual leave starting from day 120
 * @param hireDate - Employee hire date (YYYY-MM-DD format)
 * @returns Probation end date (YYYY-MM-DD format)
 */
export function calculateProbationEndDate(hireDate: string): string {
  const hire = new Date(hireDate);
  const probationEnd = new Date(hire);
  probationEnd.setDate(hire.getDate() + 119);

  return probationEnd.toISOString().split('T')[0];
}

/**
 * Check if employee has completed probation
 * @param hireDate - Employee hire date
 * @param currentDate - Current date (defaults to today)
 * @returns True if probation is complete (119 days passed per Thailand labor law)
 * User can start using annual leave from day 120
 */
export function isProbationComplete(hireDate: string, currentDate?: string): boolean {
  const hire = new Date(hireDate);
  const current = currentDate ? new Date(currentDate) : new Date();
  const probationEnd = new Date(hire);
  probationEnd.setDate(hire.getDate() + 119);

  return current >= probationEnd;
}

/**
 * Calculate months worked between two dates for pro-rata calculation
 * Implements Thailand "more than half month" rule: > 15 days = full month
 * @param startDate - Start date (usually hire date or year start)
 * @param endDate - End date (usually year end)
 * @returns Number of months worked (partial months counted proportionally)
 */
export function calculateProRataMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let months = 0;
  let currentDate = new Date(start);

  while (currentDate < end) {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Calculate days in current month
    const daysInMonth = Math.min(
      end < nextMonth ? end.getDate() : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(),
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    );

    // Thailand pro rata rule: more than half month (> 15 days) = full month
    if (daysInMonth > 15) {
      months += 1;
    } else {
      months += daysInMonth / 30; // Proportional calculation for partial months
    }

    currentDate = nextMonth;
  }

  return Math.round(months * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate annual leave entitlement based on Thailand probation and pro-rata rules
 * Formula: (months worked / 12) * 6 days annual leave
 *
 * IMPORTANT: Annual leave starts accruing from DAY 1 of employment (not after probation)
 * This means employees earn leave from their hire date, but can only use it after probation
 *
 * Thailand Labor Law Standard: 6 days annual leave per year after 119 days probation
 * @param employee - Employee data with hire_date
 * @param policy - Leave policy (may contain custom values, but Thailand standard overrides)
 * @param year - Year to calculate for
 * @returns Calculated annual leave days with detailed breakdown
 */
export function calculateAnnualLeaveEntitlement(
  employee: { hire_date: string },
  policy: {
    annual_leave_after_probation?: number,
    probation_days?: number,
    minimum_entitlement_date?: string
  },
  year: number
): {
  entitlementDays: number,
  probationEndDate: string,
  entitlementDate: string,
  isProbationComplete: boolean,
  monthsWorked: number
} {
  const probationEndDate = calculateProbationEndDate(employee.hire_date);
  const isComplete = isProbationComplete(employee.hire_date);

  // Thailand: Calculate months worked in the calendar year from HIRE DATE (day 1)
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Calculate months from the later of: hire date or year start
  const hireDate = employee.hire_date.split('T')[0]; // Ensure YYYY-MM-DD format
  const calculationStart = hireDate > yearStart ? hireDate : yearStart;
  const monthsWorked = calculateProRataMonths(calculationStart, yearEnd);

  // Thailand pro-rata calculation: (months worked / 12) * annual_leave_after_probation
  // Use Thailand standard of 6 days per year unless custom policy specifies otherwise
  const annualLeaveDays = policy.annual_leave_after_probation || 6; // Default to Thailand standard
  const entitlementDays = (monthsWorked / 12) * annualLeaveDays;

  // Apply minimum entitlement date if specified
  let entitlementDate = isComplete ? probationEndDate : null;
  if (policy.minimum_entitlement_date && isComplete) {
    const minDate = new Date(policy.minimum_entitlement_date);
    if (minDate > new Date(probationEndDate)) {
      entitlementDate = policy.minimum_entitlement_date;
    }
  }

  return {
    entitlementDays: Math.round(entitlementDays * 100) / 100, // Round to 2 decimal places
    probationEndDate,
    entitlementDate: entitlementDate || probationEndDate,
    isProbationComplete: isComplete,
    monthsWorked: monthsWorked
  };
}

/**
 * Get probation status information for display
 * @param employee - Employee data with hire_date
 * @returns Probation status information for Thailand labor law compliance
 */
export function getProbationStatus(employee: { hire_date: string }) {
  const probationEndDate = calculateProbationEndDate(employee.hire_date);
  const isComplete = isProbationComplete(employee.hire_date);
  const hire = new Date(employee.hire_date);
  const today = new Date();

  // Calculate days remaining in probation
  const daysRemaining = Math.max(0, Math.ceil((new Date(probationEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    probationEndDate,
    isProbationComplete: isComplete,
    daysRemainingInProbation: isComplete ? 0 : daysRemaining,
    totalProbationDays: 120, // Thailand labor law: 120 days probation
    daysCompletedInProbation: isComplete ? 120 : Math.max(0, 120 - daysRemaining)
  };
}
