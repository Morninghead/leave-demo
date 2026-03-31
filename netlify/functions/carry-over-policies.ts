import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { syncAllEmployeeBalances } from './utils/sync-all-balances';

/**
 * Manual Carry Over Leave Policies API
 * 
 * POST /carry-over-policies
 * Body: { target_year: number, source_year: number }
 * 
 * This allows HR/Admin to manually trigger policy carry over.
 * It will ONLY carry over if NO policies exist for the target year.
 */

const carryOverPolicies = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    const userId = event.user?.userId;
    const userRole = event.user?.role;

    // Only HR and Admin can trigger carry over
    if (!['hr', 'admin'].includes(userRole || '')) {
        return errorResponse('Unauthorized. HR or Admin only.', 403);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const targetYear = body.target_year || new Date().getFullYear();
        const sourceYear = body.source_year || targetYear - 1;

        console.log('=== MANUAL CARRY OVER LEAVE POLICIES ===');
        console.log(`Target Year: ${targetYear}`);
        console.log(`Source Year: ${sourceYear}`);
        console.log(`Triggered by: ${userId}`);

        // Step 1: Check if policies ALREADY exist for target year
        const checkResult = await query(
            `SELECT COUNT(*) as count FROM leave_policies WHERE year = $1::integer`,
            [targetYear]
        );

        const existingCount = parseInt(checkResult[0].count);
        console.log(`📊 Existing policies for ${targetYear}: ${existingCount}`);

        // Step 2: If policies already exist, return error
        if (existingCount > 0) {
            console.log(`❌ Policies for ${targetYear} already exist. Cannot carry over.`);
            return errorResponse(
                `นโยบายสำหรับปี ${targetYear} มีอยู่แล้ว (${existingCount} รายการ) ไม่สามารถ carry over ได้`,
                400
            );
        }

        // Step 3: Check if source year has policies to copy
        const sourceCheck = await query(
            `SELECT COUNT(*) as count FROM leave_policies WHERE year = $1::integer AND is_active = true`,
            [sourceYear]
        );

        const sourceCount = parseInt(sourceCheck[0].count);
        console.log(`📊 Policies from ${sourceYear} to copy: ${sourceCount}`);

        if (sourceCount === 0) {
            return errorResponse(
                `ไม่พบนโยบายสำหรับปี ${sourceYear} ที่จะคัดลอก`,
                400
            );
        }

        // Step 4: Copy policies from source year to target year
        console.log(`🔄 Copying ${sourceCount} policies from ${sourceYear} to ${targetYear}...`);

        const copyResult = await query(
            `INSERT INTO leave_policies (
        leave_type_id,
        year,
        default_days,
        effective_from,
        notes,
        is_active,
        created_by,
        created_at,
        updated_at
      )
      SELECT 
        leave_type_id,
        $1::integer,
        default_days,
        $2,
        'Carried over from year ' || $3::text || ' by manual trigger',
        true,
        $4,
        NOW(),
        NOW()
      FROM leave_policies
      WHERE year = $3::integer
        AND is_active = true
      RETURNING *`,
            [targetYear, `${targetYear}-01-01`, sourceYear, userId]
        );

        console.log(`✅ Created ${copyResult.length} policies for ${targetYear}`);

        // Step 5: Sync employee balances for the target year
        console.log(`🔄 Syncing employee balances for ${targetYear}...`);
        const syncResult = await syncAllEmployeeBalances(targetYear);

        console.log(`✅ Synced balances: ${syncResult.employeesProcessed} employees, ${syncResult.balancesCreated} created, ${syncResult.balancesUpdated} updated`);

        return successResponse({
            message: `สร้างนโยบาย ${copyResult.length} รายการสำหรับปี ${targetYear} จากปี ${sourceYear} สำเร็จ`,
            target_year: targetYear,
            source_year: sourceYear,
            policies_created: copyResult.length,
            sync_result: syncResult
        });

    } catch (error: any) {
        console.error('❌ Carry over error:', error);
        return errorResponse(error.message || 'Failed to carry over policies', 500);
    }
};

export const handler: Handler = requireAuth(carryOverPolicies);
