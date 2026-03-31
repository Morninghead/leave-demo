import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import * as XLSX from 'xlsx';

const generateEmployeeTemplate = async (event: AuthenticatedEvent) => {
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
    // Fetch all departments for reference
    const departmentsSql = `
      SELECT id, department_code, name_th, name_en
      FROM departments
      WHERE is_active = true
      ORDER BY name_th
    `;
    const departments = await query(departmentsSql);

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add metadata
    wb.Props = {
      Title: 'Employee Template - SSTH Leave Management System',
      Subject: 'Employee Data Entry Template',
      Author: 'SSTH Leave Management System',
      CreatedDate: new Date(),
    };

    // ============================================================================
    // Define template columns
    // 8 REQUIRED fields (NOT NULL): marked with * in Excel
    // Other fields are OPTIONAL (can be NULL)
    // ============================================================================
    const templateColumns = [
      // ========== 8 REQUIRED FIELDS (NOT NULL) ==========
      { key: 'employee_code', label_th: 'รหัสพนักงาน', label_en: 'Employee Code', required: true },
      { key: 'scan_code', label_th: 'รหัสสแกน', label_en: 'Scan Code', required: true },
      { key: 'national_id', label_th: 'เลขบัตรประชาชน', label_en: 'National ID', required: true },
      { key: 'first_name_th', label_th: 'ชื่อ (ไทย)', label_en: 'First Name (TH)', required: true },
      { key: 'last_name_th', label_th: 'นามสกุล (ไทย)', label_en: 'Last Name (TH)', required: true },
      { key: 'first_name_en', label_th: 'ชื่อ (อังกฤษ)', label_en: 'First Name (EN)', required: true },
      { key: 'last_name_en', label_th: 'นามสกุล (อังกฤษ)', label_en: 'Last Name (EN)', required: true },
      { key: 'hire_date', label_th: 'วันที่เริ่มงาน', label_en: 'Hire Date', required: true },

      // ========== OPTIONAL FIELDS (CAN BE NULL) ==========
      { key: 'email', label_th: 'อีเมล', label_en: 'Email', required: false },
      { key: 'phone_number', label_th: 'เบอร์โทรศัพท์', label_en: 'Phone Number', required: false },
      { key: 'birth_date', label_th: 'วันเกิด', label_en: 'Birth Date', required: false },
      { key: 'department_id', label_th: 'รหัสแผนก', label_en: 'Department ID', required: false },
      { key: 'position_th', label_th: 'ตำแหน่ง (ไทย)', label_en: 'Position (TH)', required: false },
      { key: 'position_en', label_th: 'ตำแหน่ง (อังกฤษ)', label_en: 'Position (EN)', required: false },
      { key: 'role', label_th: 'บทบาท', label_en: 'Role', required: false },
      { key: 'address_th', label_th: 'ที่อยู่ (ไทย)', label_en: 'Address (TH)', required: false },
      { key: 'emergency_contact_name', label_th: 'ชื่อผู้ติดต่อฉุกเฉิน', label_en: 'Emergency Contact Name', required: false },
      { key: 'emergency_contact_phone', label_th: 'เบอร์โทรผู้ติดต่อฉุกเฉิน', label_en: 'Emergency Contact Phone', required: false }
    ];

    // Create instructions sheet
    const instructionsData = [
      ['SSTH Leave Management System - Employee Data Entry Template'],
      [''],
      ['⚠️ REQUIRED FIELDS (8 fields - must fill):'],
      ['1. Employee Code - รหัสพนักงาน (must be unique)'],
      ['2. Scan Code - รหัสสแกน (for fingerprint/biometric)'],
      ['3. National ID - เลขบัตรประชาชน (must be unique, 13 digits)'],
      ['4. First Name (TH) - ชื่อภาษาไทย'],
      ['5. Last Name (TH) - นามสกุลภาษาไทย'],
      ['6. First Name (EN) - ชื่อภาษาอังกฤษ'],
      ['7. Last Name (EN) - นามสกุลภาษาอังกฤษ'],
      ['8. Hire Date - วันที่เริ่มงาน (format: YYYY-MM-DD)'],
      [''],
      ['✅ OPTIONAL FIELDS (can be blank):'],
      ['- Email (must be valid format if provided)'],
      ['- Phone Number, Birth Date, Department, Position, Role'],
      ['- Address, Emergency Contact (all optional)'],
      [''],
      ['Instructions:'],
      ['1. All fields marked with (*) are REQUIRED'],
      ['2. Date format: YYYY-MM-DD (e.g., 2024-01-15)'],
      ['3. Role: admin, hr, manager, or employee (default: employee)'],
      ['4. Department: use Department Code or ID from reference sheet'],
      ['5. Save as Excel (.xlsx) format'],
      [''],
      ['All Fields:'],
      ...templateColumns.map(col => [
        `${col.label_en} (${col.label_th})${col.required ? ' *' : ''}`,
        col.key
      ]),
      [''],
      [''],
      ['🔗 Department Reference:'],
      ['You can use either Department Name or Department ID:'],
      [''],
      ['Department Code | Name (TH) | Name (EN) | Department ID'],
      ['admin | ฝ่ายบริหาร | Admin | 661cdc26-b3f9-4273-9356-e393d7b1735c'],
      ['admin_hr | ฝ่ายบุคคล | HR | 6d5e5a4d-21dc-43a9-b20f-7f7513fd1a61'],
      ['marketing | ฝ่ายการตลาด | Marketing | 29e9bae2-95f2-4a67-9d6f-e2a6d366ec65'],
      ['qa_qc | ฝ่ายคุมคุณภ | QA/QC | 19a9a6b0-204d-4111-8d63-68369a29b014'],
      ['scm | ฝ่ายจัดการห่วโซอปุทาน | SCM | cd2caa8c-663d-4c2a-99ee-47c5a00c9f74'],
      ['production | ฝ่ายผลิต | Production | 52beb629-6bef-4c28-9222-165293eaa814'],
      ['maintenance | ฝ่ายบำรักษ | Maintenance | d286c9a3-36fe-4d44-8fe6-177f2edd63ab'],
      ['material | ฝ่ายวัสด | Material | fe9999b8-78db-4d92-9ac2-e2da3d12ff00'],
      ['rd | ฝ่ายวิจัยและพัฒนา | R&D | d67aff2d-4b68-4f4d-9bf9-35dfd00bf942'],
      ['coating | ฝ่ายเคลือบ | Coating | 577865dc-532a-4d7a-b311-6df6772b4353'],
      ['purchasing | ฝ่ายจัดซื้อ | Purchasing | f1660e7a-28eb-4539-93d1-4e60d2a53154'],
      ['old | ฝ่ายเก่า | Old | DELETED']
      // Add old departments here if they exist
    ];

    const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);

    // Style instructions sheet
    if (instructionsWs['A1']) {
      instructionsWs['A1'].s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'center' },
      };
    }

    // Merge title cells
    instructionsWs['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
    ];

    instructionsWs['!cols'] = [
      { wch: 30 }, { wch: 25 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

    // Create template data sheet
    const headers = templateColumns.map(col => ({
      [col.key]: `${col.label_en}${col.required ? ' *' : ''}`
    }));

    // Add sample row with default values
    const sampleRow: any = {};
    templateColumns.forEach(col => {
      if (col.key === 'role') {
        sampleRow[col.key] = 'employee';
      } else {
        sampleRow[col.key] = '';
      }
    });

    const templateData = [headers[0], sampleRow];
    const templateWs = XLSX.utils.json_to_sheet(templateData);

    // Apply styling to template headers
    const range = XLSX.utils.decode_range(templateWs['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!templateWs[cellAddress]) continue;

      templateWs[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '3B82F6' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000' } },
          left: { style: 'thin', color: { rgb: '000' } },
          right: { style: 'thin', color: { rgb: '000' } },
        },
      };
    }

    // Auto-fit columns
    const colWidths: { wch: number }[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      let maxWidth = 10;
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (templateWs[cellAddress] && templateWs[cellAddress].v) {
          const cellValue = String(templateWs[cellAddress].v);
          maxWidth = Math.max(maxWidth, cellValue.length);
        }
      }
      colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    }
    templateWs['!cols'] = colWidths;

    // Freeze header row
    templateWs['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, templateWs, 'Employee Data');

    // Create departments reference sheet
    const departmentsData = [
      ['Department Code | Name (TH) | Name (EN) | Department ID'],
      ...departments.map(dept => [
        dept.department_code,
        dept.name_th,
        dept.name_en,
        dept.id
      ])
    ];

    const departmentsWs = XLSX.utils.aoa_to_sheet(departmentsData);

    // Style departments sheet headers
    for (let col = 0; col < 4; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (departmentsWs[cellAddress]) {
        departmentsWs[cellAddress].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '3B82F6' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }
    }

    departmentsWs['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, departmentsWs, 'Departments');

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Employee_Template_${timestamp}.xlsx`;

    // Convert to buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return file response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: excelBuffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error: any) {
    console.error('Generate employee template error:', error.message);
    return errorResponse(error.message || 'Failed to generate template', 500);
  }
};

export const handler: Handler = requireAuth(generateEmployeeTemplate);