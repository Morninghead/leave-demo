import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { successResponse, errorResponse } from './utils/response';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed. Use POST to force email nullable.', 405);
  }

  try {
    console.log('🔧 Forcefully making email and birth_date columns nullable...');

    // Step 1: Force email column to be nullable
    console.log('📊 Making email column nullable...');
    await query(`ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;`);
    console.log('✅ Email column forced to be nullable');

    // Step 2: Force birth_date column to be nullable
    console.log('📊 Making birth_date column nullable...');
    await query(`ALTER TABLE employees ALTER COLUMN birth_date DROP NOT NULL;`);
    console.log('✅ Birth_date column forced to be nullable');

    // Step 3: Also make sure other optional fields are nullable
    const optionalFields = [
      'phone_number', 'address_th', 'address_en', 'department_id',
      'position_th', 'position_en', 'emergency_contact_name', 'emergency_contact_phone'
    ];

    for (const field of optionalFields) {
      try {
        await query(`ALTER TABLE employees ALTER COLUMN ${field} DROP NOT NULL;`);
        console.log(`✅ Made ${field} column nullable`);
      } catch (error) {
        console.log(`ℹ️  ${field} column is already nullable or doesn't exist`);
      }
    }

    // Step 4: Verify all changes
    const verificationColumns = await query(`
      SELECT
        column_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'employees'
      AND column_name IN ('email', 'birth_date', 'phone_number', 'address_th', 'department_id', 'position_th', 'position_en', 'emergency_contact_name', 'emergency_contact_phone')
      ORDER BY column_name
    `);

    console.log('📊 Verification results:');
    verificationColumns.forEach(col => {
      const status = col.is_nullable === 'YES' ? '✅ NULLABLE' : '❌ NOT NULL';
      console.log(`  ${col.column_name}: ${status}`);
    });

    // Count of nullable vs non-nullable optional fields
    const nullableCount = verificationColumns.filter(c => c.is_nullable === 'YES').length;
    const totalCount = verificationColumns.length;

    return successResponse({
      message: 'Forcefully made email and other optional fields nullable',
      success: true,
      columns_verified: totalCount,
      columns_nullable: nullableCount,
      verification_results: verificationColumns
    });

  } catch (error) {
    console.error('❌ Failed to force columns nullable:', error);
    return errorResponse(`Failed to force columns nullable: ${error.message}`, 500);
  }
};