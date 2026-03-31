// src/pages/ResignedEmployeesPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserMinus, Search, Download, ArrowLeft, Calendar, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Employee, getEmployees } from '../api/employee';
import { useToast } from '../hooks/useToast';
import { useDevice } from '../contexts/DeviceContext';
import { EmployeeExportModal } from '../components/employee/EmployeeExportModal';

export function ResignedEmployeesPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { deviceType, isMobile } = useDevice();
    const { showToast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);

    const isThaiLanguage = i18n.language === 'th';

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getEmployees({
                search: searchTerm,
                status: 'inactive', // Only get resigned/inactive employees
            });
            setEmployees(data);
        } catch (error: any) {
            console.error('Failed to load resigned employees:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const handleSearch = useCallback(() => {
        setSearchTerm(searchInput);
    }, [searchInput]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    }, [handleSearch]);

    const getContainerClass = () => {
        switch (deviceType) {
            case 'mobile': return 'px-4 py-3 max-w-full';
            case 'tablet': return 'px-6 py-4 max-w-6xl';
            default: return 'p-6 max-w-7xl mx-auto';
        }
    };

    if (loading) {
        return (
            <div className={getContainerClass()}>
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className={getContainerClass()}>
                {/* Header */}
                <div className={`${isMobile ? 'space-y-4' : 'flex items-center justify-between mb-6'}`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/employees')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <UserMinus className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-amber-600`} />
                        <div>
                            <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-gray-900`}>
                                {isThaiLanguage ? 'พนักงานที่ลาออก' : 'Resigned Employees'}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {isThaiLanguage
                                    ? 'รายชื่อพนักงานที่ลาออกแล้ว (เก็บไว้เพื่อการตรวจสอบ)'
                                    : 'List of resigned employees (kept for audit purposes)'}
                            </p>
                        </div>
                    </div>

                    {/* Export Button */}
                    {!isMobile && (
                        <button
                            onClick={() => setShowExportModal(true)}
                            disabled={employees.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            {isThaiLanguage ? 'ส่งออก Excel' : 'Export Excel'}
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex space-x-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={isThaiLanguage ? 'ค้นหาด้วยรหัสพนักงาน, ชื่อ...' : 'Search by code, name...'}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                        >
                            {isThaiLanguage ? 'ค้นหา' : 'Search'}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2">
                        <UserMinus className="w-5 h-5 text-amber-600" />
                        <span className="text-amber-800 font-medium">
                            {isThaiLanguage
                                ? `พบพนักงานที่ลาออก ${employees.length} คน`
                                : `Found ${employees.length} resigned employee(s)`}
                        </span>
                    </div>
                </div>

                {/* Employee List */}
                {employees.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <UserMinus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">
                            {isThaiLanguage ? 'ไม่พบพนักงานที่ลาออก' : 'No resigned employees found'}
                        </p>
                    </div>
                ) : isMobile ? (
                    // Mobile Card View
                    <div className="space-y-3">
                        {employees.map((employee) => (
                            <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-semibold text-gray-900">{employee.employee_code}</p>
                                        <p className="text-sm text-gray-700 mt-1">
                                            {isThaiLanguage ? employee.name_th : employee.name_en}
                                        </p>
                                        <p className="text-xs text-gray-500">{employee.email}</p>
                                    </div>
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                                        {isThaiLanguage ? 'ลาออก' : 'Resigned'}
                                    </span>
                                </div>
                                <div className="space-y-2 pt-3 border-t border-gray-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{isThaiLanguage ? 'แผนก' : 'Department'}</span>
                                        <span className="text-gray-900">
                                            {isThaiLanguage
                                                ? (employee.department_name_th || '-')
                                                : (employee.department_name_en || '-')}
                                        </span>
                                    </div>
                                    {(employee as any).resignation_date && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {isThaiLanguage ? 'วันที่ลาออก' : 'Resign Date'}
                                            </span>
                                            <span className="text-red-600 font-medium">
                                                {(employee as any).resignation_date}
                                            </span>
                                        </div>
                                    )}
                                    {(employee as any).resignation_reason && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <FileText className="w-3 h-3" />
                                                {isThaiLanguage ? 'เหตุผล' : 'Reason'}
                                            </span>
                                            <span className="text-gray-700 text-right max-w-[150px] truncate">
                                                {(employee as any).resignation_reason}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Desktop Table View
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {isThaiLanguage ? 'รหัสพนักงาน' : 'Employee Code'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {isThaiLanguage ? 'ชื่อ-นามสกุล' : 'Name'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {isThaiLanguage ? 'แผนก' : 'Department'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {isThaiLanguage ? 'ตำแหน่ง' : 'Position'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {isThaiLanguage ? 'วันที่ลาออก' : 'Resign Date'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            {isThaiLanguage ? 'เหตุผล' : 'Reason'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {employees.map((employee) => (
                                        <tr key={employee.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-medium text-gray-900">{employee.employee_code}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {isThaiLanguage ? employee.name_th : employee.name_en}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{employee.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-gray-900">
                                                    {isThaiLanguage
                                                        ? (employee.department_name_th || '-')
                                                        : (employee.department_name_en || '-')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-gray-900">
                                                    {isThaiLanguage
                                                        ? (employee.position_th || '-')
                                                        : (employee.position_en || '-')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-red-600 font-medium">
                                                    {(employee as any).resignation_date || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-gray-700 max-w-[200px] block truncate">
                                                    {(employee as any).resignation_reason || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Mobile Export Button */}
                {isMobile && employees.length > 0 && (
                    <div className="fixed bottom-4 left-4 right-4 z-40">
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg shadow-lg hover:bg-green-700 transition-colors"
                        >
                            <Download className="w-5 h-5" />
                            {isThaiLanguage ? 'ส่งออก Excel' : 'Export Excel'}
                        </button>
                    </div>
                )}

                {/* Export Modal */}
                {showExportModal && (
                    <EmployeeExportModal
                        onClose={() => setShowExportModal(false)}
                        employeeType="resigned"
                    />
                )}
            </div>
        </div>
    );
}
