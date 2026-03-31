// src/api/employeeExport.ts

import * as XLSX from 'xlsx';
import api from './auth';

interface EmployeeExportData {
    employee_code: string;
    first_name_th: string;
    last_name_th: string;
    first_name_en?: string;
    last_name_en?: string;
    email: string;
    phone_number?: string;
    department_name_th?: string;
    department_name_en?: string;
    position_th?: string;
    position_en?: string;
    role: string;
    status: string;
    hire_date?: string;
    national_id?: string;
}

/**
 * Export active employees to Excel (excluding resigned/inactive)
 */
export const exportActiveEmployees = async (): Promise<void> => {
    try {
        // Fetch only active employees
        const response = await api.get<{ success: boolean; employees: any[] }>(
            '/employees?status=active'
        );

        const employees = response.data.employees;

        if (employees.length === 0) {
            throw new Error('No active employees found');
        }

        // Transform data for Excel
        const excelData = employees.map((emp, index) => {
            // Try to get separate first/last names, or split from combined name
            const firstNameTh = emp.first_name_th || (emp.name_th?.split(' ')[0]) || '';
            const lastNameTh = emp.last_name_th || (emp.name_th?.split(' ').slice(1).join(' ')) || '';
            const firstNameEn = emp.first_name_en || (emp.name_en?.split(' ')[0]) || '';
            const lastNameEn = emp.last_name_en || (emp.name_en?.split(' ').slice(1).join(' ')) || '';

            return {
                'ลำดับ': index + 1,
                'รหัสพนักงาน': emp.employee_code || '',
                'ชื่อ (ไทย)': firstNameTh,
                'นามสกุล (ไทย)': lastNameTh,
                'ชื่อ (อังกฤษ)': firstNameEn,
                'นามสกุล (อังกฤษ)': lastNameEn,
                'Email': emp.email || '',
                'เบอร์โทร': emp.phone_number || '',
                'แผนก': emp.department_name_th || '',
                'ตำแหน่ง': emp.position_th || '',
                'บทบาท': translateRole(emp.role || ''),
                'วันที่เริ่มงาน': emp.hire_date || '',
                'เลขบัตรประชาชน': emp.national_id || '',
            };
        });

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        ws['!cols'] = [
            { wch: 6 },   // ลำดับ
            { wch: 12 },  // รหัสพนักงาน
            { wch: 15 },  // ชื่อ (ไทย)
            { wch: 15 },  // นามสกุล (ไทย)
            { wch: 15 },  // ชื่อ (อังกฤษ)
            { wch: 15 },  // นามสกุล (อังกฤษ)
            { wch: 25 },  // Email
            { wch: 12 },  // เบอร์โทร
            { wch: 20 },  // แผนก
            { wch: 20 },  // ตำแหน่ง
            { wch: 12 },  // บทบาท
            { wch: 12 },  // วันที่เริ่มงาน
            { wch: 15 },  // เลขบัตรประชาชน
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'พนักงานที่ใช้งาน');

        // Generate filename with date
        const date = new Date().toISOString().split('T')[0];
        const filename = `active_employees_${date}.xlsx`;

        // Download file
        XLSX.writeFile(wb, filename);

    } catch (error: any) {
        throw new Error(error.message || 'Failed to export employees');
    }
};

/**
 * Export resigned employees to Excel
 */
export const exportResignedEmployees = async (): Promise<void> => {
    try {
        // Fetch only inactive employees
        const response = await api.get<{ success: boolean; employees: any[] }>(
            '/employees?status=inactive'
        );

        const employees = response.data.employees;

        if (employees.length === 0) {
            throw new Error('No resigned employees found');
        }

        // Transform data for Excel
        const excelData = employees.map((emp, index) => {
            // Try to get separate first/last names, or split from combined name
            const firstNameTh = emp.first_name_th || (emp.name_th?.split(' ')[0]) || '';
            const lastNameTh = emp.last_name_th || (emp.name_th?.split(' ').slice(1).join(' ')) || '';

            return {
                'ลำดับ': index + 1,
                'รหัสพนักงาน': emp.employee_code || '',
                'ชื่อ (ไทย)': firstNameTh,
                'นามสกุล (ไทย)': lastNameTh,
                'Email': emp.email || '',
                'แผนก': emp.department_name_th || '',
                'ตำแหน่ง': emp.position_th || '',
                'วันที่เริ่มงาน': emp.hire_date || '',
                'วันที่ลาออก': emp.resignation_date || '',
                'เหตุผลการลาออก': emp.resignation_reason || '',
            };
        });

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        ws['!cols'] = [
            { wch: 6 },   // ลำดับ
            { wch: 12 },  // รหัสพนักงาน
            { wch: 15 },  // ชื่อ (ไทย)
            { wch: 15 },  // นามสกุล (ไทย)
            { wch: 25 },  // Email
            { wch: 20 },  // แผนก
            { wch: 20 },  // ตำแหน่ง
            { wch: 12 },  // วันที่เริ่มงาน
            { wch: 12 },  // วันที่ลาออก
            { wch: 30 },  // เหตุผลการลาออก
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'พนักงานที่ลาออก');

        // Generate filename with date
        const date = new Date().toISOString().split('T')[0];
        const filename = `resigned_employees_${date}.xlsx`;

        // Download file
        XLSX.writeFile(wb, filename);

    } catch (error: any) {
        throw new Error(error.message || 'Failed to export resigned employees');
    }
};

function translateRole(role: string): string {
    const roles: Record<string, string> = {
        'admin': 'ผู้ดูแลระบบ',
        'hr': 'ฝ่ายบุคคล',
        'manager': 'ผู้จัดการ',
        'employee': 'พนักงาน',
    };
    return roles[role] || role;
}
