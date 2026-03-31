// netlify/functions/employee-off-days-import.ts
// Bulk import employee off-days from Excel file
// Similar pattern to employee-import.ts

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import * as XLSX from 'xlsx';

interface ValidationError {
    row: number;
    field: string;
    value: string;
    message: string;
}

interface ImportResult {
    success: boolean;
    message: string;
    totalRows: number;
    successCount: number;
    errorCount: number;
    duplicateCount: number;
    errors: ValidationError[];
}

interface OffDayRow {
    employee_code?: string;
    off_date?: string;
    off_type?: string;
    notes?: string;
}

/**
 * Parse date from various formats to YYYY-MM-DD
 * Supports: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, mm/dd/yyyy
 */
const parseDate = (dateStr: string | number | undefined): string | null => {
    if (!dateStr) return null;

    // Handle Excel serial date number
    if (typeof dateStr === 'number') {
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch
        const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    const str = String(dateStr).trim();

    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }

    // DD/MM/YYYY or DD-MM-YYYY format (Thai preferred)
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyyMatch) {
        const [, dd, mm, yyyy] = ddmmyyyyMatch;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    // MM/DD/YYYY format (US format - less common)
    const mmddyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mmddyyyyMatch) {
        const [, mm, dd, yyyy] = mmddyyyyMatch;
        // Check if first number > 12, then it's dd/mm/yyyy
        if (parseInt(mm) > 12) {
            return `${yyyy}-${dd.padStart(2, '0')}-${mm.padStart(2, '0')}`;
        }
    }

    return null; // Invalid format
};

const validateOffDayData = async (data: OffDayRow[]): Promise<ImportResult> => {
    const errors: ValidationError[] = [];

    // Get all active employees for validation
    const employees = await query('SELECT id, employee_code FROM employees WHERE is_active = true');
    const employeeCodeMap = new Map(employees.map(e => [e.employee_code, e.id]));

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // Excel rows are 1-based, plus header row

        // Skip empty rows
        if (!row.employee_code && !row.off_date) {
            continue;
        }

        const employeeCode = String(row.employee_code || '').trim();

        // Validate employee_code (required)
        if (!employeeCode) {
            errors.push({
                row: rowNum,
                field: 'employee_code',
                value: '',
                message: 'Employee code is required',
            });
        } else if (!employeeCodeMap.has(employeeCode)) {
            errors.push({
                row: rowNum,
                field: 'employee_code',
                value: employeeCode,
                message: `Employee code not found in system (received: "${employeeCode}")`,
            });
        }

        // Validate off_date (required)
        if (!row.off_date) {
            errors.push({
                row: rowNum,
                field: 'off_date',
                value: String(row.off_date || ''),
                message: 'Off date is required',
            });
        } else {
            // Try to parse the date using parseDate function
            const parsedDate = parseDate(row.off_date);
            if (!parsedDate) {
                errors.push({
                    row: rowNum,
                    field: 'off_date',
                    value: String(row.off_date),
                    message: 'Invalid date format. Use dd/mm/yyyy or yyyy-mm-dd',
                });
            } else {
                // Validate it's a valid date
                const date = new Date(parsedDate);
                if (isNaN(date.getTime())) {
                    errors.push({
                        row: rowNum,
                        field: 'off_date',
                        value: String(row.off_date),
                        message: 'Invalid date',
                    });
                }
            }
        }

        // Validate off_type (optional, but must be valid if provided)
        if (row.off_type) {
            const validTypes = ['weekly_saturday', 'alternating_saturday', 'weekly_sunday', 'custom'];
            if (!validTypes.includes(row.off_type)) {
                errors.push({
                    row: rowNum,
                    field: 'off_type',
                    value: row.off_type,
                    message: `Off type must be one of: ${validTypes.join(', ')}`,
                });
            }
        }
    }

    return {
        success: errors.length === 0,
        message: errors.length === 0 ? 'Validation successful' : `${errors.length} validation errors found`,
        totalRows: data.length,
        successCount: 0,
        errorCount: errors.length,
        duplicateCount: 0,
        errors,
    };
};

