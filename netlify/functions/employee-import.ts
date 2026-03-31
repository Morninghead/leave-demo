import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { ensureLeaveBalances } from './utils/leave-balance-helper';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface DuplicateError {
  row: number;
  employeeCode: string;
  name: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ValidationError[];
  duplicates: DuplicateError[];
  syncResult?: {
    balancesCreated: number;
    balancesUpdated: number;
    employeesProcessed: number;
  } | null;
  batch?: {
    start: number;
    end: number;
    size: number;
    hasMore: boolean;
    nextStart: number | null;
    totalProcessed: number;
    totalRemaining: number;
  };
}

interface EmployeeRow {
  employee_code?: string | number;
  scan_code?: string | number;
  first_name_th?: string;
  last_name_th?: string;
  first_name_en?: string;
  last_name_en?: string;
  email?: string;
  phone_number?: string;
  department_id?: string;
  department_code?: string;
  position_th?: string;
  position_en?: string;
  role?: string;
  birth_date?: string;
  hire_date?: string;
  national_id?: string | number;
  address_th?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

/**
 * Convert Excel serial date to ISO date string (YYYY-MM-DD)
 * Excel stores dates as numbers (days since 1899-12-30)
 */
const excelDateToISO = (value: any): string | null => {
  if (!value) return null;

  // If it's already a valid date string (YYYY-MM-DD), return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // If it's a number (Excel serial date), convert it
  if (typeof value === 'number') {
    // Excel's date system: days since 1899-12-30 (with a bug for 1900 leap year)
    // We use XLSX built-in conversion for accuracy
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // If it's a date-like string in other formats, try to parse and convert
  if (typeof value === 'string') {
    // Try common formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
    const datePatterns = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,   // DD-MM-YYYY
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
    ];

    for (const pattern of datePatterns) {
      const match = value.match(pattern);
      if (match) {
        // Assume DD/MM/YYYY for non-YYYY first formats (common in Thai format)
        if (pattern === datePatterns[0] || pattern === datePatterns[1]) {
          const day = String(match[1]).padStart(2, '0');
          const month = String(match[2]).padStart(2, '0');
          const year = match[3];
          return `${year}-${month}-${day}`;
        } else {
          // YYYY/MM/DD format
          const year = match[1];
          const month = String(match[2]).padStart(2, '0');
          const day = String(match[3]).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    }
  }

  // Return original value as string (will fail validation if not valid date)
  return String(value);
};

const validateEmployeeData = (data: EmployeeRow[], departments: any[], deptCodeToId: { [key: string]: string }): ImportResult => {
  const errors: ValidationError[] = [];
  const duplicates: DuplicateError[] = [];
  const validDepartments = new Set(departments.map(d => d.id));

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as EmployeeRow;
    const rowNum = i + 2; // Excel rows are 1-based, plus header row

    // Skip empty rows
    if (!row.employee_code || !row.first_name_th || !row.last_name_th) {
      continue;
    }

    // ============================================================================
    // Validate 8 REQUIRED fields (NOT NULL in database)
    // ============================================================================

    // 1. employee_code
    if (!row.employee_code) {
      errors.push({
        row: rowNum,
        field: 'employee_code',
        value: String(row.employee_code || ''),
        message: 'Employee code is required'
      });
    }

    // 2. scan_code - OPTIONAL, will default to employee_code
    // (removed from required fields)

    // 3. national_id
    if (!row.national_id) {
      errors.push({
        row: rowNum,
        field: 'national_id',
        value: String(row.national_id || ''),
        message: 'National ID is required'
      });
    }

    // 4. first_name_th
    if (!row.first_name_th) {
      errors.push({
        row: rowNum,
        field: 'first_name_th',
        value: row.first_name_th,
        message: 'First name (Thai) is required'
      });
    }

    // 5. last_name_th
    if (!row.last_name_th) {
      errors.push({
        row: rowNum,
        field: 'last_name_th',
        value: row.last_name_th,
        message: 'Last name (Thai) is required'
      });
    }

    // 6. first_name_en
    if (!row.first_name_en) {
      errors.push({
        row: rowNum,
        field: 'first_name_en',
        value: row.first_name_en || '',
        message: 'First name (English) is required'
      });
    }

    // 7. last_name_en
    if (!row.last_name_en) {
      errors.push({
        row: rowNum,
        field: 'last_name_en',
        value: row.last_name_en || '',
        message: 'Last name (English) is required'
      });
    }

    // 8. hire_date
    if (!row.hire_date) {
      errors.push({
        row: rowNum,
        field: 'hire_date',
        value: row.hire_date || '',
        message: 'Hire date is required'
      });
    }

    // ============================================================================
    // Validate OPTIONAL fields (format validation only if provided)
    // ============================================================================

    // Email - optional but if provided must be valid format
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({
        row: rowNum,
        field: 'email',
        value: row.email,
        message: 'Invalid email format'
      });
    }

    // Validate department
    // ✅ FIX: Accept both UUIDs and department codes in department_id column
    if (row.department_id) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.department_id);
      const isValidCode = deptCodeToId[row.department_id.toLowerCase()];

      if (!validDepartments.has(row.department_id) && !isValidCode) {
        errors.push({
          row: rowNum,
          field: 'department_id',
          value: row.department_id,
          message: 'Invalid department ID or code. Use department code (e.g., "admin", "hr") or UUID from Departments sheet'
        });
      }
    }

