// src/components/employee/EmployeeExportModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FileDown, Check, Square, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api/auth';
import { useToast } from '../../hooks/useToast';

interface ExportField {
    key: string;
    label_th: string;
    label_en: string;
    defaultChecked: boolean;
    width: number;
}

// Define all available export fields
const EXPORT_FIELDS: ExportField[] = [
    { key: 'index', label_th: 'ลำดับ', label_en: 'No.', defaultChecked: true, width: 6 },
    { key: 'employee_code', label_th: 'รหัสพนักงาน', label_en: 'Employee Code', defaultChecked: true, width: 12 },
    { key: 'first_name_th', label_th: 'ชื่อ (ไทย)', label_en: 'First Name (TH)', defaultChecked: true, width: 15 },
    { key: 'last_name_th', label_th: 'นามสกุล (ไทย)', label_en: 'Last Name (TH)', defaultChecked: true, width: 15 },
    { key: 'first_name_en', label_th: 'ชื่อ (อังกฤษ)', label_en: 'First Name (EN)', defaultChecked: true, width: 15 },
    { key: 'last_name_en', label_th: 'นามสกุล (อังกฤษ)', label_en: 'Last Name (EN)', defaultChecked: true, width: 15 },
    { key: 'nickname', label_th: 'ชื่อเล่น', label_en: 'Nickname', defaultChecked: false, width: 10 },
    { key: 'email', label_th: 'อีเมล', label_en: 'Email', defaultChecked: true, width: 25 },
    { key: 'phone_number', label_th: 'เบอร์โทร', label_en: 'Phone', defaultChecked: true, width: 12 },
    { key: 'department', label_th: 'แผนก', label_en: 'Department', defaultChecked: true, width: 20 },
    { key: 'position', label_th: 'ตำแหน่ง', label_en: 'Position', defaultChecked: true, width: 20 },
    { key: 'role', label_th: 'บทบาท', label_en: 'Role', defaultChecked: true, width: 12 },
    { key: 'status', label_th: 'สถานะ', label_en: 'Status', defaultChecked: true, width: 12 },
    { key: 'hire_date', label_th: 'วันที่เริ่มงาน', label_en: 'Hire Date', defaultChecked: true, width: 12 },
    { key: 'national_id', label_th: 'เลขบัตรประชาชน', label_en: 'National ID', defaultChecked: false, width: 15 },
    { key: 'birth_date', label_th: 'วันเกิด', label_en: 'Birth Date', defaultChecked: false, width: 12 },
    { key: 'gender', label_th: 'เพศ', label_en: 'Gender', defaultChecked: false, width: 8 },
    { key: 'address', label_th: 'ที่อยู่', label_en: 'Address', defaultChecked: false, width: 40 },
    { key: 'emergency_contact', label_th: 'ผู้ติดต่อฉุกเฉิน', label_en: 'Emergency Contact', defaultChecked: false, width: 20 },
    { key: 'emergency_phone', label_th: 'เบอร์ฉุกเฉิน', label_en: 'Emergency Phone', defaultChecked: false, width: 12 },
    { key: 'bank_account', label_th: 'เลขบัญชีธนาคาร', label_en: 'Bank Account', defaultChecked: false, width: 15 },
    { key: 'bank_name', label_th: 'ธนาคาร', label_en: 'Bank Name', defaultChecked: false, width: 15 },
];

// Additional fields for resigned employees
const RESIGNATION_FIELDS: ExportField[] = [
    { key: 'resignation_date', label_th: 'วันที่ลาออก', label_en: 'Resignation Date', defaultChecked: true, width: 12 },
    { key: 'resignation_reason', label_th: 'เหตุผลการลาออก', label_en: 'Resignation Reason', defaultChecked: true, width: 30 },
];

interface EmployeeExportModalProps {
    onClose: () => void;
    employeeType: 'active' | 'resigned';
}

function translateRole(role: string, lang: string): string {
    const roles: Record<string, { th: string; en: string }> = {
        'admin': { th: 'ผู้ดูแลระบบ', en: 'Admin' },
        'hr': { th: 'ฝ่ายบุคคล', en: 'HR' },
        'manager': { th: 'ผู้จัดการ', en: 'Manager' },
        'employee': { th: 'พนักงาน', en: 'Employee' },
    };
    return lang === 'th' ? (roles[role]?.th || role) : (roles[role]?.en || role);
}

function translateStatus(status: string, lang: string): string {
    const statuses: Record<string, { th: string; en: string }> = {
        'active': { th: 'ใช้งาน', en: 'Active' },
        'inactive': { th: 'ลาออก', en: 'Inactive' },
        'suspended': { th: 'ระงับ', en: 'Suspended' },
    };
    return lang === 'th' ? (statuses[status]?.th || status) : (statuses[status]?.en || status);
}