const importOffDays = async (event: AuthenticatedEvent): Promise<any> => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    // Only HR and dev can import
    const userRole = event.user?.role;
    if (!['hr', 'dev'].includes(userRole || '')) {
        return errorResponse('Unauthorized: HR or dev role required', 403);
    }

    try {
        const userId = event.user?.userId;
        const { file } = JSON.parse(event.body || '{}');

        if (!file) {
            return errorResponse('No file provided', 400);
        }

        // Decode base64 file
        const base64Data = file.replace(/^data:application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,/, '');
        const binaryData = Buffer.from(base64Data, 'base64');

        // Parse Excel file
        const workbook = XLSX.read(binaryData, { type: 'buffer' });

        // Find the correct sheet
        let sheetName = workbook.SheetNames[0];
        const dataSheetNames = workbook.SheetNames.filter(name =>
            name.toLowerCase().includes('data') ||
            name.toLowerCase().includes('off-days') ||
            name.toLowerCase().includes('import')
        );

        if (dataSheetNames.length > 0) {
            sheetName = dataSheetNames[0];
        }

        console.log(`[OFF-DAYS IMPORT] Using sheet: "${sheetName}"`);
        const worksheet = workbook.Sheets[sheetName];

        // Parse data
        let data = XLSX.utils.sheet_to_json(worksheet);

        // Map columns to expected field names
        data = data.map((row: any) => {
            const mappedRow: any = {};

            Object.keys(row).forEach(key => {
                const lowerKey = key.toLowerCase();

                if (lowerKey === 'employee_code' || (lowerKey.includes('employee') && lowerKey.includes('code'))) {
                    mappedRow.employee_code = row[key];
                } else if (lowerKey.includes('off') && lowerKey.includes('date')) {
                    mappedRow.off_date = row[key];
                } else if (lowerKey.includes('off') && lowerKey.includes('type')) {
                    mappedRow.off_type = row[key];
                } else if (lowerKey === 'group' || lowerKey.includes('group')) {
                    mappedRow.group = row[key];
                } else if (lowerKey.includes('note')) {
                    mappedRow.notes = row[key];
                } else {
                    // Keep original if no mapping found
                    mappedRow[key] = row[key];
                }
            });

            return mappedRow;
        });

        if (data.length === 0) {
            return errorResponse('No data found in file', 400);
        }

        // Logic to expand Group-based import
        const hasGroupData = data.some((r: any) => r.group && r.employee_code);

        if (hasGroupData) {
            console.log('[OFF-DAYS IMPORT] Detected Group-based import, expanding dates...');
            const expandedData: any[] = [];

            data.forEach((row: any) => {
                // If row has parsed off_date, keep it (mixed mode support)
                if (row.off_date) {
                    expandedData.push(row);
                    return;
                }

                // If row has Group, generate series
                if (row.group && row.employee_code) {
                    const group = String(row.group).trim().toLowerCase();
                    let startDate: Date | null = null;

                    // Logic for 2026 Groups
                    // Group A: Starts Jan 10, 2026
                    // Group B: Starts Jan 17, 2026
                    if (group === 'group a' || group === 'a') {
                        startDate = new Date(2026, 0, 10); // 10 Jan 2026
                    } else if (group === 'group b' || group === 'b') {
                        startDate = new Date(2026, 0, 17); // 17 Jan 2026
                    }

                    if (startDate) {
                        const current = new Date(startDate);
                        // Generate for entire year 2026
                        while (current.getFullYear() === 2026) {
                            const yyyy = current.getFullYear();
                            const mm = String(current.getMonth() + 1).padStart(2, '0');
                            const dd = String(current.getDate()).padStart(2, '0');

                            expandedData.push({
                                employee_code: row.employee_code,
                                off_date: `${yyyy}-${mm}-${dd}`,
                                off_type: 'alternating_saturday', // fixed type for group import
                                notes: row.notes || `${row.group} (Auto GEN)`
                            });

                            // Add 14 days (2 weeks)
                            current.setDate(current.getDate() + 14);
                        }
                    }
                }
            });

            if (expandedData.length > 0) {
                console.log(`[OFF-DAYS IMPORT] Expanded to ${expandedData.length} rows`);
                data = expandedData;
            }
        }

        console.log(`[OFF-DAYS IMPORT] Found ${data.length} rows`);

        // Validate data
        const validationResult = await validateOffDayData(data as OffDayRow[]);
        if (!validationResult.success) {
            return successResponse({
                ...validationResult,
                step: 'validation',
            }, 400);
        }

        // Get employee code to ID mapping
        const employees = await query('SELECT id, employee_code FROM employees WHERE is_active = true');
        const employeeCodeMap = new Map(employees.map(e => [e.employee_code, e.id]));

        // Import off-days with duplicate detection
        const importResults = {
            success: 0,
            failed: 0,
            duplicates: 0,
            errors: [] as ValidationError[],
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i] as OffDayRow;

            // Skip empty rows
            if (!row.employee_code || !row.off_date) {
                continue;
            }

            try {
                const employeeCode = String(row.employee_code || '').trim();
                const employeeId = employeeCodeMap.get(employeeCode);

                if (!employeeId) {
                    importResults.failed++;
                    importResults.errors.push({
                        row: i + 2,
                        field: 'employee_code',
                        value: employeeCode,
                        message: 'Employee not found (after validation)',
                    });
                    continue;
                }

                const insertSql = `
          INSERT INTO employee_off_days (employee_id, off_date, off_type, notes, created_by)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (employee_id, off_date) DO NOTHING
          RETURNING id
        `;

                // Parse the date to YYYY-MM-DD format
                const parsedDate = parseDate(row.off_date);
                if (!parsedDate) {
                    importResults.failed++;
                    importResults.errors.push({
                        row: i + 2,
                        field: 'off_date',
                        value: String(row.off_date || ''),
                        message: 'Invalid date format',
                    });
                    continue;
                }

                const result = await query(insertSql, [
                    employeeId,
                    parsedDate, // Use parsed date in YYYY-MM-DD format
                    row.off_type || 'alternating_saturday',
                    row.notes || null,
                    userId,
                ]);

                if (result.length > 0) {
                    importResults.success++;
                } else {
                    // Duplicate detected (ON CONFLICT triggered)
                    importResults.duplicates++;
                }

            } catch (error: any) {
                importResults.failed++;
                importResults.errors.push({
                    row: i + 2,
                    field: 'general',
                    value: '',
                    message: error.message || 'Failed to import off-day',
                });
            }
        }

        const finalResult: ImportResult = {
            success: importResults.failed === 0,
            message: importResults.failed === 0
                ? `Successfully imported ${importResults.success} off-days (${importResults.duplicates} duplicates skipped)`
                : `Imported ${importResults.success} off-days, ${importResults.failed} failed, ${importResults.duplicates} duplicates skipped`,
            totalRows: data.length,
            successCount: importResults.success,
            errorCount: importResults.failed,
            duplicateCount: importResults.duplicates,
            errors: importResults.errors,
        };

        return successResponse(finalResult, 200);

    } catch (error: any) {
        console.error('Import off-days error:', error);
        return errorResponse(error.message || 'Failed to import off-days', 500);
    }
};

export const handler: Handler = requireAuth(importOffDays);
