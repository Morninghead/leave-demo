import { useState } from 'react';
import { Filter, X, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../common/DatePicker';

export interface FilterOptions {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  department?: string;
  status?: string;
  leaveType?: string;
  employee?: string;
}

interface FilterPanelProps {
  onApply: (filters: FilterOptions) => void;
  onReset: () => void;
  departments?: Array<{ id: string; name: string }>;
  leaveTypes?: Array<{ id: string; name: string }>;
  showDateRange?: boolean;
  showDepartment?: boolean;
  showStatus?: boolean;
  showLeaveType?: boolean;
  showEmployee?: boolean;
}

export function FilterPanel({
  onApply,
  onReset,
  departments = [],
  leaveTypes = [],
  showDateRange = true,
  showDepartment = true,
  showStatus = true,
  showLeaveType = true,
  showEmployee = false,
}: FilterPanelProps) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    },
    department: '',
    status: '',
    leaveType: '',
    employee: '',
  });

  const handleApply = () => {
    onApply(filters);
  };

  const handleReset = () => {
    setFilters({
      dateRange: {
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
      department: '',
      status: '',
      leaveType: '',
      employee: '',
    });
    onReset();
  };

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const today = new Date();
    let startDate = new Date();

    switch (preset) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate = new Date(today.setDate(today.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
    }

    setFilters({
      ...filters,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-900">{t('common.filter')}</span>
        </div>
        <span className="text-sm text-gray-500">
          {isExpanded ? t('common.collapse') : t('common.expand')}
        </span>
      </button>

      {/* Filters */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            {showDateRange && (
              <div className="lg:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {t('reports.dateRange')}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={filters.dateRange?.startDate ? new Date(filters.dateRange.startDate) : null}
                      onChange={(date) => {
                        const dateStr = date
                          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                          : '';
                        setFilters({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange!,
                            startDate: dateStr,
                          },
                        });
                      }}
                      placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                    />
                  </div>
                  <span className="text-gray-500 self-center">-</span>
                  <div className="flex-1">
                    <DatePicker
                      value={filters.dateRange?.endDate ? new Date(filters.dateRange.endDate) : null}
                      onChange={(date) => {
                        const dateStr = date
                          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                          : '';
                        setFilters({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange!,
                            endDate: dateStr,
                          },
                        });
                      }}
                      placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                    />
                  </div>
                </div>
                {/* Quick Presets */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setDatePreset('today')}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {t('reports.today')}
                  </button>
                  <button
                    onClick={() => setDatePreset('week')}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {t('reports.thisWeek')}
                  </button>
                  <button
                    onClick={() => setDatePreset('month')}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {t('reports.thisMonth')}
                  </button>
                  <button
                    onClick={() => setDatePreset('quarter')}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {t('reports.thisQuarter')}
                  </button>
                  <button
                    onClick={() => setDatePreset('year')}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {t('reports.thisYear')}
                  </button>
                </div>
              </div>
            )}

            {/* Department */}
            {showDepartment && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.department')}
                </label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('common.all')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            {showStatus && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.status')}
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="pending">{t('leave.pending')}</option>
                  <option value="approved">{t('leave.approved')}</option>
                  <option value="rejected">{t('leave.rejected')}</option>
                </select>
              </div>
            )}

            {/* Leave Type */}
            {showLeaveType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('leave.leaveType')}
                </label>
                <select
                  value={filters.leaveType}
                  onChange={(e) => setFilters({ ...filters, leaveType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('common.all')}</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Employee Search */}
            {showEmployee && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.employeeCode')}
                </label>
                <input
                  type="text"
                  value={filters.employee}
                  onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                  placeholder={t('common.search')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
              {t('common.reset')}
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Filter className="w-4 h-4" />
              {t('common.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
