import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Users, FileText, Search, ChevronDown } from 'lucide-react';
import api from '../../api/auth';
import { DatePicker } from '../common/DatePicker';
import { useToast } from '../../hooks/useToast';

interface OffDay {
    id?: string;
    employee_id: string | number;
    off_date: string;
    off_type: string;
    notes: string;
}

interface Employee {
    id: string | number;
    employee_code: string;
    first_name_en: string;
    last_name_en: string;
    first_name_th: string;
    last_name_th: string;
}

interface Props {
    offDay?: OffDay | null;
    employeeId?: string | number;
    onSuccess: () => void;
    onClose: () => void;
}

const OFF_TYPES = [
    { value: 'alternating_saturday', labelTh: 'เสาร์เว้นเสาร์', labelEn: 'Alternating Saturday' },
    { value: 'weekly_saturday', labelTh: 'เสาร์ทุกสัปดาห์', labelEn: 'Weekly Saturday' },
    { value: 'weekly_sunday', labelTh: 'อาทิตย์ทุกสัปดาห์', labelEn: 'Weekly Sunday' },
    { value: 'custom', labelTh: 'กำหนดเอง', labelEn: 'Custom' },
];

export function OffDayFormModal({ offDay, employeeId, onSuccess, onClose }: Props) {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeOffDays, setEmployeeOffDays] = useState<string[]>([]); // ✅ State for existing off-days
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState({
        employee_id: employeeId?.toString() || offDay?.employee_id?.toString() || '',
        off_date: offDay?.off_date || '',
        off_type: offDay?.off_type || 'alternating_saturday',
        notes: offDay?.notes || '',
    });

    // Filter employees based on search query
    const filteredEmployees = useMemo(() => {
        if (!searchQuery.trim()) return employees;
        const query = searchQuery.toLowerCase().trim();
        return employees.filter(emp =>
            emp.employee_code.toLowerCase().includes(query) ||
            `${emp.first_name_th} ${emp.last_name_th}`.toLowerCase().includes(query) ||
            `${emp.first_name_en} ${emp.last_name_en}`.toLowerCase().includes(query)
        );
    }, [employees, searchQuery]);

    // Get selected employee display text
    const selectedEmployee = useMemo(() => {
        if (!formData.employee_id) return null;
        return employees.find(emp => emp.id.toString() === formData.employee_id);
    }, [employees, formData.employee_id]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isEditMode = !!offDay?.id;

    useEffect(() => {
        if (!employeeId) {
            loadEmployees();
        }
    }, [employeeId]);

    // ✅ Load off-days when employee is selected
    useEffect(() => {
        if (formData.employee_id) {
            loadEmployeeOffDays(formData.employee_id);
        } else {
            setEmployeeOffDays([]);
        }
    }, [formData.employee_id]);

    const loadEmployees = async () => {
        try {
            const response = await api.get('/employees?status=active');
            // Safety check: employees API might return { employees: [...] } or just [...]
            const data = response.data;
            const employeesArray = Array.isArray(data) ? data : (Array.isArray(data?.employees) ? data.employees : []);
            setEmployees(employeesArray);
        } catch (error) {
            console.error('Failed to load employees:', error);
            setEmployees([]); // Reset to empty array on error
        }
    };

    const loadEmployeeOffDays = async (empId: string) => {
        try {
            // Load for +/- 1 year to cover likely range
            const today = new Date();
            const start = new Date(today.getFullYear() - 1, 0, 1);
            const end = new Date(today.getFullYear() + 1, 11, 31);

            const startDate = start.toISOString().split('T')[0];
            const endDate = end.toISOString().split('T')[0];

            const response = await api.get(`/employee-off-days?employee_id=${empId}&start_date=${startDate}&end_date=${endDate}`);
            const offDates = (response.data.off_days || []).map((od: any) => od.off_date);

            // If editing, exclude current off_date from "existing" list so it doesn't look like a conflict with itself
            if (isEditMode && offDay?.off_date) {
                setEmployeeOffDays(offDates.filter((d: string) => d !== offDay.off_date));
            } else {
                setEmployeeOffDays(offDates);
            }
        } catch (error) {
            console.error('Failed to load employee off-days:', error);
            setEmployeeOffDays([]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isEditMode && offDay?.id) {
                // Update existing off-day
                await api.put(`/employee-off-days/${offDay.id}`, {
                    off_date: formData.off_date,
                    off_type: formData.off_type,
                    notes: formData.notes || null,
                });
            } else {
                // Create new off-day
                await api.post('/employee-off-days', {
                    employee_id: parseInt(formData.employee_id),
                    off_date: formData.off_date,
                    off_type: formData.off_type,
                    notes: formData.notes || null,
                });
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to save off-day:', error);
            showToast(error.response?.data?.message || 'Failed to save off-day', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {isEditMode
                                    ? (i18n.language === 'th' ? 'แก้ไขวันหยุดเสาร์' : 'Edit Saturday Off')
                                    : (i18n.language === 'th' ? 'เพิ่มวันหยุดเสาร์' : 'Add Saturday Off')}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {i18n.language === 'th' ? 'กำหนดวันหยุดเสาร์สำหรับพนักงาน' : 'Schedule Saturday off for employee'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Employee Selector with Search (only when creating new) */}
                    {!employeeId && !isEditMode && (
                        <div ref={dropdownRef} className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Users className="w-4 h-4 inline mr-1" />
                                {i18n.language === 'th' ? 'พนักงาน' : 'Employee'} <span className="text-red-500">*</span>
                            </label>

                            {/* Search Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={selectedEmployee
                                        ? `${selectedEmployee.employee_code} - ${i18n.language === 'th'
                                            ? `${selectedEmployee.first_name_th} ${selectedEmployee.last_name_th}`
                                            : `${selectedEmployee.first_name_en} ${selectedEmployee.last_name_en}`}`
                                        : searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setFormData({ ...formData, employee_id: '' });
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder={i18n.language === 'th' ? 'ค้นหาด้วยรหัสหรือชื่อพนักงาน...' : 'Search by code or name...'}
                                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {/* Dropdown List */}
                            {showDropdown && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                            {i18n.language === 'th' ? 'ไม่พบพนักงาน' : 'No employees found'}
                                        </div>
                                    ) : (
                                        filteredEmployees.map(emp => (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, employee_id: emp.id.toString() });
                                                    setSearchQuery('');
                                                    setShowDropdown(false);
                                                }}
                                                className={`w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors flex items-center gap-2 ${formData.employee_id === emp.id.toString() ? 'bg-purple-100 text-purple-700' : ''
                                                    }`}
                                            >
                                                <span className="font-medium text-gray-600">{emp.employee_code}</span>
                                                <span className="text-gray-500">-</span>
                                                <span className="text-gray-800">
                                                    {i18n.language === 'th'
                                                        ? `${emp.first_name_th} ${emp.last_name_th}`
                                                        : `${emp.first_name_en} ${emp.last_name_en}`}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Hidden required input for form validation */}
                            <input
                                type="hidden"
                                value={formData.employee_id}
                                required
                            />
                        </div>
                    )}

                    {/* Off Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {i18n.language === 'th' ? 'วันหยุด' : 'Off Date'} <span className="text-red-500">*</span>
                        </label>
                        <DatePicker
                            value={formData.off_date ? new Date(formData.off_date) : null}
                            onChange={(date) => {
                                if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    setFormData({ ...formData, off_date: `${year}-${month}-${day}` });
                                } else {
                                    setFormData({ ...formData, off_date: '' });
                                }
                            }}
                            required
                            placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                            specialOffDays={employeeOffDays} // ✅ Highlight existing off-days
                            disabledDates={employeeOffDays}  // ✅ Prevent selecting existing off-days
                        />
                    </div>

                    {/* Off Type (Hidden - Default to Alternating Saturday) */}
                    <input type="hidden" value="alternating_saturday" />

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FileText className="w-4 h-4 inline mr-1" />
                            {i18n.language === 'th' ? 'หมายเหตุ' : 'Notes'}
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            placeholder={i18n.language === 'th' ? 'หมายเหตุเพิ่มเติม (ถ้ามี)' : 'Additional notes (optional)'}
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !formData.employee_id || !formData.off_date}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                        {isEditMode
                            ? (i18n.language === 'th' ? 'บันทึก' : 'Save')
                            : (i18n.language === 'th' ? 'เพิ่มวันหยุดเสาร์' : 'Add Saturday Off')}
                    </button>
                </div>
            </div>
        </div>
    );
}
