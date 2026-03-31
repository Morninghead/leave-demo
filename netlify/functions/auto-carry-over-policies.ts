import { Handler, schedule } from '@netlify/functions';
import { query } from './utils/db';
import { syncAllEmployeeBalances } from './utils/sync-all-balances';

/**
 * Auto Carry Over Leave Policies
 * 
 * This function runs automatically at the START OF EACH YEAR (January 1st, 00:05 AM)
 * It checks if policies exist for the new year:
 * - If NO policies exist → Copy from previous year
 * - If policies ALREADY exist → Do nothing
 * 
 * This ensures leave policies are always available for the new year.
 */

const autoCarryOverPolicies = async () => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    console.log('=== AUTO CARRY OVER LEAVE POLICIES ===');
    console.log(`Current Year: ${currentYear}`);
    console.log(`Previous Year: ${previousYear}`);
    console.log(`Time: ${new Date().toISOString()}`);

    try {
        // Step 1: Check if policies exist for the current year
        const checkResult = await query(
            `SELECT COUNT(*) as count FROM leave_policies WHERE year = $1::integer`,
            [currentYear]
        );

        const existingCount = parseInt(checkResult[0].count);
        console.log(`📊 Existing policies for ${currentYear}: ${existingCount}`);

        // Step 2: If policies already exist, skip carry over
        if (existingCount > 0) {
            console.log(`✅ Policies for ${currentYear} already exist. Skipping carry over.`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: `Policies for ${currentYear} already exist (${existingCount} policies). No action needed.`,
                    carried_over: false,
                    existing_count: existingCount
                })
            };
        }

        // Step 3: Check if previous year has policies to copy
        const prevYearCheck = await query(
            `SELECT COUNT(*) as count FROM leave_policies WHERE year = $1::integer AND is_active = true`,
            [previousYear]
        );

        const prevYearCount = parseInt(prevYearCheck[0].count);
        console.log(`📊 Policies from ${previousYear} to copy: ${prevYearCount}`);

        if (prevYearCount === 0) {
            console.log(`⚠️ No policies found for ${previousYear}. Cannot carry over.`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: false,
                    message: `No policies found for ${previousYear} to copy from.`,
                    carried_over: false
                })
            };
        }

        // Step 4: Copy policies from previous year to current year
        console.log(`🔄 Copying ${prevYearCount} policies from ${previousYear} to ${currentYear}...`);

        const copyResult = await query(
            `INSERT INTO leave_policies (
        leave_type_id,
        year,
        default_days,
        effective_from,
        notes,
        is_active,
        created_at,
        updated_at
      )
      SELECT 
        leave_type_id,
        $1::integer,
        default_days,
        $2,
        'Auto carried over from year ' || $3::text,
        true,
        NOW(),
        NOW()
      FROM leave_policies
      WHERE year = $3::integer
        AND is_active = true
      RETURNING *`,
            [currentYear, `${currentYear}-01-01`, previousYear]
        );

        console.log(`✅ Created ${copyResult.length} policies for ${currentYear}`);

        // Step 5: Sync employee balances for the new year
        console.log(`🔄 Syncing employee balances for ${currentYear}...`);
        const syncResult = await syncAllEmployeeBalances(currentYear);

        console.log(`✅ Synced balances: ${syncResult.employeesProcessed} employees, ${syncResult.balancesCreated} created, ${syncResult.balancesUpdated} updated`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Successfully carried over ${copyResult.length} policies from ${previousYear} to ${currentYear}`,
                carried_over: true,
                policies_created: copyResult.length,
                sync_result: syncResult
            })
        };

    } catch (error: any) {
        console.error('❌ Auto carry over error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Failed to auto carry over policies'
            })
        };
    }
};

// Schedule to run at 00:05 AM on January 1st every year
// Cron: minute hour day-of-month month day-of-week
// "5 0 1 1 *" = At 00:05 on January 1st
export const handler: Handler = schedule("5 0 1 1 *", autoCarryOverPolicies);

// Also export a manual trigger version for testing
export { autoCarryOverPolicies };
