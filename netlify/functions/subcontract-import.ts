import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import * as XLSX from 'xlsx';

/**
 * Convert Excel serial date to ISO date string (YYYY-MM-DD)
 */
const excelDateToISO = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
    }
    return String(value); // Fallback
};

/**
 * Generate Next Employee Code
 * Format: PREFIX-YYXXX (e.g., MAN-26001)
 */
const generateEmployeeCode = async (companyName: string): Promise<string> => {
    const prefix = companyName.substring(0, 3).toUpperCase();
    const yearSuffix = new Date().getFullYear().toString().substring(2); // '26' for 2026
    const codePattern = `${prefix}-${yearSuffix}%`; // e.g., 'MAN-26%'

    // Find max existing code
    const result = await query(`
    SELECT employee_code 
    FROM subcontract_employees 
    WHERE employee_code LIKE $1 
    ORDER BY employee_code DESC 
    LIMIT 1
  `, [codePattern]);

    let nextNum = 1;
    if (result.length > 0) {
        const lastCode = result[0].employee_code;
        const parts = lastCode.split('-');
        if (parts.length > 1) {
            const numPart = parts[1].substring(2); // Remove '26' -> '001'
            const lastNum = parseInt(numPart, 10);
            if (!isNaN(lastNum)) {
                nextNum = lastNum + 1;
            }
        }
    }

    return `${prefix}-${yearSuffix}${String(nextNum).padStart(3, '0')}`;
};

const importSubcontractEmployees = async (event: AuthenticatedEvent) => {
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
        const { file } = JSON.parse(event.body || '{}');
        if (!file) return errorResponse('No file provided', 400);

        // Decode and parse Excel
        const binaryData = Buffer.from(file.replace(/^data:.*;base64,/, ''), 'base64');
        const workbook = XLSX.read(binaryData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (data.length === 0) return errorResponse('No data found', 400);

        // Get Manufacturing Lines for mapping
        const lines = await query(`SELECT id, code FROM manufacturing_lines`);
        const lineMap: Record<string, string> = {};
        lines.forEach((l: any) => lineMap[l.code.toUpperCase()] = l.id);

        let successCount = 0;
        const errors: any[] = [];
        const generatedCodes: Record<string, string> = {}; // Cache to prevent duplicates in same batch

        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;

            try {
                // Field Mapping
                const firstName = row['First Name (TH)'] || row['first_name_th'];
                const lastName = row['Last Name (TH)'] || row['last_name_th'];
                const company = row['Company Name'] || row['company_name'];
                const shiftRaw = row['Shift'] || row['shift'];
                const hireDateRaw = row['Hire Date'] || row['hire_date'];
                let empCode = row['Employee Code'] || row['employee_code'];
                const nationalId = row['National ID'] || row['national_id'];
                const lineCode = row['Manufacturing Line'] || row['line_id']; // Accept line code in excel

                // Validation
                if (!firstName || !lastName || !company) {
                    throw new Error('Missing required fields (First Name, Last Name, Company)');
                }

                // Maps Line Code 'ASM2' -> Valid UUID
                let lineId = null;
                if (lineCode && lineMap[lineCode.toString().toUpperCase()]) {
                    lineId = lineMap[lineCode.toString().toUpperCase()];
                }

                // Map Shift
                let shift = 'day';
                if (shiftRaw) {
                    const s = shiftRaw.toLowerCase();
                    if (s.includes('night') && (s.includes('ab') || s.includes('a/b'))) shift = 'night_ab';
                    else if (s.includes('night') && (s.includes('cd') || s.includes('c/d'))) shift = 'night_cd';
                    else if (s.includes('night')) shift = 'night_ab'; // Default night
                }

                const hireDate = excelDateToISO(hireDateRaw) || new Date().toISOString().split('T')[0];

                // Auto-Generate ID if empty
                if (!empCode) {
                    // Must ensure uniqueness within this batch as well
                    let nextCode = await generateEmployeeCode(company);

                    // If we generated this code already in this batch, increment until unique
                    while (generatedCodes[nextCode]) {
                        const parts = nextCode.split('-');
                        const prefix = parts[0];
                        const numPart = parseInt(parts[1].substring(2)) + 1;
                        nextCode = `${prefix}-${parts[1].substring(0, 2)}${String(numPart).padStart(3, '0')}`;
                    }

                    empCode = nextCode;
                    generatedCodes[empCode] = 'used';
                }

                // Check National ID duplication in DB
                if (nationalId) {
                    const dupCheck = await query(`SELECT id FROM subcontract_employees WHERE national_id = $1`, [nationalId]);
                    if (dupCheck.length > 0) {
                        throw new Error(`National ID ${nationalId} already exists`);
                    }
                }

                // Insert
                await query(`
                INSERT INTO subcontract_employees (
                    employee_code, first_name_th, last_name_th, nickname, 
                    company_name, line_id, shift, hire_date, 
                    national_id, phone_number, position_en, hourly_rate, 
                    created_by, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
            `, [
                    empCode,
                    firstName,
                    lastName,
                    row['Nickname'] || row['nickname'] || null,
                    company,
                    lineId,
                    shift,
                    hireDate,
                    nationalId || null,
                    row['Phone Number'] || row['phone_number'] || null,
                    row['Position'] || row['position'] || null,
                    row['Daily Rate'] || row['hourly_rate'] || null,
                    (event.user as any)?.id || null
                ]);

                successCount++;

            } catch (err: any) {
                errors.push({
                    row: rowNum,
                    name: `${row['First Name (TH)'] || 'Unknown'}`,
                    message: err.message
                });
            }
        }

        return successResponse({
            success: true,
            successCount,
            errorCount: errors.length,
            errors,
            totalRows: data.length,
            message: `Imported ${successCount} employees`
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return errorResponse(error.message || 'Import failed', 500);
    }
};

export const handler: Handler = requireAuth(importSubcontractEmployees);