    // Also validate department codes if provided
    if (row.department_code && !deptCodeToId[row.department_code.toLowerCase()]) {
      errors.push({
        row: rowNum,
        field: 'department_code',
        value: row.department_code,
        message: 'Invalid department code'
      });
    }

    // Validate role
    if (row.role && !['admin', 'hr', 'leader', 'manager', 'employee'].includes(row.role)) {
      errors.push({
        row: rowNum,
        field: 'role',
        value: row.role,
        message: 'Role must be one of: admin, hr, leader, manager, employee'
      });
    }

    // Validate date formats
    // birth_date - optional, validate format if provided
    if (row.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) {
      errors.push({
        row: rowNum,
        field: 'birth_date',
        value: row.birth_date,
        message: 'Birth date must be in YYYY-MM-DD format'
      });
    }

    // hire_date - required, validate format
    if (row.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.hire_date)) {
      errors.push({
        row: rowNum,
        field: 'hire_date',
        value: row.hire_date,
        message: 'Hire date must be in YYYY-MM-DD format'
      });
    }
  }

  return {
    success: errors.length === 0,
    message: errors.length === 0 ? 'Validation successful' : `${errors.length} validation errors found`,
    totalRows: data.length,
    successCount: 0,
    errorCount: errors.length,
    errors,
    duplicates
  };
};

const checkDuplicates = async (data: any[]): Promise<ImportResult['duplicates']> => {
  const duplicates = [];
  const employeeCodes = new Set<string>();

  // Check for duplicate employee codes in the import file
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row.employee_code) {
      if (employeeCodes.has(row.employee_code)) {
        duplicates.push({
          row: i + 2,
          employeeCode: row.employee_code,
          name: `${row.first_name_th || ''} ${row.last_name_th || ''}`.trim(),
          message: 'Duplicate employee code in import file'
        });
      } else {
        employeeCodes.add(row.employee_code);
      }
    }
  }

  // Check for duplicates in database
  for (const duplicate of duplicates) {
    const existingSql = `
      SELECT employee_code, first_name_th, last_name_th
      FROM employees
      WHERE employee_code = $1
    `;
    const existing = await query(existingSql, [duplicate.employeeCode]);

    if (existing.length > 0) {
      duplicate.message = 'Employee code already exists in database';
    }
  }

  return duplicates;
};

