import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { ensureLeaveBalances } from './utils/leave-balance-helper';
import bcrypt from 'bcryptjs';

const createEmployee = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const userRole = event.user?.role;
  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      employee_code,
      scan_code,
      first_name_th,
      last_name_th,
      first_name_en,
      last_name_en,
      email,
      phone_number,
      department_id,
      position_th,
      position_en,
      role,
      birth_date,
      hire_date,
      national_id,
      address_th,
      address_en,
      emergency_contact_name,
      emergency_contact_phone,
    } = body;

    // ============================================================================
    // Validate 8 REQUIRED fields (NOT NULL in database)
    // ============================================================================
    const missingFields = [];

    if (!employee_code) missingFields.push('employee_code');
    if (!scan_code) missingFields.push('scan_code');
    if (!national_id) missingFields.push('national_id');
    if (!first_name_th) missingFields.push('first_name_th');
    if (!last_name_th) missingFields.push('last_name_th');
    if (!first_name_en) missingFields.push('first_name_en');
    if (!last_name_en) missingFields.push('last_name_en');
    if (!hire_date) missingFields.push('hire_date');

    if (missingFields.length > 0) {
      return errorResponse(`Required fields are missing: ${missingFields.join(', ')}`, 400);
    }

    // ============================================================================
    // Check for duplicates
    // ============================================================================

    // ตรวจสอบ email ซ้ำ (ถ้ามี email)
    if (email) {
      const checkEmailSql = `SELECT id FROM employees WHERE email = $1`;
      const existingEmail = await query(checkEmailSql, [email]);
      if (existingEmail.length > 0) {
        return errorResponse('Email already exists', 400);
      }
    }

    // ตรวจสอบ employee_code ซ้ำ
    const checkCodeSql = `SELECT id FROM employees WHERE employee_code = $1`;
    const existingCode = await query(checkCodeSql, [employee_code]);
    if (existingCode.length > 0) {
      return errorResponse('Employee code already exists', 400);
    }

    // ตรวจสอบ national_id ซ้ำ
    const checkNationalIdSql = `SELECT id FROM employees WHERE national_id = $1`;
    const existingNationalId = await query(checkNationalIdSql, [national_id]);
    if (existingNationalId.length > 0) {
      return errorResponse('National ID already exists', 400);
    }

    // สร้างรหัสผ่านเริ่มต้น (employee_code)
    const defaultPassword = employee_code;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Insert employee
    const insertSql = `
      INSERT INTO employees (
        employee_code,
        scan_code,
        national_id,
        first_name_th,
        last_name_th,
        first_name_en,
        last_name_en,
        hire_date,
        email,
        phone_number,
        department_id,
        position_th,
        position_en,
        role,
        birth_date,
        address_th,
        address_en,
        emergency_contact_name,
        emergency_contact_phone,
        password_hash,
        must_change_password,
        is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, true, true
      ) RETURNING *
    `;

    const params = [
      employee_code,                          // NOT NULL
      scan_code,                              // NOT NULL
      national_id,                            // NOT NULL
      first_name_th,                          // NOT NULL
      last_name_th,                           // NOT NULL
      first_name_en,                          // NOT NULL
      last_name_en,                           // NOT NULL
      hire_date,                              // NOT NULL
      email || null,                          // NULL OK
      phone_number || null,                   // NULL OK
      department_id || null,                  // NULL OK
      position_th || null,                    // NULL OK
      position_en || null,                    // NULL OK
      role || 'employee',                     // DEFAULT 'employee'
      birth_date || null,                     // NULL OK
      address_th || null,                     // NULL OK
      address_en || null,                     // NULL OK
      emergency_contact_name || null,         // NULL OK
      emergency_contact_phone || null,        // NULL OK
      hashedPassword,                         // Will be NOT NULL
    ];

    const result = await query(insertSql, params);
    const employeeId = result[0].id;
    const employeeCode = result[0].employee_code;

    // ============================================================================
    // ✅ WORLD-CLASS HRM: Create leave balances using proper calculation
    // ============================================================================
    // Uses Thailand labor law compliance:
    // - 120-day probation period before annual leave entitlement
    // - Pro-rata calculation based on hire date
    // - Reads from leave_policies table (not hardcoded)
    // - Handles all leave types dynamically
    // ============================================================================
    const currentYear = new Date().getFullYear();

    try {
      await ensureLeaveBalances(employeeId, currentYear);
      console.log(`✅ [CREATE EMPLOYEE] Leave balances created for ${employeeCode} (year: ${currentYear})`);
    } catch (balanceError: any) {
      console.error(`❌ [CREATE EMPLOYEE] Failed to create leave balances for ${employeeCode}:`, balanceError);
      // Don't fail the entire employee creation, but log the error
      // HR can manually sync balances later if needed
    }

    // Fetch created balances for verification and response
    const balanceCheck = await query(
      `SELECT
        lt.code,
        lt.name_en,
        lt.name_th,
        lb.total_days,
        lb.probation_end_date,
        lb.is_probation_complete,
        lb.pro_rata_days
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = $1 AND lb.year = $2
       ORDER BY lt.code`,
      [employeeId, currentYear]
    );

    console.log(`📊 [CREATE EMPLOYEE] Created ${balanceCheck.length} leave balances for ${employeeCode}:`);
    balanceCheck.forEach(b => {
      const probationStatus = b.is_probation_complete
        ? 'complete'
        : `pending until ${b.probation_end_date || 'N/A'}`;
      console.log(`   - ${b.code}: ${b.total_days} days (probation: ${probationStatus})`);
    });

    return successResponse({
      employee: result[0],
      leaveBalances: balanceCheck,
      message: 'Employee created successfully with leave balances',
    });
  } catch (error: any) {
    console.error('Create employee error:', error);
    return errorResponse(error.message || 'Failed to create employee', 500);
  }
};

export const handler: Handler = requireAuth(createEmployee);
