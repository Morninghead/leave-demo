// netlify/functions/utils/leave-balance-recalculator.ts
import { logger } from './logger';

import { query } from './db';
import { calculateAnnualLeaveEntitlement, getProbationStatus } from './probation-calculator';

/**
 * RECALCULATES leave balances for an employee for a given year
 * Unlike ensureLeaveBalances(), this ALWAYS recalculates even if balances exist
 * This is needed to fix employees with incorrect zero balances
 *
 * @param employeeId - The employee ID
 * @param year - The year for which to recalculate balances
 * @param forceUpdate - If true, updates existing balances; if false, only creates missing ones
 * @returns Promise<void>
 */
export async function recalculateLeaveBalances(
  employeeId: string,
  year: number,
  forceUpdate: boolean = true
): Promise<void> {
  logger.log(`🔄 Recalculating leave balances for employee ${employeeId}, year ${year} (force: ${forceUpdate})`);

  // Get employee data for probation calculation
  const employeeResult = await query(
    'SELECT id, employee_code, hire_date, first_name, last_name FROM employees WHERE id = $1',
    [employeeId]
  );

  if (employeeResult.length === 0) {
    logger.error(`❌ Employee ${employeeId} not found`);
    return;
  }

  const employee = employeeResult[0];
  logger.log(`👤 Employee: ${employee.employee_code} - ${employee.first_name} ${employee.last_name}`);
  logger.log(`📅 Hire date: ${employee.hire_date}`);

  // Get active leave policies for the year
  const policiesSql = `
    SELECT
      lp.leave_type_id,
      lp.default_days,
      lt.id as type_id,
      lt.code,
      lt.name_th,
      lt.name_en
    FROM leave_policies lp
    JOIN leave_types lt ON lp.leave_type_id = lt.id
    WHERE lp.year = $1
      AND lp.is_active = true
      AND lt.is_active = true
    ORDER BY lt.code ASC
  `;

  const policies = await query(policiesSql, [year]);

  if (policies.length === 0) {
    logger.warn(`⚠️ No active leave policies found for year ${year}`);
    return;
  }

  logger.log(`📋 Found ${policies.length} active leave policies`);

  let updatedCount = 0;
  let createdCount = 0;

  // Recalculate balances from policies with probation support
  for (const policy of policies) {
    const probationStatus = getProbationStatus(employee);

    // Calculate annual leave entitlement based on probation
    let totalDays = policy.default_days;
    let proRataMonths = 0;
    let proRataDays = 0;

    if (policy.code === 'ANNUAL') {
      // Use Thailand probation-based calculation for annual leave
      const entitlement = calculateAnnualLeaveEntitlement(
        employee,
        {
          annual_leave_after_probation: 6, // Thailand standard
          probation_days: 120, // Thailand: 120 days probation (use after day 119)
        },
        year
      );

      totalDays = entitlement.entitlementDays;
      proRataMonths = entitlement.monthsWorked;
      proRataDays = entitlement.entitlementDays;

      logger.log(`  ├─ [${policy.code}] Probation: ${probationStatus.isProbationComplete ? 'Complete ✅' : 'In Progress ⏳'}`);
      logger.log(`  ├─ [${policy.code}] Months worked: ${proRataMonths}`);
      logger.log(`  └─ [${policy.code}] Calculated days: ${totalDays}`);
    } else {
      logger.log(`  └─ [${policy.code}] Default days: ${totalDays}`);
    }

    // Check if balance already exists
    const existingBalanceResult = await query(
      `SELECT id, total_days, used_days, pending_days
       FROM leave_balances
       WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [employeeId, policy.leave_type_id, year]
    );

    const balanceExists = existingBalanceResult.length > 0;

    if (balanceExists && !forceUpdate) {
      logger.log(`  ⏭️  [${policy.code}] Balance exists, skipping (force=false)`);
      continue;
    }

    // Get used_days and pending_days from existing balance if it exists
    const usedDays = balanceExists ? existingBalanceResult[0].used_days : 0;
    const pendingDays = balanceExists ? existingBalanceResult[0].pending_days : 0;
    const remainingDays = totalDays - usedDays - pendingDays;

    const upsertSql = `
      INSERT INTO leave_balances (
        employee_id,
        leave_type_id,
        year,
        total_days,
        used_days,
        pending_days,
        remaining_days,
        probation_end_date,
        is_probation_complete,
        pro_rata_months,
        pro_rata_days,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET
        total_days = EXCLUDED.total_days,
        remaining_days = EXCLUDED.total_days - leave_balances.used_days - leave_balances.pending_days,
        probation_end_date = EXCLUDED.probation_end_date,
        is_probation_complete = EXCLUDED.is_probation_complete,
        pro_rata_months = EXCLUDED.pro_rata_months,
        pro_rata_days = EXCLUDED.pro_rata_days,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const upsertResult = await query(upsertSql, [
        employeeId,
        policy.leave_type_id,
        year,
        totalDays,
        usedDays,
        pendingDays,
        remainingDays,
        probationStatus.probationEndDate,
        probationStatus.isProbationComplete,
        proRataMonths,
        proRataDays
      ]);

      if (upsertResult.length > 0) {
        if (balanceExists) {
          const oldTotal = existingBalanceResult[0].total_days;
          logger.log(`  ✅ [${policy.code}] Updated: ${oldTotal} → ${totalDays} days (used: ${usedDays}, remaining: ${remainingDays})`);
          updatedCount++;
        } else {
          logger.log(`  ✅ [${policy.code}] Created: ${totalDays} days (remaining: ${remainingDays})`);
          createdCount++;
        }
      }
    } catch (err: any) {
      logger.error(`  ❌ [${policy.code}] Failed:`, err.message);
    }
  }

  logger.log(`✅ Recalculation complete: ${createdCount} created, ${updatedCount} updated`);
}

/**
 * Recalculates balances for ALL active employees
 * Use this to fix all employees with incorrect balances
 *
 * @param year - The year to recalculate
 * @returns Promise with statistics
 */
export async function recalculateAllEmployeeBalances(year: number): Promise<{
  totalEmployees: number;
  successCount: number;
  errorCount: number;
  errors: { employee_code: string; error: string }[];
}> {
  logger.log(`🔄 Recalculating ALL employee balances for year ${year}`);

  const employees = await query<{ id: string; employee_code: string; hire_date: string }>(
    `SELECT id, employee_code, hire_date
     FROM employees
     WHERE is_active = true
     ORDER BY employee_code`
  );

  logger.log(`📊 Found ${employees.length} active employees`);

  let successCount = 0;
  let errorCount = 0;
  const errors: { employee_code: string; error: string }[] = [];

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];

    try {
      await recalculateLeaveBalances(employee.id, year, true);
      successCount++;

      if ((i + 1) % 10 === 0) {
        logger.log(`  Progress: ${i + 1}/${employees.length} employees processed`);
      }
    } catch (error: any) {
      errorCount++;
      errors.push({
        employee_code: employee.employee_code,
        error: error.message || 'Unknown error'
      });
      logger.error(`❌ Failed to recalculate ${employee.employee_code}:`, error.message);
    }
  }

  logger.log(`✅ Recalculation complete!`);
  logger.log(`   Total: ${employees.length}`);
  logger.log(`   Success: ${successCount}`);
  logger.log(`   Errors: ${errorCount}`);

  return {
    totalEmployees: employees.length,
    successCount,
    errorCount,
    errors
  };
}