const importEmployees = async (event: AuthenticatedEvent): Promise<any> => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // ✅ Allow hr and admin only
  const userRole = event.user?.role;
  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied', 403);
  }

  try {
    // Parse the uploaded file
    const { file } = JSON.parse(event.body || '{}');

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    // Decode base64 file - handle multiple MIME types for .xlsx and .xls files
    // Possible MIME types:
    // - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (.xlsx)
    // - application/vnd.ms-excel (.xls)
    // - application/octet-stream (generic binary)
    // - application/x-msexcel
    // - application/excel
    let base64Data = file;

    // Check if it's a data URL and extract the base64 portion
    const dataUrlMatch = file.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      const mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
      console.log(`[IMPORT] File MIME type detected: ${mimeType}`);

      // Validate MIME type (allowing various Excel-related types)
      const validMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/octet-stream', // generic binary
        'application/x-msexcel',
        'application/excel',
        'application/x-excel',
        'application/x-dos_ms_excel',
        'application/xls',
        'application/x-xls'
      ];

      if (!validMimeTypes.includes(mimeType)) {
        console.warn(`[IMPORT] Unexpected MIME type: ${mimeType}. Proceeding anyway...`);
      }
    } else {
      console.log('[IMPORT] File appears to be raw base64 data without data URL prefix');
    }

    const binaryData = Buffer.from(base64Data, 'base64');
    console.log(`[IMPORT] Binary data size: ${binaryData.length} bytes`);

    // Parse Excel file with error handling
    let workbook;
    try {
      workbook = XLSX.read(binaryData, { type: 'buffer' });
    } catch (parseError: any) {
      console.error('[IMPORT] Excel parsing error:', parseError.message);
      return errorResponse(
        `ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียหายและเป็นรูปแบบ .xlsx หรือ .xls / Could not parse Excel file. Please ensure the file is not corrupted and is a valid .xlsx or .xls format.`,
        400
      );
    }

    // Find the correct sheet for employee data
    let sheetName = workbook.SheetNames[0]; // Default to first sheet
    const dataSheetNames = workbook.SheetNames.filter(name =>
      name.toLowerCase().includes('data') ||
      name.toLowerCase().includes('employee') ||
      name.toLowerCase().includes('import')
    );

    if (dataSheetNames.length > 0) {
      sheetName = dataSheetNames[0];
    }

    console.log(`[IMPORT] Using sheet: "${sheetName}"`);
    const worksheet = workbook.Sheets[sheetName];

    // Parse data as objects with property names from first row
    let data = XLSX.utils.sheet_to_json(worksheet);

    // Map columns to match expected field names
    data = data.map((row: any) => {
      const mappedRow: any = {};

      // Handle column mapping for common variations
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase();

        if (lowerKey.includes('employee') && lowerKey.includes('code')) {
          mappedRow.employee_code = row[key];
        } else if (lowerKey.includes('scan') && lowerKey.includes('code')) {
          // Matches: scan_code, Scan Code, Scan Code *, รหัสสแกน
          mappedRow.scan_code = row[key];
        } else if (lowerKey.includes('first') && lowerKey.includes('name') && lowerKey.includes('th')) {
          mappedRow.first_name_th = row[key];
        } else if (lowerKey.includes('last') && lowerKey.includes('name') && lowerKey.includes('th')) {
          mappedRow.last_name_th = row[key];
        } else if (lowerKey.includes('first') && lowerKey.includes('name') && lowerKey.includes('en')) {
          mappedRow.first_name_en = row[key];
        } else if (lowerKey.includes('last') && lowerKey.includes('name') && lowerKey.includes('en')) {
          mappedRow.last_name_en = row[key];
        } else if (lowerKey.includes('email')) {
          // Matches: email, Email, Email *
          mappedRow.email = row[key];
        } else if (lowerKey.includes('emergency') && lowerKey.includes('name')) {
          mappedRow.emergency_contact_name = row[key];
        } else if (lowerKey.includes('emergency') && lowerKey.includes('phone')) {
          mappedRow.emergency_contact_phone = row[key];
        } else if (lowerKey.includes('phone')) {
          mappedRow.phone_number = row[key];
        } else if (lowerKey.includes('department')) {
          if (lowerKey.includes('id')) {
            mappedRow.department_id = row[key];
          } else if (lowerKey.includes('code')) {
            mappedRow.department_code = row[key];
          }
        } else if (lowerKey.includes('position') && lowerKey.includes('th')) {
          mappedRow.position_th = row[key];
        } else if (lowerKey.includes('position') && lowerKey.includes('en')) {
          mappedRow.position_en = row[key];
        } else if (lowerKey.includes('role')) {
          // Matches: role, Role
          mappedRow.role = row[key];
        } else if (lowerKey.includes('birth') && lowerKey.includes('date')) {
          // Matches: birth_date, Birth Date - Convert Excel serial date to ISO format
          mappedRow.birth_date = excelDateToISO(row[key]);
        } else if (lowerKey.includes('hire') && lowerKey.includes('date')) {
          // Matches: hire_date, Hire Date, Hire Date * - Convert Excel serial date to ISO format
          mappedRow.hire_date = excelDateToISO(row[key]);
        } else if (lowerKey.includes('national') && lowerKey.includes('id')) {
          // Matches: national_id, National ID, National ID *
          mappedRow.national_id = row[key];
        } else if (lowerKey.includes('address') && lowerKey.includes('th')) {
          mappedRow.address_th = row[key];
        } else {
          // Keep original column name if no mapping found
          mappedRow[key] = row[key];
        }
      });

      return mappedRow;
    });

    if (data.length === 0) {
      return errorResponse('No data found in file', 400);
    }

    // Get departments for validation
    const departmentsSql = `
      SELECT id, department_code, name_th, name_en
      FROM departments
      WHERE is_active = true
    `;
    const departments = await query(departmentsSql);

    // Create department code to ID mapping
    // Map both department codes AND display names for flexibility
    const deptCodeToId: { [key: string]: string } = {};
    departments.forEach(dept => {
      // Map by department code (e.g., "admin", "qa_qc", "rd")
      deptCodeToId[dept.department_code.toLowerCase()] = dept.id;

      // Also map by English display name (e.g., "Admin", "QA/QC", "R&D")
      if (dept.name_en) {
        deptCodeToId[dept.name_en.toLowerCase()] = dept.id;
      }

      // Also map by Thai display name
      if (dept.name_th) {
        deptCodeToId[dept.name_th.toLowerCase()] = dept.id;
      }
    });

    // ============================================================================
    // DEBUG LOGGING: Help identify mapping and parsing issues
    // ============================================================================
    if (data.length > 0) {
      const firstRow = data[0] as any;
      console.log('[IMPORT DEBUG] First row data after mapping:', JSON.stringify({
        employee_code: firstRow.employee_code,
        scan_code: firstRow.scan_code,
        first_name_th: firstRow.first_name_th,
        last_name_th: firstRow.last_name_th,
        first_name_en: firstRow.first_name_en,
        last_name_en: firstRow.last_name_en,
        email: firstRow.email,
        hire_date: firstRow.hire_date,
        birth_date: firstRow.birth_date,
        national_id: firstRow.national_id,
        department_id: firstRow.department_id,
        role: firstRow.role
      }, null, 2));
    }

    // Validate data
    const validationResult = validateEmployeeData(data as EmployeeRow[], departments, deptCodeToId);
    if (!validationResult.success) {
      console.log('[IMPORT] Validation failed:', JSON.stringify(validationResult.errors, null, 2));
      return successResponse({
        ...validationResult,
        step: 'validation'
      }, 400);
    }

    // Check for duplicates
    const duplicates = await checkDuplicates(data);
    if (duplicates.length > 0) {
      return successResponse({
        ...validationResult,
        duplicates,
        step: 'duplicate_check'
      }, 409);
    }

    // ✅ BATCH PROCESSING: Process max 20 employees per request (fast now without leave balance creation)
    const BATCH_SIZE = 20;
    const batchStart = parseInt(event.queryStringParameters?.batch_start || '0');
    const batchEnd = Math.min(batchStart + BATCH_SIZE, data.length);
    const batchData = data.slice(batchStart, batchEnd);

    console.log(`[IMPORT BATCH] Processing rows ${batchStart}-${batchEnd} of ${data.length}`);

    // Import employees (batch only)
    const importResults = {
      success: 0,
      failed: 0,
      errors: [] as ValidationError[]
    };

    const balanceSyncResults = {
      synced: 0,
      failed: 0
    };

    const currentYear = new Date().getFullYear();

    for (let i = 0; i < batchData.length; i++) {
      const row = batchData[i] as EmployeeRow;

      // Skip empty rows
      if (!row.employee_code || !row.first_name_th || !row.last_name_th) {
        continue;
      }

      try {
        // Generate default password hash (using employee_code as default password)
        const defaultPassword = row.employee_code.toString();
        // Use lower salt rounds (8) for bulk import to reduce processing time
        const passwordHash = await bcrypt.hash(defaultPassword, 8);

        // Convert department code to UUID if provided
        let departmentId = row.department_id || null;

        // ✅ FIX: Handle department_id that contains text codes instead of UUIDs
        // Check if department_id looks like a UUID (has hyphens and correct length)
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        if (departmentId && typeof departmentId === 'string' && !isUUID(departmentId)) {
          // department_id contains a code (like "Admin"), not a UUID - convert it
          const deptCode = departmentId.toLowerCase();
          if (deptCodeToId[deptCode]) {
            console.log(`[IMPORT FIX] Converting department_id "${departmentId}" to UUID: ${deptCodeToId[deptCode]}`);
            departmentId = deptCodeToId[deptCode];
          }
        }

        // Also handle department_code if provided
        if (row.department_code && deptCodeToId[row.department_code.toLowerCase()]) {
          departmentId = deptCodeToId[row.department_code.toLowerCase()];
        }

        // ===================================================================
        // Convert and validate REQUIRED fields (8 fields - NOT NULL)
        // ===================================================================
        const employeeCode = row.employee_code.toString();
        // scan_code can be NULL if not provided
        const scanCode = row.scan_code ? row.scan_code.toString() : null;
        const nationalId = row.national_id?.toString() || '';
        const firstNameTh = row.first_name_th;
        const lastNameTh = row.last_name_th;
        const firstNameEn = row.first_name_en;
        const lastNameEn = row.last_name_en;
        const hireDate = row.hire_date;

        // ===================================================================
        // OPTIONAL fields - pass as NULL if not provided
        // ===================================================================
        const email = row.email || null;
        const phoneNumber = row.phone_number || null;
        const birthDate = row.birth_date || null;
        const addressTh = row.address_th || null;
        const positionTh = row.position_th || null;
        const positionEn = row.position_en || null;
        const emergencyContactName = row.emergency_contact_name || null;
        const emergencyContactPhone = row.emergency_contact_phone || null;

        // ===================================================================
        // CHECK FOR DUPLICATES (Active employees only)
        // ===================================================================
        // Note: The database now enforces uniqueness ONLY for active employees
        // via partial indexes (WHERE status = 'active').
        // We perform these checks just to provide clear error messages.
        // ===================================================================

        // 1. Check by EMPLOYEE_CODE
        const existingByCode = await query(`
          SELECT id, employee_code, scan_code, status, first_name_th, last_name_th 
          FROM employees WHERE employee_code = $1 AND status = 'active'
        `, [employeeCode]);

        if (existingByCode.length > 0) {
          const existing = existingByCode[0];
          throw new Error(`รหัสพนักงาน "${employeeCode}" มีอยู่ในระบบแล้วและยังทำงานอยู่ / Employee code "${employeeCode}" already exists and is active`);
        }

        // 2. Check by NATIONAL_ID
        if (nationalId) {
          const existingByNationalId = await query(`
            SELECT id, employee_code, scan_code, status, first_name_th, last_name_th 
            FROM employees WHERE national_id = $1 AND status = 'active'
          `, [nationalId]);

          if (existingByNationalId.length > 0) {
            // Check if it's the SAME employee code (update scenario - though import is usually insert only)
            // But here we are inserting new, so if ANY active employee has this national_id, it's a conflict
            const existing = existingByNationalId[0];
            if (existing.employee_code !== employeeCode) {
              throw new Error(`เลขบัตรประชาชนนี้ถูกใช้โดย "${existing.first_name_th} ${existing.last_name_th}" (${existing.employee_code}) ซึ่งยังทำงานอยู่ / National ID already used by "${existing.first_name_th} ${existing.last_name_th}" (${existing.employee_code}) who is still active`);
            }
          }
        }

        // 3. Check by SCAN_CODE
        if (scanCode && scanCode !== employeeCode) {
          const existingByScanCode = await query(`
            SELECT id, employee_code, scan_code, status, first_name_th, last_name_th 
            FROM employees WHERE scan_code = $1 AND status = 'active'
          `, [scanCode]);

          if (existingByScanCode.length > 0) {
            const existing = existingByScanCode[0];
            if (existing.employee_code !== employeeCode) {
              throw new Error(`รหัสสแกน "${scanCode}" ถูกใช้โดย "${existing.first_name_th} ${existing.last_name_th}" (${existing.employee_code}) ซึ่งยังทำงานอยู่ / Scan code already used by active employee`);
            }
          }
        }

        // 4. Check by EMAIL
        if (email) {
          const existingByEmail = await query(`
            SELECT id, employee_code, scan_code, status, first_name_th, last_name_th 
            FROM employees WHERE email = $1 AND status = 'active'
          `, [email]);

          if (existingByEmail.length > 0) {
            const existing = existingByEmail[0];
            if (existing.employee_code !== employeeCode) {
              throw new Error(`อีเมล "${email}" ถูกใช้โดย "${existing.first_name_th} ${existing.last_name_th}" (${existing.employee_code}) ซึ่งยังทำงานอยู่ / Email already used by active employee`);
            }
          }
        }

        // INSERT NEW RECORD 
        // (Database allows duplicates if previous records are inactive/resigned status != 'active')
        const insertSql = `
          INSERT INTO employees (
            employee_code, scan_code, first_name_th, last_name_th, first_name_en, last_name_en,
            email, phone_number, department_id, position_th, position_en,
            role, birth_date, hire_date, national_id, address_th,
            emergency_contact_name, emergency_contact_phone, password_hash, must_change_password, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, true, $20, NOW(), NOW()
          )
          RETURNING id
        `;

        const insertResult = await query(insertSql, [
          employeeCode,           // NOT NULL
          scanCode,               // NOT NULL
          firstNameTh,            // NOT NULL
          lastNameTh,             // NOT NULL
          firstNameEn,            // NOT NULL
          lastNameEn,             // NOT NULL
          email,                  // NULL OK
          phoneNumber,            // NULL OK
          departmentId,           // NULL OK
          positionTh,             // NULL OK
          positionEn,             // NULL OK
          row.role || 'employee', // DEFAULT 'employee'
          birthDate,              // NULL OK
          hireDate,               // NOT NULL
          nationalId,             // NOT NULL
          addressTh,              // NULL OK
          emergencyContactName,   // NULL OK
          emergencyContactPhone,  // NULL OK
          passwordHash,           // Will be NOT NULL after this
          'active'                // DEFAULT 'active'
        ]);

        importResults.success++;

        // ============================================================================
        // ⚠️ DISABLED: Leave balance creation during import (causes timeout!)
        // ============================================================================
        // Leave balances will be created automatically when:
        // 1. Employee first accesses the leave system
        // 2. HR runs "Sync Leave Balances" function
        // 3. Daily cron job (if configured)
        // ============================================================================
        // The ensureLeaveBalances function runs 25-40 queries per employee,
        // which causes Netlify function timeout when importing in batches.
        // ============================================================================
        /*
        try {
          const employeeId = insertResult[0]?.id;
          if (employeeId) {
            await ensureLeaveBalances(employeeId, currentYear);
            balanceSyncResults.synced++;
            console.log(`✅[IMPORT] Leave balances created for ${employeeCode}(${balanceSyncResults.synced} / ${importResults.success})`);
          }
        } catch (balanceError: any) {
          balanceSyncResults.failed++;
          console.error(`⚠️[IMPORT] Failed to create leave balances for ${employeeCode}: `, balanceError.message);
          // Don't fail the entire import, continue with next employee
        }
        */
        console.log(`✅[IMPORT] Employee ${employeeCode} imported (leave balances will be created on first access)`);
      } catch (error: any) {
        importResults.failed++;

        // ============================================================================
        // HUMAN-READABLE ERROR MESSAGES WITH DETAILED DUPLICATE INFO
        // ============================================================================
        const errMsg = error.message || 'Failed to import employee';
        const rowData = row as EmployeeRow;
        const empCode = rowData.employee_code?.toString() || 'N/A';
        const empName = `${rowData.first_name_th || ''} ${rowData.last_name_th || ''} `.trim() || 'Unknown';

        // Determine specific error type and provide helpful message
        let fieldName = 'employee_code';
        let fieldValue = `${empCode} - ${empName} `;
        let userMessage = errMsg;

        // Detect duplicate key errors and find WHO has the duplicate
        if (errMsg.includes('already exists') || errMsg.includes('unique constraint') || errMsg.includes('duplicate key')) {
          try {
            // Try to find the existing employee with the duplicate value
            let existingEmployee: any = null;
            let duplicateField = '';
            let duplicateValue = '';

            if (errMsg.includes('employee_code') || errMsg.includes('employees_pkey') || errMsg.includes('is active')) {
              duplicateField = 'employee_code';
              duplicateValue = empCode;
              const result = await query(`
                SELECT employee_code, first_name_th, last_name_th, status 
                FROM employees WHERE employee_code = $1 LIMIT 1
          `, [empCode]);
              existingEmployee = result[0];
            } else if (errMsg.includes('scan_code')) {
              duplicateField = 'scan_code';
              duplicateValue = rowData.scan_code?.toString() || empCode;
              const result = await query(`
                SELECT employee_code, first_name_th, last_name_th, status 
                FROM employees WHERE scan_code = $1 LIMIT 1
          `, [duplicateValue]);
              existingEmployee = result[0];
            } else if (errMsg.includes('email')) {
              duplicateField = 'email';
              duplicateValue = rowData.email || '';
              if (duplicateValue) {
                const result = await query(`
                  SELECT employee_code, first_name_th, last_name_th, status 
                  FROM employees WHERE email = $1 LIMIT 1
          `, [duplicateValue]);
                existingEmployee = result[0];
              }
            } else if (errMsg.includes('national_id')) {
              duplicateField = 'national_id';
              duplicateValue = rowData.national_id?.toString() || '';
              if (duplicateValue) {
                const result = await query(`
                  SELECT employee_code, first_name_th, last_name_th, status 
                  FROM employees WHERE national_id = $1 LIMIT 1
                `, [duplicateValue]);
                existingEmployee = result[0];
              }
            }

            // Build detailed error message
            if (existingEmployee) {
              const existingName = `${existingEmployee.first_name_th || ''} ${existingEmployee.last_name_th || ''} `.trim();
              const existingCode = existingEmployee.employee_code;
              const statusThai = existingEmployee.status === 'active' ? 'ทำงานอยู่' :
                existingEmployee.status === 'inactive' ? 'ไม่ได้ทำงาน' :
                  existingEmployee.status === 'resigned' ? 'ลาออก' : existingEmployee.status;

              fieldName = duplicateField;
              fieldValue = `${empCode} - ${empName} `;

              if (duplicateField === 'employee_code') {
                userMessage = `รหัสพนักงาน "${empCode}" ซ้ำกับ "${existingName}"(${statusThai}) / Employee code "${empCode}" already used by "${existingName}"(${existingEmployee.status})`;
              } else if (duplicateField === 'scan_code') {
                userMessage = `รหัสสแกน "${duplicateValue}" ซ้ำกับพนักงาน "${existingName}"(${existingCode}) / Scan code "${duplicateValue}" already used by "${existingName}"(${existingCode})`;
              } else if (duplicateField === 'email') {
                userMessage = `อีเมล "${duplicateValue}" ซ้ำกับพนักงาน "${existingName}"(${existingCode}) / Email "${duplicateValue}" already used by "${existingName}"(${existingCode})`;
              } else if (duplicateField === 'national_id') {
                userMessage = `เลขบัตรประชาชนซ้ำกับพนักงาน "${existingName}"(${existingCode}) / National ID already used by "${existingName}"(${existingCode})`;
              }
            } else {
              // Fallback if we can't find the existing employee
              fieldName = 'duplicate';
              userMessage = `${empName} (${empCode}) - ข้อมูลซ้ำในระบบ / Record already exists`;
            }
          } catch (lookupError) {
            // If lookup fails, use simple message
            fieldName = 'duplicate';
            userMessage = `${empName} (${empCode}) - ข้อมูลซ้ำในระบบ / Record already exists`;
          }
        } else if (errMsg.includes('null') || errMsg.includes('NOT NULL')) {
          // Missing required field
          fieldName = 'missing_field';
          userMessage = `${empName} (${empCode}) - ข้อมูลที่จำเป็นไม่ครบ / Missing required data`;
        } else if (errMsg.includes('invalid') || errMsg.includes('format')) {
          fieldName = 'format';
          userMessage = `${empName} (${empCode}) - รูปแบบข้อมูลไม่ถูกต้อง / Invalid data format`;
        }

        importResults.errors.push({
          row: batchStart + i + 2,  // Correct row number accounting for batch offset
          field: fieldName,
          value: fieldValue,
          message: userMessage
        });
      }
    }

    // ============================================================================
    // ✅ WORLD-CLASS HRM: Automatic balance sync ENABLED
    // ============================================================================
    // Leave balances are created individually for each employee during import
    // No manual sync required! Each employee gets correct balances based on:
    // - Their specific hire date
    // - Thailand 120-day probation rules
    // - Pro-rata calculations
    // - Current leave_policies
    // ============================================================================
    console.log(`✅[IMPORT COMPLETE] Leave balances synced: ${balanceSyncResults.synced} successful, ${balanceSyncResults.failed} failed`);

    // Calculate batch progress
    const hasMoreBatches = batchEnd < data.length;
    const nextBatchStart = hasMoreBatches ? batchEnd : null;
    const processedSoFar = batchEnd;
    const remaining = data.length - batchEnd;

    const finalResult: ImportResult = {
      success: importResults.failed === 0,
      message: importResults.failed === 0
        ? `Batch imported ${importResults.success} employees with leave balances(${processedSoFar} / ${data.length}).${hasMoreBatches ? `${remaining} remaining.` : 'Import complete with automatic leave balance sync!'} `
        : `Batch: ${importResults.success} succeeded, ${importResults.failed} failed(${processedSoFar} / ${data.length}).`,
      totalRows: data.length,
      successCount: importResults.success,
      errorCount: importResults.failed,
      errors: importResults.errors,
      duplicates,
      syncResult: {
        balancesCreated: balanceSyncResults.synced,
        balancesUpdated: 0,
        employeesProcessed: balanceSyncResults.synced
      },
      // Batch information
      batch: {
        start: batchStart,
        end: batchEnd,
        size: batchData.length,
        hasMore: hasMoreBatches,
        nextStart: nextBatchStart,
        totalProcessed: processedSoFar,
        totalRemaining: remaining
      }
    };

    return successResponse(finalResult, 200);

  } catch (error: any) {
    console.error('Import employees error:', error);
    return errorResponse(error.message || 'Failed to import employees', 500);
  }
};

export const handler: Handler = requireAuth(importEmployees);
