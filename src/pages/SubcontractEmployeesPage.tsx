// src/pages/SubcontractEmployeesPage.tsx
// Management page for subcontract employees

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users,
    Plus,
    Search,
    RefreshCw,
    Edit2,
    Trash2,
    Building2,
    X,
    Check,
    Download,
    Upload,
} from 'lucide-react';
import {
    getSubcontractEmployees,
    createSubcontractEmployee,
    updateSubcontractEmployee,
    deactivateSubcontractEmployee,
    getSubcontractCompanies,
    getManufacturingLines,
} from '../api/attendance';
import { downloadSubcontractTemplate, importSubcontractEmployees } from '../api/subcontractImport';
import type {
    SubcontractEmployee,
    SubcontractEmployeeFormData,
    ManufacturingLine,
    ShiftType,
} from '../types/attendance';
import { SHIFT_NAMES } from '../types/attendance';
import { useToast } from '../hooks/useToast';

export function SubcontractEmployeesPage() {
    const { i18n } = useTranslation();
    const { showToast, showModal: showConfirmModal } = useToast();
    const isThaiLanguage = i18n.language === 'th';

    // State
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState<SubcontractEmployee[]>([]);
    const [lines, setLines] = useState<ManufacturingLine[]>([]);
    const [companies, setCompanies] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLine, setFilterLine] = useState<string>('');
    const [filterShift, setFilterShift] = useState<ShiftType | ''>('');
    const [filterCompany, setFilterCompany] = useState<string>('');
    const [showInactive, setShowInactive] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<SubcontractEmployee | null>(null);
    const [formData, setFormData] = useState<SubcontractEmployeeFormData>({
        employee_code: '',
        first_name_th: '',
        last_name_th: '',
        company_name: '',
        shift: 'day',
        hire_date: new Date().toISOString().split('T')[0],
    });
    const [submitting, setSubmitting] = useState(false);
    const [importing, setImporting] = useState(false);

    // Handle template download
    const handleDownloadTemplate = async () => {
        try {
            await downloadSubcontractTemplate();
        } catch (error: any) {
            showToast(error.message || 'Failed to download template', 'error');
        }
    };

    // Handle file import
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        // Clear input value so same file can be selected again
        e.target.value = '';

        try {
            const result = await importSubcontractEmployees(file);
            showToast(
                isThaiLanguage
                    ? `นำเข้าสำเร็จ: ${result.successCount} คน, ผิดพลาด: ${result.errorCount} คน`
                    : `Imported: ${result.successCount}, Failed: ${result.errorCount}`,
                result.errorCount > 0 ? 'warning' : 'success'
            );
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Import failed', 'error');
        } finally {
            setImporting(false);
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [employeesData, linesData, companiesData] = await Promise.all([
                getSubcontractEmployees({ active_only: !showInactive }),
                getManufacturingLines({ active_only: true }),
                getSubcontractCompanies(),
            ]);

            setEmployees(employeesData);
            setLines(linesData);
            setCompanies(companiesData);
        } catch (error: any) {
            showToast(error.message || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, [showInactive, showToast]);

    // Load data
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter employees
    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matches =
                    emp.employee_code.toLowerCase().includes(search) ||
                    emp.first_name_th.toLowerCase().includes(search) ||
                    emp.last_name_th.toLowerCase().includes(search) ||
                    emp.nickname?.toLowerCase().includes(search) ||
                    emp.company_name.toLowerCase().includes(search);
                if (!matches) return false;
            }

            // Line filter
            if (filterLine && emp.line_id !== filterLine) return false;

            // Shift filter
            if (filterShift && emp.shift !== filterShift) return false;

            // Company filter
            if (filterCompany && emp.company_name !== filterCompany) return false;

            return true;
        });
    }, [employees, searchTerm, filterLine, filterShift, filterCompany]);

    // Group by company
    const groupedEmployees = useMemo(() => {
        const groups: Record<string, SubcontractEmployee[]> = {};
        filteredEmployees.forEach((emp) => {
            const company = emp.company_name || 'Unknown';
            if (!groups[company]) groups[company] = [];
            groups[company].push(emp);
        });
        return groups;
    }, [filteredEmployees]);

    // Open add modal
    const openAddModal = () => {
        setEditingEmployee(null);
        setFormData({
            employee_code: '',
            first_name_th: '',
            last_name_th: '',
            company_name: companies[0] || '',
            shift: 'day',
            hire_date: new Date().toISOString().split('T')[0],
        });
        setShowModal(true);
    };

    // Open edit modal
    const openEditModal = (employee: SubcontractEmployee) => {
        setEditingEmployee(employee);
        setFormData({
            employee_code: employee.employee_code,
            first_name_th: employee.first_name_th,
            last_name_th: employee.last_name_th,
            first_name_en: employee.first_name_en || '',
            last_name_en: employee.last_name_en || '',
            nickname: employee.nickname || '',
            company_name: employee.company_name,
            company_code: employee.company_code || '',
            line_id: employee.line_id || '',
            shift: employee.shift,
            position_th: employee.position_th || '',
            position_en: employee.position_en || '',
            phone_number: employee.phone_number || '',
            national_id: employee.national_id || '',
            hire_date: employee.hire_date,
            hourly_rate: employee.hourly_rate || undefined,
            notes: employee.notes || '',
        });
        setShowModal(true);
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (editingEmployee) {
                await updateSubcontractEmployee(editingEmployee.id, formData);
                showToast(
                    isThaiLanguage ? 'อัปเดตข้อมูลสำเร็จ' : 'Employee updated successfully',
                    'success'
                );
            } else {
                await createSubcontractEmployee(formData);
                showToast(
                    isThaiLanguage ? 'เพิ่มพนักงานสำเร็จ' : 'Employee added successfully',
                    'success'
                );
            }

            setShowModal(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Failed to save employee', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle deactivate
    const handleDeactivate = async (employee: SubcontractEmployee) => {
        const confirmed = await showConfirmModal('confirm', isThaiLanguage ? 'ยืนยันการยกเลิก' : 'Confirm Deactivation', {
            message: isThaiLanguage
                ? `ต้องการยกเลิกการทำงานของ ${employee.first_name_th} ${employee.last_name_th}?`
                : `Are you sure you want to deactivate ${employee.first_name_th} ${employee.last_name_th}?`,
            confirmText: isThaiLanguage ? 'ยืนยัน' : 'Confirm',
            cancelText: isThaiLanguage ? 'ยกเลิก' : 'Cancel',
        });

        if (!confirmed) {
            return;
        }

        try {
            await deactivateSubcontractEmployee(employee.id);
            showToast(
                isThaiLanguage ? 'ยกเลิกการทำงานสำเร็จ' : 'Employee deactivated',
                'success'
            );
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Failed to deactivate', 'error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {isThaiLanguage ? 'พนักงานรับเหมา' : 'Subcontract Employees'}
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    {isThaiLanguage
                                        ? 'จัดการข้อมูลพนักงานรับเหมาช่วง'
                                        : 'Manage subcontract worker information'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => loadData()}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Import/Export Actions */}
                            <div className="flex items-center gap-2 border-l border-gray-200 pl-2 ml-2">
                                <button
                                    onClick={handleDownloadTemplate}
                                    disabled={importing}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title={isThaiLanguage ? 'ดาวน์โหลดแบบฟอร์ม' : 'Download Template'}
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleImport}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={importing}
                                    />
                                    <button
                                        disabled={importing}
                                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                        title={isThaiLanguage ? 'นำเข้าข้อมูล' : 'Import Employees'}
                                    >
                                        {importing ? (
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Upload className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={openAddModal}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all flex items-center gap-2 ml-2"
                            >
                                <Plus className="w-5 h-5" />
                                {isThaiLanguage ? 'เพิ่มพนักงาน' : 'Add Employee'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={isThaiLanguage ? 'ค้นหาพนักงาน...' : 'Search employees...'}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            />
                        </div>

                        {/* Line Filter */}
                        <select
                            value={filterLine}
                            onChange={(e) => setFilterLine(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        >
                            <option value="">{isThaiLanguage ? 'ทุกไลน์' : 'All Lines'}</option>
                            {lines.map((line) => (
                                <option key={line.id} value={line.id}>
                                    {line.code}
                                </option>
                            ))}
                        </select>

                        {/* Shift Filter */}
                        <select
                            value={filterShift}
                            onChange={(e) => setFilterShift(e.target.value as ShiftType | '')}
                            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        >
                            <option value="">{isThaiLanguage ? 'ทุกกะ' : 'All Shifts'}</option>
                            {(['day', 'night_ab', 'night_cd'] as const).map((s) => (
                                <option key={s} value={s}>
                                    {SHIFT_NAMES[s][isThaiLanguage ? 'th' : 'en']}
                                </option>
                            ))}
                        </select>

                        {/* Company Filter */}
                        <select
                            value={filterCompany}
                            onChange={(e) => setFilterCompany(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        >
                            <option value="">{isThaiLanguage ? 'ทุกบริษัท' : 'All Companies'}</option>
                            {companies.map((company) => (
                                <option key={company} value={company}>
                                    {company}
                                </option>
                            ))}
                        </select>

                        {/* Show Inactive Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">
                                {isThaiLanguage ? 'แสดงคนที่ออกแล้ว' : 'Show inactive'}
                            </span>
                        </label>
                    </div>
                </div>

                {/* Employee Count */}
                <div className="mb-4 text-sm text-gray-600">
                    {isThaiLanguage
                        ? `พบ ${filteredEmployees.length} คน จากทั้งหมด ${employees.length} คน`
                        : `Showing ${filteredEmployees.length} of ${employees.length} employees`}
                </div>

                {/* Employee List */}
                {loading ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">{isThaiLanguage ? 'กำลังโหลด...' : 'Loading...'}</p>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">{isThaiLanguage ? 'ไม่พบพนักงาน' : 'No employees found'}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedEmployees).map(([company, emps]) => (
                            <div key={company} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                {/* Company Header */}
                                <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-gray-600" />
                                            <h2 className="text-lg font-semibold text-gray-900">{company}</h2>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {emps.length} {isThaiLanguage ? 'คน' : 'employees'}
                                        </span>
                                    </div>
                                </div>

                                {/* Employee Cards */}
                                <div className="divide-y divide-gray-100">
                                    {emps.map((emp) => (
                                        <div
                                            key={emp.id}
                                            className={`px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 ${!emp.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                                                } transition-colors`}
                                        >
                                            {/* Avatar & Info */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${emp.is_active ? 'bg-blue-500' : 'bg-gray-400'
                                                    }`}>
                                                    {emp.first_name_th.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-900">
                                                        {emp.first_name_th} {emp.last_name_th}
                                                        {emp.nickname && (
                                                            <span className="text-gray-500 font-normal ml-1">
                                                                ({emp.nickname})
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{emp.employee_code}</p>
                                                </div>
                                            </div>

                                            {/* Line Badge */}
                                            <div className="md:w-24">
                                                {emp.line_code ? (
                                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                                        {emp.line_code}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </div>

                                            {/* Shift Badge */}
                                            <div className="md:w-24">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${emp.shift === 'day'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                    {SHIFT_NAMES[emp.shift][isThaiLanguage ? 'th' : 'en']}
                                                </span>
                                            </div>

                                            {/* Status */}
                                            <div className="md:w-20">
                                                {emp.is_active ? (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                                        {isThaiLanguage ? 'ทำงาน' : 'Active'}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                        {isThaiLanguage ? 'ออกแล้ว' : 'Inactive'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(emp)}
                                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title={isThaiLanguage ? 'แก้ไข' : 'Edit'}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {emp.is_active && (
                                                    <button
                                                        onClick={() => handleDeactivate(emp)}
                                                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={isThaiLanguage ? 'ลบ' : 'Deactivate'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">
                                {editingEmployee
                                    ? (isThaiLanguage ? 'แก้ไขข้อมูลพนักงาน' : 'Edit Employee')
                                    : (isThaiLanguage ? 'เพิ่มพนักงานใหม่' : 'Add New Employee')}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Employee Code */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {isThaiLanguage ? 'รหัสพนักงาน' : 'Employee Code'} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.employee_code}
                                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Name Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isThaiLanguage ? 'ชื่อ (ไทย)' : 'First Name (TH)'} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.first_name_th}
                                        onChange={(e) => setFormData({ ...formData, first_name_th: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isThaiLanguage ? 'นามสกุล (ไทย)' : 'Last Name (TH)'} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.last_name_th}
                                        onChange={(e) => setFormData({ ...formData, last_name_th: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Nickname */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {isThaiLanguage ? 'ชื่อเล่น' : 'Nickname'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.nickname || ''}
                                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Company */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {isThaiLanguage ? 'บริษัทรับเหมา' : 'Subcontract Company'} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    required
                                    list="companies"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <datalist id="companies">
                                    {companies.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Line & Shift */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isThaiLanguage ? 'ไลน์การผลิต' : 'Production Line'}
                                    </label>
                                    <select
                                        value={formData.line_id || ''}
                                        onChange={(e) => setFormData({ ...formData, line_id: e.target.value || undefined })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="">{isThaiLanguage ? 'ไม่ระบุ' : 'Not Assigned'}</option>
                                        {lines.map((line) => (
                                            <option key={line.id} value={line.id}>
                                                {line.code} - {isThaiLanguage ? line.name_th : line.name_en}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isThaiLanguage ? 'กะทำงาน' : 'Shift'} *
                                    </label>
                                    <select
                                        value={formData.shift}
                                        onChange={(e) => setFormData({ ...formData, shift: e.target.value as ShiftType })}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        {(['day', 'night_ab', 'night_cd'] as const).map((s) => (
                                            <option key={s} value={s}>
                                                {SHIFT_NAMES[s][isThaiLanguage ? 'th' : 'en']}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Hire Date & Phone */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isThaiLanguage ? 'วันเริ่มงาน' : 'Hire Date'} *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.hire_date}
                                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isThaiLanguage ? 'เบอร์โทร' : 'Phone Number'}
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone_number || ''}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {isThaiLanguage ? 'หมายเหตุ' : 'Notes'}
                                </label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {isThaiLanguage ? 'ยกเลิก' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    {isThaiLanguage ? 'บันทึก' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SubcontractEmployeesPage;
