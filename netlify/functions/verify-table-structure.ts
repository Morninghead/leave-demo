// Verify database table structure
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { requireAuth } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const verifyStructure = async (event: any) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  // Only allow admin users
  const userRole = event.user?.role;
  if (userRole !== 'admin' && userRole !== 'hr') {
    return errorResponse('Unauthorized: Admin or HR role required', 403);
  }

  try {
    // Check employees table structure
    const employeesColumns = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'employees'
      ORDER BY ordinal_position
    `;

    // Check warning_notices table structure
    const warningNoticesColumns = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'warning_notices'
      ORDER BY ordinal_position
    `;

    // Check warning_audit_logs table structure
    const auditLogsColumns = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'warning_audit_logs'
      ORDER BY ordinal_position
    `;

    // Check foreign key constraints
    const foreignKeys = await sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name = 'warning_notices' OR tc.table_name = 'warning_audit_logs')
      ORDER BY tc.table_name, kcu.column_name
    `;

    return successResponse({
      employees: {
        columns: employeesColumns,
        id_type: employeesColumns.find((c: any) => c.column_name === 'id')?.data_type
      },
      warning_notices: {
        columns: warningNoticesColumns,
        employee_id_type: warningNoticesColumns.find((c: any) => c.column_name === 'employee_id')?.data_type
      },
      warning_audit_logs: {
        columns: auditLogsColumns,
        performed_by_type: auditLogsColumns.find((c: any) => c.column_name === 'performed_by')?.data_type
      },
      foreign_keys: foreignKeys
    });

  } catch (error: any) {
    console.error('❌ Verification failed:', error);
    return errorResponse(error.message || 'Verification failed', 500);
  }
};

export const handler: Handler = requireAuth(verifyStructure);
