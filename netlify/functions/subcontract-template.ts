import { Handler } from '@netlify/functions';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { errorResponse, handleCORS } from './utils/response';
import * as XLSX from 'xlsx';

const generateSubcontractTemplate = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    // ✅ Allow hr and admin only
    const userRole = event.user?.role;
    if (!['hr', 'admin'].includes(userRole || '')) {
        return errorResponse('Permission denied', 403);
    }

    try {
        // Define template headers
        const headers = [
            'Employee Code',
            'First Name (TH)',
            'Last Name (TH)',
            'Nickname',
            'Company Name',
            'Manufacturing Line',
            'Shift',
            'Hire Date',
            'National ID',
            'Phone Number',
            'Position',
            'Daily Rate'
        ];

        // Example data
        const exampleData = [
            {
                'Employee Code': '', // Leave blank for auto-generate
                'First Name (TH)': 'สมชาย',
                'Last Name (TH)': 'ใจดี',
                'Nickname': 'ชาย',
                'Company Name': 'Manpower',
                'Manufacturing Line': 'ASM2',
                'Shift': 'Day',
                'Hire Date': new Date().toISOString().split('T')[0],
                'National ID': '1234567890123',
                'Phone Number': '0812345678',
                'Position': 'Operator',
                'Daily Rate': 350
            }
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });

        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // Code
            { wch: 20 }, // First Name
            { wch: 20 }, // Last Name
            { wch: 10 }, // Nickname
            { wch: 20 }, // Company
            { wch: 15 }, // Line
            { wch: 10 }, // Shift
            { wch: 15 }, // Hire Date
            { wch: 20 }, // National ID
            { wch: 15 }, // Phone
            { wch: 15 }, // Position
            { wch: 12 }  // Rate
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Template');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="subcontract_employee_template.xlsx"',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true,
        };

    } catch (error: any) {
        console.error('Template generation error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
};

export const handler: Handler = requireAuth(generateSubcontractTemplate);