function translateGender(gender: string, lang: string): string {
    const genders: Record<string, { th: string; en: string }> = {
        'male': { th: 'ชาย', en: 'Male' },
        'female': { th: 'หญิง', en: 'Female' },
        'other': { th: 'อื่นๆ', en: 'Other' },
    };
    return lang === 'th' ? (genders[gender]?.th || gender) : (genders[gender]?.en || gender);
}

export function EmployeeExportModal({ onClose, employeeType }: EmployeeExportModalProps) {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();

    // Combine fields based on employee type
    const availableFields = employeeType === 'resigned'
        ? [...EXPORT_FIELDS, ...RESIGNATION_FIELDS]
        : EXPORT_FIELDS;

    const getDefaultFields = () => {
        const defaultFields = availableFields.filter(f => f.defaultChecked).map(f => f.key);
        return defaultFields;
    };

    const [selectedFields, setSelectedFields] = useState<string[]>(getDefaultFields);
    const [exporting, setExporting] = useState(false);
    const [exportLanguage, setExportLanguage] = useState<'th' | 'en'>('th');

    const toggleField = (key: string) => {
        setSelectedFields(prev =>
            prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key]
        );
    };

    const selectAll = () => {
        setSelectedFields(availableFields.map(f => f.key));
    };

    const selectNone = () => {
        setSelectedFields([]);
    };

    const selectDefault = () => {
        setSelectedFields(getDefaultFields());
    };

    const handleExport = async () => {
        if (selectedFields.length === 0) {
            showToast(i18n.language === 'th' ? 'กรุณาเลือกอย่างน้อย 1 ฟิลด์' : 'Please select at least 1 field', 'warning');
            return;
        }

        setExporting(true);
        try {
            // Fetch employees
            const status = employeeType === 'active' ? 'active' : 'inactive';
            const response = await api.get<{ success: boolean; employees: any[] }>(
                `/employees?status=${status}`
            );

            const employees = response.data.employees;

            if (employees.length === 0) {
                throw new Error(
                    employeeType === 'active'
                        ? (i18n.language === 'th' ? 'ไม่พบพนักงานที่ใช้งาน' : 'No active employees found')
                        : (i18n.language === 'th' ? 'ไม่พบพนักงานที่ลาออก' : 'No resigned employees found')
                );
            }

            // Build Excel data based on selected fields
            const excelData = employees.map((emp, index) => {
                const row: Record<string, any> = {};

                // Get ordered fields
                const orderedFields = availableFields.filter(f => selectedFields.includes(f.key));

                orderedFields.forEach(field => {
                    const header = exportLanguage === 'th' ? field.label_th : field.label_en;

                    switch (field.key) {
                        case 'index':
                            row[header] = index + 1;
                            break;
                        case 'employee_code':
                            row[header] = emp.employee_code || '';
                            break;
                        case 'first_name_th':
                            row[header] = emp.first_name_th || (emp.name_th?.split(' ')[0]) || '';
                            break;
                        case 'last_name_th':
                            row[header] = emp.last_name_th || (emp.name_th?.split(' ').slice(1).join(' ')) || '';
                            break;
                        case 'first_name_en':
                            row[header] = emp.first_name_en || (emp.name_en?.split(' ')[0]) || '';
                            break;
                        case 'last_name_en':
                            row[header] = emp.last_name_en || (emp.name_en?.split(' ').slice(1).join(' ')) || '';
                            break;
                        case 'nickname':
                            row[header] = emp.nickname || '';
                            break;
                        case 'email':
                            row[header] = emp.email || '';
                            break;
                        case 'phone_number':
                            row[header] = emp.phone_number || '';
                            break;
                        case 'department':
                            row[header] = exportLanguage === 'th'
                                ? (emp.department_name_th || '')
                                : (emp.department_name_en || emp.department_name_th || '');
                            break;
                        case 'position':
                            row[header] = exportLanguage === 'th'
                                ? (emp.position_th || '')
                                : (emp.position_en || emp.position_th || '');
                            break;
                        case 'role':
                            row[header] = translateRole(emp.role || '', exportLanguage);
                            break;
                        case 'status':
                            row[header] = translateStatus(emp.status || '', exportLanguage);
                            break;
                        case 'hire_date':
                            row[header] = emp.hire_date || '';
                            break;
                        case 'national_id':
                            row[header] = emp.national_id || '';
                            break;
                        case 'birth_date':
                            row[header] = emp.birth_date || '';
                            break;
                        case 'gender':
                            row[header] = translateGender(emp.gender || '', exportLanguage);
                            break;
                        case 'address':
                            row[header] = emp.address || '';
                            break;
                        case 'emergency_contact':
                            row[header] = emp.emergency_contact_name || '';
                            break;
                        case 'emergency_phone':
                            row[header] = emp.emergency_contact_phone || '';
                            break;
                        case 'bank_account':
                            row[header] = emp.bank_account_number || '';
                            break;
                        case 'bank_name':
                            row[header] = emp.bank_name || '';
                            break;
                        // Resignation specific fields
                        case 'resignation_date':
                            row[header] = emp.resignation_date || '';
                            break;
                        case 'resignation_reason':
                            row[header] = emp.resignation_reason || '';
                            break;
                    }
                });

                return row;
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set column widths based on selected fields
            const orderedFields = availableFields.filter(f => selectedFields.includes(f.key));
            ws['!cols'] = orderedFields.map(f => ({ wch: f.width }));

            // Create workbook
            const wb = XLSX.utils.book_new();
            const sheetName = employeeType === 'active'
                ? (exportLanguage === 'th' ? 'พนักงานที่ใช้งาน' : 'Active Employees')
                : (exportLanguage === 'th' ? 'พนักงานที่ลาออก' : 'Resigned Employees');
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Generate filename with date
            const date = new Date().toISOString().split('T')[0];
            const filename = `${employeeType}_employees_${date}.xlsx`;

            // Download file
            XLSX.writeFile(wb, filename);

            onClose();
        } catch (error: any) {
            showToast(error.message || 'Export failed', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <FileDown className="w-6 h-6" />
                        <h2 className="text-xl font-semibold">
                            {i18n.language === 'th' ? 'ส่งออกข้อมูลพนักงาน' : 'Export Employee Data'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {/* Export Language Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'ภาษาที่ต้องการส่งออก' : 'Export Language'}
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="exportLanguage"
                                    value="th"
                                    checked={exportLanguage === 'th'}
                                    onChange={() => setExportLanguage('th')}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <span>🇹🇭 ไทย</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="exportLanguage"
                                    value="en"
                                    checked={exportLanguage === 'en'}
                                    onChange={() => setExportLanguage('en')}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <span>🇺🇸 English</span>
                            </label>
                        </div>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="mb-4 flex gap-2 flex-wrap">
                        <button
                            onClick={selectAll}
                            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                            {i18n.language === 'th' ? 'เลือกทั้งหมด' : 'Select All'}
                        </button>
                        <button
                            onClick={selectNone}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            {i18n.language === 'th' ? 'ยกเลิกทั้งหมด' : 'Clear All'}
                        </button>
                        <button
                            onClick={selectDefault}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                            {i18n.language === 'th' ? 'เลือกค่าเริ่มต้น' : 'Default Selection'}
                        </button>
                    </div>

                    {/* Field Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            {i18n.language === 'th'
                                ? `เลือกฟิลด์ที่ต้องการส่งออก (${selectedFields.length}/${availableFields.length})`
                                : `Select fields to export (${selectedFields.length}/${availableFields.length})`}
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {availableFields.map(field => {
                                const isSelected = selectedFields.includes(field.key);
                                // Highlight resignation fields with a different color
                                const isResignationField = RESIGNATION_FIELDS.some(f => f.key === field.key);
                                return (
                                    <button
                                        key={field.key}
                                        onClick={() => toggleField(field.key)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all ${isSelected
                                            ? isResignationField
                                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                                : 'bg-purple-50 border-purple-300 text-purple-800'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {isSelected ? (
                                            <CheckSquare className={`w-4 h-4 ${isResignationField ? 'text-amber-600' : 'text-purple-600'} shrink-0`} />
                                        ) : (
                                            <Square className="w-4 h-4 text-gray-400 shrink-0" />
                                        )}
                                        <span className="truncate">
                                            {i18n.language === 'th' ? field.label_th : field.label_en}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview Info */}
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                        <p className="font-medium text-gray-700 mb-1">
                            {i18n.language === 'th' ? 'ข้อมูลที่จะส่งออก:' : 'Export Preview:'}
                        </p>
                        <p>
                            {i18n.language === 'th'
                                ? `• พนักงาน${employeeType === 'active' ? 'ที่ใช้งาน' : 'ที่ลาออก'}`
                                : `• ${employeeType === 'active' ? 'Active' : 'Resigned'} employees`}
                        </p>
                        <p>
                            {i18n.language === 'th'
                                ? `• ${selectedFields.length} ฟิลด์`
                                : `• ${selectedFields.length} fields`}
                        </p>
                        <p>
                            {i18n.language === 'th'
                                ? `• ภาษา: ${exportLanguage === 'th' ? 'ไทย' : 'อังกฤษ'}`
                                : `• Language: ${exportLanguage === 'th' ? 'Thai' : 'English'}`}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 flex gap-3 justify-end bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting || selectedFields.length === 0}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <FileDown className="w-4 h-4" />
                        {exporting
                            ? (i18n.language === 'th' ? 'กำลังส่งออก...' : 'Exporting...')
                            : (i18n.language === 'th' ? 'ส่งออก Excel' : 'Export Excel')}
                    </button>
                </div>
            </div>
        </div>
    );
}


