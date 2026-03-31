import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Building2,
  Clock,
  CalendarDays,
  CalendarRange
} from 'lucide-react';
import { getDepartments, Department } from '../../api/departments';
import { DatePicker } from '../common/DatePicker';

interface FilterOptions {
  type: 'leave' | 'shift';
  year: number;
  month: number | null;
  department_id: string | null;
  date_range: 'week' | 'month' | 'quarter' | 'year' | 'custom' | null;
  start_date: string | null;
  end_date: string | null;
  week: number | null;
  quarter: number | null;
}

interface AdvancedFilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onApply: () => void;
  loading?: boolean;
}

export function AdvancedFilterPanel({
  filters,
  onFiltersChange,
  onApply,
  loading = false
}: AdvancedFilterPanelProps) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const months = [
    { value: null, label: t('reports.allMonths') },
    { value: 1, label: t('reports.january') },
    { value: 2, label: t('reports.february') },
    { value: 3, label: t('reports.march') },
    { value: 4, label: t('reports.april') },
    { value: 5, label: t('reports.may') },
    { value: 6, label: t('reports.june') },
    { value: 7, label: t('reports.july') },
    { value: 8, label: t('reports.august') },
    { value: 9, label: t('reports.september') },
    { value: 10, label: t('reports.october') },
    { value: 11, label: t('reports.november') },
    { value: 12, label: t('reports.december') },
  ];

  const dateRangeOptions = [
    { value: null, label: t('reports.selectRange'), icon: Calendar },
    { value: 'week', label: t('reports.thisWeek'), icon: Clock },
    { value: 'month', label: t('reports.thisMonth'), icon: CalendarDays },
    { value: 'quarter', label: t('reports.thisQuarter'), icon: CalendarRange },
    { value: 'year', label: t('reports.thisYear'), icon: Calendar },
    { value: 'custom', label: t('reports.customRange'), icon: CalendarRange },
  ];

  const weeks = Array.from({ length: 53 }, (_, i) => ({
    value: i + 1,
    label: `${t('reports.week')} ${i + 1}`
  }));

  const quarters = [
    { value: 1, label: t('reports.q1') },
    { value: 2, label: t('reports.q2') },
    { value: 3, label: t('reports.q3') },
    { value: 4, label: t('reports.q4') },
  ];

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleQuickDateRange = (range: 'today' | 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisYear') => {
    const today = new Date();
    const newFilters = { ...filters };

    switch (range) {
      case 'today':
        newFilters.date_range = 'custom';
        newFilters.start_date = today.toISOString().split('T')[0];
        newFilters.end_date = today.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        newFilters.date_range = 'week';
        const weekNumber = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
        newFilters.week = weekNumber;
        break;
      case 'thisMonth':
        newFilters.date_range = 'month';
        newFilters.month = today.getMonth() + 1;
        break;
      case 'thisQuarter':
        newFilters.date_range = 'quarter';
        newFilters.quarter = Math.ceil((today.getMonth() + 1) / 3);
        break;
      case 'thisYear':
        newFilters.date_range = 'year';
        break;
    }

    onFiltersChange(newFilters);
  };

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">{t('reports.advancedFilters')}</h2>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? (
              <>
                {t('common.showLess')}
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                {t('common.showMore')}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Basic Filters - Always Visible */}
        <div className="grid md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.reportType')}
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="leave">{t('reports.leaveReport')}</option>
              <option value="shift">{t('reports.shiftReport')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.year')}
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('employee.department')}
            </label>
            <select
              value={filters.department_id || ''}
              onChange={(e) => handleFilterChange('department_id', e.target.value || null)}
              disabled={departmentsLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">{t('reports.allDepartments')}</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name_th.replace(/^0+/, '')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={onApply}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('common.loading') : t('reports.applyFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters - Expandable */}
      {isExpanded && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="space-y-4">
            {/* Date Range Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('reports.dateRange')}
              </label>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <select
                    value={filters.date_range || ''}
                    onChange={(e) => handleFilterChange('date_range', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {dateRangeOptions.map((option) => (
                      <option key={option.value || 'default'} value={option.value || ''}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conditional fields based on date range */}
                {filters.date_range === 'week' && (
                  <div>
                    <select
                      value={filters.week || ''}
                      onChange={(e) => handleFilterChange('week', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{t('reports.selectWeek')}</option>
                      {weeks.map((week) => (
                        <option key={week.value} value={week.value}>
                          {week.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {filters.date_range === 'quarter' && (
                  <div>
                    <select
                      value={filters.quarter || ''}
                      onChange={(e) => handleFilterChange('quarter', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{t('reports.selectQuarter')}</option>
                      {quarters.map((quarter) => (
                        <option key={quarter.value} value={quarter.value}>
                          {quarter.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {filters.date_range === 'custom' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {t('reports.startDate')}
                      </label>
                      <DatePicker
                        value={filters.start_date ? new Date(filters.start_date) : null}
                        onChange={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            handleFilterChange('start_date', `${year}-${month}-${day}`);
                          } else {
                            handleFilterChange('start_date', null);
                          }
                        }}
                        placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {t('reports.endDate')}
                      </label>
                      <DatePicker
                        value={filters.end_date ? new Date(filters.end_date) : null}
                        onChange={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            handleFilterChange('end_date', `${year}-${month}-${day}`);
                          } else {
                            handleFilterChange('end_date', null);
                          }
                        }}
                        minDate={filters.start_date ? new Date(filters.start_date) : undefined}
                        placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Date Range Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('reports.quickSelect')}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickDateRange('today')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('reports.today')}
                </button>
                <button
                  onClick={() => handleQuickDateRange('thisWeek')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('reports.thisWeek')}
                </button>
                <button
                  onClick={() => handleQuickDateRange('thisMonth')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('reports.thisMonth')}
                </button>
                <button
                  onClick={() => handleQuickDateRange('thisQuarter')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('reports.thisQuarter')}
                </button>
                <button
                  onClick={() => handleQuickDateRange('thisYear')}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('reports.thisYear')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}