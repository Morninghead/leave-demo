// netlify/functions/utils/leave-balance-helper.ts
import { logger } from './logger';

import { query } from './db';
import { calculateAnnualLeaveEntitlement, getProbationStatus } from './probation-calculator';

/**
 * Ensures that leave balances exist for an employee for a given year
 * If they don't exist, creates them from leave_policies
 *
 * @param employeeId - The employee ID
 * @param year - The year for which to ensure balances
 * @returns Promise<void>
 */
export async function ensureLeaveBalances(employeeId: string, year: number): Promise<void> {
  logger.log(`🔍 Ensuring leave balances for employee ${employeeId}, year ${year}`);

  // Check if balances already exist (for logging only - we'll update them anyway)
  const existingBalancesSql = `
    SELECT COUNT(*) as count
    FROM leave_balances
    WHERE employee_id = $1 AND year = $2
  `;
  const existingResult = await query(existingBalancesSql, [employeeId, year]);
  const existingCount = parseInt(existingResult[0].count);

  if (existingCount > 0) {
    logger.log(`🔄 Employee has ${existingCount} existing balance(s) - will recalculate to ensure correctness`);
  } else {
    logger.log(`📝 No leave balances found - will create from policies`);
  }

  // Get active leave policies for the year
  const policiesSql = `
    SELECT
      lp.leave_type_id,
      lp.default_days,
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

  logger.log(`Found ${policies.length} active leave policies`);

  let createdCount = 0;
  let updatedCount = 0;

  // Create or update leave balances from policies with probation support
  for (const policy of policies) {
    // Get employee data for probation calculation
    const employeeResult = await query(
      'SELECT hire_date, TO_CHAR(hire_date, \'YYYY-MM-DD\') as hire_date_string FROM employees WHERE id = $1',
      [employeeId]
    );

    if (employeeResult.length === 0) {
      logger.error(`❌ Employee ${employeeId} not found for balance creation`);
      continue;
    }

    const employee = employeeResult[0];
    // Use the string version for calculations
    const employeeForCalc = {
      hire_date: employee.hire_date_string || employee.hire_date
    };
    const probationStatus = getProbationStatus(employeeForCalc);

    // Calculate annual leave entitlement based on probation
    let totalDays = policy.default_days;
    let proRataMonths = 0;
    let proRataDays = 0;

    // Check if this is annual/vacation leave (VAC or ANNUAL code)
    if (policy.code === 'ANNUAL' || policy.code === 'VAC') {
      // Use Thailand probation-based calculation for annual leave
      const entitlement = calculateAnnualLeaveEntitlement(
        employeeForCalc,
        {
          annual_leave_after_probation: policy.annual_leave_after_probation || 6,
          probation_days: policy.probation_days || 120, // Thailand: 120 days probation
          minimum_entitlement_date: policy.minimum_entitlement_date
        },
        year
      );

      totalDays = entitlement.entitlementDays;
      proRataMonths = entitlement.monthsWorked;
      proRataDays = entitlement.entitlementDays;

      logger.log(`🔍 [PROBATION] Employee ${employeeId}: ${probationStatus.isProbationComplete ? 'Completed' : 'In Progress'} probation`);
      logger.log(`🔍 [PROBATION] Annual leave entitlement: ${totalDays} days (${proRataMonths} months worked)`);
    }

    // Check if this balance already exists (to track creates vs updates)
    const existingBalanceCheck = await query(
      `SELECT id FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [employeeId, policy.leave_type_id, year]
    );
    const isUpdate = existingBalanceCheck.length > 0;

    const insertSql = `
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
      VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET
        total_days = EXCLUDED.total_days,
        probation_end_date = EXCLUDED.probation_end_date,
        is_probation_complete = EXCLUDED.is_probation_complete,
        pro_rata_months = EXCLUDED.pro_rata_months,
        pro_rata_days = EXCLUDED.pro_rata_days,
        remaining_days = EXCLUDED.total_days - leave_balances.used_days - leave_balances.pending_days,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const insertResult = await query(insertSql, [
        employeeId,
        policy.leave_type_id,
        year,
        totalDays,
        totalDays, // remaining_days = total_days initially (for new records)
        probationStatus.probationEndDate,
        probationStatus.isProbationComplete,
        proRataMonths,
        proRataDays
      ]);

      if (insertResult.length > 0) {
        if (isUpdate) {
          logger.log(`✅ Updated balance for ${policy.code}: ${totalDays} days (probation: ${probationStatus.isProbationComplete ? 'Yes' : 'No'})`);
          updatedCount++;
        } else {
          logger.log(`✅ Created balance for ${policy.code}: ${totalDays} days (probation: ${probationStatus.isProbationComplete ? 'Yes' : 'No'})`);
          createdCount++;
        }
      }
    } catch (err: any) {
      logger.error(`❌ Failed to ${isUpdate ? 'update' : 'create'} balance for ${policy.code}:`, err.message);
    }
  }

  if (updatedCount > 0) {
    logger.log(`✅ Updated ${updatedCount} leave balance(s) for employee ${employeeId}`);
  }
  if (createdCount > 0) {
    logger.log(`✅ Created ${createdCount} leave balance(s) for employee ${employeeId}`);
  }
  if (updatedCount === 0 && createdCount === 0) {
    logger.log(`ℹ️ No balances were created or updated for employee ${employeeId}`);
  }
}

/**
 * Gets the leave balance for a specific employee, leave type, and year
 * Ensures the balance exists before returning
 *
 * @param employeeId - The employee ID
 * @param leaveTypeId - The leave type ID
 * @param year - The year
 * @returns The leave balance record or null if not found
 */
export async function getOrCreateLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number
): Promise<any | null> {
  // First, ensure balances exist for this employee/year
  await ensureLeaveBalances(employeeId, year);

  // Now fetch the specific balance
  const balanceResult = await query(
    `SELECT lb.*, lt.code as leave_type_code
     FROM leave_balances lb
     JOIN leave_types lt ON lb.leave_type_id = lt.id
     WHERE lb.employee_id = $1 AND lb.leave_type_id = $2 AND lb.year = $3`,
    [employeeId, leaveTypeId, year]
  );

  if (balanceResult.length > 0) {
    return balanceResult[0];
  }

  // 🛠️ FIX: If balance still doesn't exist, check if it's unpaid leave and create it manually
  logger.log(`⚠️ Balance not found for employee ${employeeId}, leave type ${leaveTypeId}, year ${year}`);

  // Get leave type info to check if it's unpaid
  const leaveTypeResult = await query(
    'SELECT code, name_en, name_th FROM leave_types WHERE id = $1',
    [leaveTypeId]
  );

  if (leaveTypeResult.length === 0) {
    logger.error(`❌ Leave type ${leaveTypeId} not found`);
    return null;
  }

  const leaveType = leaveTypeResult[0];

  // Check if there's a policy for this leave type to get default_days
  const policyResult = await query(
    'SELECT default_days FROM leave_policies WHERE leave_type_id = $1 AND year = $2 AND is_active = true',
    [leaveTypeId, year]
  );

  if (policyResult.length === 0) {
    logger.error(`❌ No active policy found for leave type ${leaveTypeId} for year ${year}`);
    return null;
  }

  const policy = policyResult[0];
  const defaultDays = parseFloat(policy.default_days || 0);
  const isUnlimitedLeave = defaultDays >= 999;

  logger.log(`🔍 Leave type check: ${leaveType.code} - ${leaveType.name_en} (UNLIMITED: ${isUnlimitedLeave}, default_days: ${defaultDays})`);

  if (isUnlimitedLeave) {
    logger.log(`💳 Creating manual unlimited leave balance for employee ${employeeId}`);

    // Create unlimited leave balance manually with policy default_days (999+)
    const createResult = await query(
      `INSERT INTO leave_balances (
        employee_id, leave_type_id, year, total_days, used_days, pending_days,
        remaining_days, accumulated_minutes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 0, 0, $4, $5, NOW(), NOW())
      RETURNING *`,
      [employeeId, leaveTypeId, year, defaultDays, defaultDays * 480]
    );

    if (createResult.length > 0) {
      const balance = createResult[0];
      balance.leave_type_code = leaveType.code;
      logger.log(`✅ Created unlimited leave balance: Total=${defaultDays}, Used=0, Remaining=${defaultDays}`);
      return balance;
    } else {
      logger.error(`❌ Failed to create unlimited leave balance`);
      return null;
    }
  }

  logger.log(`❌ Balance not found and leave type is not unlimited - cannot create balance manually`);
  return null;
}
