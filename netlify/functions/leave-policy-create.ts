import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { syncAllEmployeeBalances } from './utils/sync-all-balances';

const createLeavePolicies = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const userId = event.user?.userId;
  const userRole = event.user?.role;

  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Unauthorized. HR or Admin only.', 403);
  }

  try {
    const { year, copy_from_year } = JSON.parse(event.body || '{}');

    if (!year) {
      return errorResponse('Missing year', 400);
    }

    console.log('=== CREATE LEAVE POLICIES ===');
    console.log('Target year:', year);
    console.log('Copy from year:', copy_from_year);

    // ตรวจสอบว่ามี policies ของปีนั้นอยู่แล้วหรือไม่
    const checkSql = `
      SELECT COUNT(*) as count 
      FROM leave_policies 
      WHERE year = $1
    `;
    const checkResult = await query(checkSql, [year]);

    if (parseInt(checkResult[0].count) > 0) {
      return errorResponse(`Policies for year ${year} already exist`, 400);
    }

    // ถ้าระบุ copy_from_year ให้ copy จากปีนั้น
    if (copy_from_year) {
      const copySql = `
        INSERT INTO leave_policies (
          leave_type_id,
          year,
          default_days,
          effective_from,
          notes,
          created_by
        )
        SELECT 
          leave_type_id,
          $1,
          default_days,
          $2,
          'Copied from year ' || $3,
          $4
        FROM leave_policies
        WHERE year = $3
          AND is_active = true
        RETURNING *
      `;

      const result = await query(copySql, [
        year,
        `${year}-01-01`,
        copy_from_year,
        userId
      ]);

      console.log('✅ Created', result.length, 'policies');

      // Sync balances for ALL employees
      const syncResult = await syncAllEmployeeBalances(year);
      console.log(`✅ Synced balances: ${syncResult.employeesProcessed} employees, ${syncResult.balancesCreated} created, ${syncResult.balancesUpdated} updated`);

      return successResponse({
        leave_policies: result,
        message: `Created ${result.length} policies for year ${year}. Synced balances for ${syncResult.employeesProcessed} employees.`,
        sync_result: syncResult,
      });
    }

    // ถ้าไม่มี copy_from_year ให้สร้างใหม่จาก default
    const createSql = `
      INSERT INTO leave_policies (
        leave_type_id,
        year,
        default_days,
        effective_from,
        notes,
        created_by
      )
      SELECT 
        id,
        $1,
        CASE code
          WHEN 'ANNUAL' THEN 10
          WHEN 'BEREAVEMENT' THEN 3
          WHEN 'MARRIAGE' THEN 3
          WHEN 'MATERNITY' THEN 90
          WHEN 'PERSONAL' THEN 10
          WHEN 'SICK' THEN 30
          WHEN 'WORK_INJURY' THEN 999
          WHEN 'UNPAID' THEN 0
          ELSE 30
        END,
        $2,
        'Default policy for ' || $1,
        $3
      FROM leave_types
      WHERE is_active = true
      RETURNING *
    `;

    const result = await query(createSql, [year, `${year}-01-01`, userId]);

    console.log('✅ Created', result.length, 'policies');

    // Sync balances for ALL employees
    const syncResult = await syncAllEmployeeBalances(year);
    console.log(`✅ Synced balances: ${syncResult.employeesProcessed} employees, ${syncResult.balancesCreated} created, ${syncResult.balancesUpdated} updated`);

    return successResponse({
      leave_policies: result,
      message: `Created ${result.length} policies for year ${year}. Synced balances for ${syncResult.employeesProcessed} employees.`,
      sync_result: syncResult,
    });
  } catch (error: any) {
    console.error('Create leave policies error:', error);
    return errorResponse(error.message || 'Failed to create leave policies', 500);
  }
};

export const handler: Handler = requireAuth(createLeavePolicies);
