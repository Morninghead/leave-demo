// netlify/functions/admin-sync-all-balances.ts

import { Handler } from '@netlify/functions';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { syncAllEmployeeBalances } from './utils/sync-all-balances';

/**
 * Admin function to manually sync leave balances for all employees
 * This ensures all employees have balances for all active leave policies
 */
const syncAllBalances = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;

  // Only HR, Admin, and Dev can sync balances
  if (!userRole || !['hr', 'admin', 'dev'].includes(userRole)) {
    return errorResponse('Unauthorized. HR/Admin/Dev only.', 403);
  }

  try {
    const { year } = JSON.parse(event.body || '{}');

    if (!year) {
      return errorResponse('Missing year in request body', 400);
    }

    console.log('=== ADMIN: SYNC ALL EMPLOYEE BALANCES ===');
    console.log('Year:', year);
    console.log('Requested by:', userRole);

    // Sync balances for all employees
    const result = await syncAllEmployeeBalances(year);

    return successResponse({
      message: `Successfully synced leave balances for all employees for year ${year}`,
      year,
      employees_processed: result.employeesProcessed,
      balances_created: result.balancesCreated,
      balances_updated: result.balancesUpdated,
      total_operations: result.balancesCreated + result.balancesUpdated,
    });

  } catch (error: any) {
    console.error('Admin sync all balances error:', error);
    return errorResponse(error.message || 'Failed to sync balances', 500);
  }
};

export const handler: Handler = requireAuth(syncAllBalances);
