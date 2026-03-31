import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Upload, Download, Plus, Search, Filter, History, CalendarClock, ArrowLeftRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/auth';
import { OffDaysImportModal } from '../components/off-days/OffDaysImportModal';
import { OffDayFormModal } from '../components/off-days/OffDayFormModal';
import { ShiftSwapHistory } from '../components/shift/ShiftSwapHistory';
import { ShiftSwapForm } from '../components/shift/ShiftSwapForm'; // Make sure this is exported/available

interface OffDay {
    id: string;
    employee_id: string;
    employee_code: string;
    employee_name_en: string;
    employee_name_th: string;
    department_name_en: string;
    department_name_th: string;
    off_date: string;
    off_type: string;
    notes: string | null;
}

interface Department {
    id: string;
    name_en: string;
    name_th: string;
}

export function OffDaysManagementPage() {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<'saturday' | 'shift'>('saturday');

    // Saturday Off-Days State
    const [offDays, setOffDays] = useState<OffDay[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // Shift Swap State
    const [showShiftForm, setShowShiftForm] = useState(false);
    const [shiftRefreshKey, setShiftRefreshKey] = useState(0);

    useEffect(() => {
        loadDepartments();
    }, []);

    useEffect(() => {
        if (activeTab === 'saturday') {
            loadOffDays();
        }
    }, [selectedDepartment, currentYear, activeTab]);

    const loadDepartments = async () => {
        try {
            const response = await api.get('/departments');
            const deptData = response.data;
            setDepartments(Array.isArray(deptData) ? deptData : []);
        } catch (error) {
            console.error('Failed to load departments:', error);
            setDepartments([]);
        }
    };

    const loadOffDays = async () => {
        try {
            setLoading(true);
            const startDate = `${currentYear}-01-01`;
            const endDate = `${currentYear}-12-31`;

            let url = `/employee-off-days?start_date=${startDate}&end_date=${endDate}`;
            if (selectedDepartment) {
                url += `&department_id=${selectedDepartment}`;
            }

            const response = await api.get(url);
            const offDaysData = response.data?.off_days;
            setOffDays(Array.isArray(offDaysData) ? offDaysData : []);
        } catch (error) {
            console.error('Failed to load off-days:', error);
            setOffDays([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredOffDays = offDays.filter(offDay => {
        if (!searchQuery) return true;
        const search = searchQuery.toLowerCase();
        return (
            offDay.employee_code?.toLowerCase().includes(search) ||
            offDay.employee_name_en?.toLowerCase().includes(search) ||
            offDay.employee_name_th?.toLowerCase().includes(search)
        );
    });

    const groupedByEmployee = filteredOffDays.reduce((acc, offDay) => {
        const key = offDay.employee_id;
        if (!acc[key]) {
            acc[key] = {
                employee_id: offDay.employee_id,
                employee_code: offDay.employee_code,
                employee_name_en: offDay.employee_name_en,
                employee_name_th: offDay.employee_name_th,
                department_name_en: offDay.department_name_en,
                department_name_th: offDay.department_name_th,
                off_days: [],
            };
        }
        acc[key].off_days.push(offDay);
        return acc;
    }, {} as Record<string, any>);

    const employees = Object.values(groupedByEmployee);

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = ['Employee Code', 'Group', 'Notes'];
        const examples = [
            ['200811002', 'Group A', 'เริ่ม 10 ม.ค. 2026'],
            ['202505001', 'Group B', 'เริ่ม 17 ม.ค. 2026'],
        ];
        const wsData = [headers, ...examples];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Off-Days Template');
        XLSX.writeFile(wb, 'employee-off-days-template-2026.xlsx');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {i18n.language === 'th' ? 'จัดการเสาร์วันหยุด' : 'Manage Saturday Off-Days'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {i18n.language === 'th'
                                ? 'จัดการวันหยุดเสาร์และสลับวันหยุดของพนักงาน'
                                : 'Manage Saturday off-days and shift swaps'}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('saturday')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'saturday'
                                ? 'bg-white text-purple-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <CalendarClock className="w-4 h-4" />
                            {i18n.language === 'th' ? 'วันหยุดเสาร์' : 'Saturday Off'}
                        </button>
                        <button
                            onClick={() => setActiveTab('shift')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'shift'
                                ? 'bg-white text-purple-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <ArrowLeftRight className="w-4 h-4" />
                            {i18n.language === 'th' ? 'สลับวันหยุด' : 'Shift Swaps'}
                        </button>
                    </div>
                </div>

                {activeTab === 'saturday' && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentYear(currentYear - 1)}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                ← {i18n.language === 'th' ? currentYear - 1 + 543 : currentYear - 1}
                            </button>
                            <div className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">
                                {i18n.language === 'th' ? currentYear + 543 : currentYear}
                            </div>
                            <button
                                onClick={() => setCurrentYear(currentYear + 1)}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                {i18n.language === 'th' ? currentYear + 1 + 543 : currentYear + 1} →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {activeTab === 'saturday' ? (
                <>
                    {/* Filters & Actions for Saturday Off */}
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Department Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Filter className="w-4 h-4 inline mr-1" />
                                    {i18n.language === 'th' ? 'แผนก' : 'Department'}
                                </label>
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">{i18n.language === 'th' ? 'ทุกแผนก' : 'All Departments'}</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>
                                            {i18n.language === 'th' ? dept.name_th : dept.name_en}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Search */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Search className="w-4 h-4 inline mr-1" />
                                    {i18n.language === 'th' ? 'ค้นหาพนักงาน' : 'Search Employee'}
                                </label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={i18n.language === 'th' ? 'รหัสหรือชื่อพนักงาน' : 'Employee code or name'}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={() => setShowFormModal(true)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex-1 md:flex-none"
                                >
                                    <Plus className="w-4 h-4" />
                                    {i18n.language === 'th' ? 'ตารางวันหยุด' : 'Add Off-Day'}
                                </button>
                                <button
                                    onClick={() => setShowImportModal(true)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-1 md:flex-none"
                                >
                                    <Upload className="w-4 h-4" />
                                    Excel
                                </button>
                                <button
                                    onClick={downloadTemplate}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-1 md:flex-none"
                                >
                                    <Download className="w-4 h-4" />
                                    Template
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Employee List */}
                    {loading ? (
                        <div className="bg-white rounded-lg shadow p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                            <p className="mt-4 text-gray-600">
                                {i18n.language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                            </p>
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                            {i18n.language === 'th' ? 'ไม่พบข้อมูลวันหยุด' : 'No off-days found'}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {employees.map((employee) => (
                                <div key={employee.employee_id} className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                                    {/* Employee Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                {i18n.language === 'th' ? employee.employee_name_th : employee.employee_name_en}
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                    {employee.employee_code}
                                                </span>
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                                <span>{i18n.language === 'th' ? employee.department_name_th : employee.department_name_en}</span>
                                                <span>•</span>
                                                <span className="font-medium text-purple-600">{employee.off_days.length} {i18n.language === 'th' ? 'วันหยุด' : 'off-days'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Off-Days Grid */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                        {(Array.isArray(employee.off_days) ? employee.off_days : [])
                                            .sort((a: OffDay, b: OffDay) => a.off_date.localeCompare(b.off_date))
                                            .map((offDay: OffDay) => {
                                                const date = new Date(offDay.off_date);
                                                const monthNames = i18n.language === 'th'
                                                    ? ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
                                                    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                                                // Check if passed
                                                const isPassed = new Date(offDay.off_date) < new Date();

                                                return (
                                                    <div
                                                        key={offDay.id}
                                                        className={`rounded-lg p-2 text-center border ${isPassed
                                                            ? 'bg-gray-50 border-gray-200 text-gray-400'
                                                            : 'bg-purple-50 border-purple-200 text-purple-900'
                                                            }`}
                                                    >
                                                        <div className="text-xs font-medium opacity-70">
                                                            {monthNames[date.getMonth()]}
                                                        </div>
                                                        <div className="text-lg font-bold">
                                                            {date.getDate()}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* Shift Swap Tab Content */
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowShiftForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            {i18n.language === 'th' ? 'สลับวันหยุด' : 'Shift Swap'}
                        </button>
                    </div>

                    <ShiftSwapHistory key={`shift-history-${shiftRefreshKey}`} />

                    {showShiftForm && (
                        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                            <ShiftSwapForm
                                onSuccess={() => {
                                    setShowShiftForm(false);
                                    setShiftRefreshKey(prev => prev + 1);
                                }}
                                onCancel={() => setShowShiftForm(false)}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <OffDaysImportModal
                    onSuccess={() => {
                        loadOffDays();
                    }}
                    onClose={() => setShowImportModal(false)}
                />
            )}

            {/* Add/Edit Off-Day Modal */}
            {showFormModal && (
                <OffDayFormModal
                    onSuccess={() => {
                        loadOffDays();
                    }}
                    onClose={() => setShowFormModal(false)}
                />
            )}
        </div>
    );
}
