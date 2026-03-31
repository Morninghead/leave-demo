// ShiftSwapForm.tsx - Updated for Admin/Manager/HR to swap on behalf of employees
import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ArrowRightLeft, Users, Search } from 'lucide-react';
import { WorkOffSwapFormData, createWorkOffSwapRequest } from '../../api/shift';
import { getCompanyHolidays } from '../../api/holidays';
import { DatePicker, type Holiday } from '../common/DatePicker';
import api from '../../api/auth';

interface ShiftSwapFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Employee {
  id: string;
  employee_code: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  department_name_th?: string;
  department_name_en?: string;
  position_th?: string;
  position_en?: string;
}

type SwapType = 'off_to_work' | 'work_to_off';

export function ShiftSwapForm({ onSuccess, onCancel }: ShiftSwapFormProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [swapType, setSwapType] = useState<SwapType>('work_to_off');
  const [workDate, setWorkDate] = useState<Date | null>(null);
  const [offDate, setOffDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Employee selection state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Off-days state for selected employee
  const [employeeOffDays, setEmployeeOffDays] = useState<string[]>([]);
  const [loadingOffDays, setLoadingOffDays] = useState(false);

  useEffect(() => {
    loadHolidays();
    loadEmployees();
  }, []);

  // Load off-days when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeOffDays(selectedEmployee.id);
    } else {
      setEmployeeOffDays([]);
    }
  }, [selectedEmployee]);

  const loadHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear().toString();
      const nextYear = (new Date().getFullYear() + 1).toString();

      const [currentYearHolidays, nextYearHolidays] = await Promise.all([
        getCompanyHolidays(currentYear),
        getCompanyHolidays(nextYear)
      ]);

      setHolidays([...currentYearHolidays, ...nextYearHolidays] as Holiday[]);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    }
  };

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await api.get<{
        success: boolean;
        employees: Employee[];
      }>('/employees');

      if (response.data.success) {
        setEmployees(response.data.employees || []);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadEmployeeOffDays = async (employeeId: string) => {
    setLoadingOffDays(true);
    try {
      // Load off-days for next 6 months
      const today = new Date();
      const future = new Date();
      future.setMonth(future.getMonth() + 6);

      const startDate = today.toISOString().split('T')[0];
      const endDate = future.toISOString().split('T')[0];

      const response = await api.get(`/employee-off-days?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`);

      const offDates = (response.data.off_days || []).map((od: any) => od.off_date);
      setEmployeeOffDays(offDates);
    } catch (err) {
      console.error('Failed to load employee off-days:', err);
      setEmployeeOffDays([]);
    } finally {
      setLoadingOffDays(false);
    }
  };

  const formatDateToString = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredEmployees = employees.filter(emp => {
    const search = employeeSearch.toLowerCase();
    const name = i18n.language === 'th'
      ? `${emp.first_name_th} ${emp.last_name_th}`
      : `${emp.first_name_en} ${emp.last_name_en}`;
    return (
      emp.employee_code.toLowerCase().includes(search) ||
      name.toLowerCase().includes(search)
    );
  });

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeSearch('');
    setShowEmployeeDropdown(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedEmployee) {
      setError(i18n.language === 'th'
        ? 'กรุณาเลือกพนักงาน'
        : 'Please select an employee');
      return;
    }

    if (!workDate || !offDate) {
      setError(t('shift.errorMissingDate'));
      return;
    }
    if (formatDateToString(workDate) === formatDateToString(offDate)) {
      setError(t('shift.errorSameDate'));
      return;
    }

    setLoading(true);

    try {
      const data: WorkOffSwapFormData & { target_employee_id?: string } = {
        work_date: formatDateToString(workDate),
        off_date: formatDateToString(offDate),
        reason_th: reason,
        reason_en: reason,
        target_employee_id: selectedEmployee.id, // ✅ NEW: Send target employee ID
      };
      await createWorkOffSwapRequest(data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-lg z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {i18n.language === 'th' ? 'สลับวันหยุด' : 'Shift Swap'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {i18n.language === 'th'
                ? 'เลือกพนักงานที่ต้องการสลับวันทำงานให้'
                : 'Select an employee to swap their work day'}
            </p>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={onCancel}
            type="button"
            aria-label={t('common.cancel')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="lucide lucide-x w-6 h-6">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ✅ NEW: Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <Users className="inline w-4 h-4 mr-1" />
              {i18n.language === 'th' ? 'เลือกพนักงาน' : 'Select Employee'} *
            </label>

            {selectedEmployee ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="font-medium text-blue-900">
                    {i18n.language === 'th'
                      ? `${selectedEmployee.first_name_th} ${selectedEmployee.last_name_th}`
                      : `${selectedEmployee.first_name_en} ${selectedEmployee.last_name_en}`}
                  </p>
                  <p className="text-sm text-blue-700">
                    {selectedEmployee.employee_code}
                    {selectedEmployee.department_name_th && ` • ${i18n.language === 'th' ? selectedEmployee.department_name_th : selectedEmployee.department_name_en}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {i18n.language === 'th' ? 'เปลี่ยน' : 'Change'}
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder={i18n.language === 'th'
                      ? 'ค้นหาพนักงาน (รหัส / ชื่อ)'
                      : 'Search employee (code / name)'}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {showEmployeeDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingEmployees ? (
                      <div className="p-4 text-center text-gray-500">
                        {i18n.language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {i18n.language === 'th' ? 'ไม่พบพนักงาน' : 'No employees found'}
                      </div>
                    ) : (
                      filteredEmployees.slice(0, 10).map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="font-medium text-gray-900">
                            {i18n.language === 'th'
                              ? `${emp.first_name_th} ${emp.last_name_th}`
                              : `${emp.first_name_en} ${emp.last_name_en}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {emp.employee_code}
                            {emp.department_name_th && ` • ${i18n.language === 'th' ? emp.department_name_th : emp.department_name_en}`}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Swap Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t('shift.swapType')} *
            </label>
            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition-colors ${swapType === 'work_to_off' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
              >
                <input
                  type="radio"
                  name="swapType"
                  value="work_to_off"
                  checked={swapType === 'work_to_off'}
                  onChange={(e) => setSwapType(e.target.value as SwapType)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{t('shift.workToOff')}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('shift.workToOffDesc')}</p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition-colors ${swapType === 'off_to_work' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
              >
                <input
                  type="radio"
                  name="swapType"
                  value="off_to_work"
                  checked={swapType === 'off_to_work'}
                  onChange={(e) => setSwapType(e.target.value as SwapType)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{t('shift.offToWork')}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('shift.offToWorkDesc')}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Date Selection */}
          <div className="grid md:grid-cols-3 gap-4 items-center">
            {/* Off-days indicator */}
            {selectedEmployee && employeeOffDays.length > 0 && (
              <div className="md:col-span-3 bg-purple-50 border border-purple-200 rounded-lg p-3 mb-2">
                <p className="text-sm text-purple-900">
                  <strong>{i18n.language === 'th' ? '⚠️ วันหยุดของพนักงาน:' : '⚠️ Employee Off-Days:'}</strong>
                  {' '}{employeeOffDays.length} {i18n.language === 'th' ? 'วันในช่วง 6 เดือนข้างหน้า' : 'days in next 6 months'}
                  {' '}({i18n.language === 'th' ? 'ไม่สามารถเลือกได้' : 'cannot be selected'})
                </p>
              </div>
            )}

            {swapType === 'work_to_off' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shift.fromWorkDate')} *
                  </label>
                  <DatePicker
                    value={workDate}
                    onChange={setWorkDate}
                    placeholder="dd/mm/yyyy"
                    required
                    holidays={holidays}
                    disabledDates={employeeOffDays}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('shift.fromWorkDateDesc')}</p>
                </div>
                <div className="flex items-center justify-center pt-6">
                  <ArrowRightLeft className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shift.toOffDate')} *
                  </label>
                  <DatePicker
                    value={offDate}
                    onChange={setOffDate}
                    placeholder="dd/mm/yyyy"
                    required
                    holidays={holidays}
                    disabledDates={employeeOffDays}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('shift.toOffDateDesc')}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shift.fromOffDate')} *
                  </label>
                  <DatePicker
                    value={offDate}
                    onChange={setOffDate}
                    placeholder="dd/mm/yyyy"
                    required
                    holidays={holidays}
                    disabledDates={employeeOffDays}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('shift.fromOffDateDesc')}</p>
                </div>
                <div className="flex items-center justify-center pt-6">
                  <ArrowRightLeft className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shift.toWorkDate')} *
                  </label>
                  <DatePicker
                    value={workDate}
                    onChange={setWorkDate}
                    placeholder="dd/mm/yyyy"
                    required
                    holidays={holidays}
                    disabledDates={employeeOffDays}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('shift.toWorkDateDesc')}</p>
                </div>
              </>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline w-4 h-4 mr-1" />
              {t('shift.reason')} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder={t('shift.reasonPlaceholder')}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !selectedEmployee}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : (i18n.language === 'th' ? 'สลับวัน' : 'Swap')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
