import { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { Calendar, Plus, Settings, ChevronLeft, ChevronRight, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { getCompanyHolidays, addCompanyHoliday, updateCompanyHoliday, deleteCompanyHoliday } from '../../api/holidays';
import { HolidayModal } from './HolidayModal';
import { CompanyHolidaysListView } from './CompanyHolidaysListView';
import { isHolidayDate } from '../../utils/dateUtils';
import { HolidayFormData } from './HolidayModal';

export interface Holiday {
  id: string;
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type: 'company' | 'public' | 'religious';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name_th?: string;
  created_by_name_en?: string;
  notes?: string;
  location?: string;
  notify_days_before?: number;
  notification_message?: string;
}

// Helper function to convert Gregorian year to Thai Buddhist year
const getThaiYear = (year: number) => year + 543;

export function CompanyHolidaysCalendar() {
  const { t, i18n } = useTranslation();
  const { showToast, showModal: showConfirmModal } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Load holidays for current year
  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const holidaysData = await getCompanyHolidays(currentYear.toString());
      setHolidays(holidaysData);
    } catch (err: any) {
      logger.error('Failed to load holidays:', err);
      setError(err.message || t('holidays.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentYear, t]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };


  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: number[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(0);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getHolidaysForDate = (date: Date) => {
    return holidays.filter(holiday => isHolidayDate(date, holiday.holiday_date));
  };


  const handleAddHoliday = () => {
    setEditingHoliday(null);
    setShowModal(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setShowModal(true);
  };

  const handleSubmit = async (formData: HolidayFormData) => {
    try {
      setLoading(true);

      if (editingHoliday) {
        await updateCompanyHoliday(editingHoliday.id, formData);
      } else {
        await addCompanyHoliday(formData);
      }

      setShowModal(false);
      setEditingHoliday(null);
      await loadHolidays();
    } catch (err: any) {
      logger.error('Failed to save holiday:', err);
      // Show the actual error message from the backend
      const errorMessage = err.response?.data?.message || err.message || t('holidays.failedToSave');
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    const confirmed = await showConfirmModal('confirm', t('holidays.deleteHoliday'), {
      message: t('holidays.confirmDelete'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });

    if (confirmed) {
      try {
        setLoading(true);
        await deleteCompanyHoliday(holidayId);
        await loadHolidays();
        showToast(t('holidays.deletedSuccess'), 'success'); // Added success toast
      } catch (err: any) {
        logger.error('Failed to delete holiday:', err);
        setError(err.message || t('holidays.failedToDelete'));
      } finally {
        setLoading(false);
      }
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);

    // Month names
    const monthNames = {
      th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
      en: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
    };

    // Day names
    const dayNames = {
      th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
                title={i18n.language === 'th' ? 'เดือนก่อน' : 'Previous Month'}
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>

              <div className="min-w-[240px] text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {monthNames[i18n.language === 'th' ? 'th' : 'en'][currentDate.getMonth()]}
                </h2>
                <p className="text-sm text-gray-600">
                  {i18n.language === 'th' ? getThaiYear(currentDate.getFullYear()) : currentDate.getFullYear()}
                </p>
              </div>

              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
                title={i18n.language === 'th' ? 'เดือนถัดไป' : 'Next Month'}
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Year Navigator */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentYear(currentYear - 1)}
                className="px-3 py-2 text-sm font-medium hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
              >
                <ChevronLeft className="w-3 h-3 inline mr-1" />
                {i18n.language === 'th' ? getThaiYear(currentYear - 1) : currentYear - 1}
              </button>

              <div className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm font-semibold text-sm">
                {i18n.language === 'th' ? getThaiYear(currentYear) : currentYear}
              </div>

              <button
                onClick={() => setCurrentYear(currentYear + 1)}
                className="px-3 py-2 text-sm font-medium hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
              >
                {i18n.language === 'th' ? getThaiYear(currentYear + 1) : currentYear + 1}
                <ChevronRight className="w-3 h-3 inline ml-1" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-md shadow-sm"></div>
              <span className="text-xs font-medium text-gray-700">
                {i18n.language === 'th' ? 'วันหยุดบริษัท' : 'Company Holiday'}
              </span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Day of Week Headers */}
            {dayNames[i18n.language === 'th' ? 'th' : 'en'].map((dayName, index) => (
              <div
                key={`day-header-${index}`}
                className={`h-12 flex items-center justify-center font-bold text-sm rounded-lg ${index === 0
                  ? 'text-red-600 bg-red-50'
                  : index === 6
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-700 bg-gray-50'
                  }`}
              >
                {dayName}
              </div>
            ))}

            {/* Calendar days */}
            {daysInMonth.map((day, index) => {
              if (day === 0) {
                // Empty cell for days before month starts
                return (
                  <div
                    key={`empty-${currentDate.getFullYear()}-${currentDate.getMonth()}-${index}`}
                    className="h-28 bg-gray-50/30 rounded-lg"
                  />
                );
              }

              const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dateStr = date.toISOString().split('T')[0];
              const dayHolidays = getHolidaysForDate(date);
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              // Get background color based on holiday type
              let bgColor = 'bg-white hover:bg-gray-50';
              let textColor = 'text-gray-800';
              let borderColor = 'border-gray-200';
              let ringColor = '';

              if (dayHolidays.length > 0) {
                const holidayType = dayHolidays[0].holiday_type;
                switch (holidayType) {
                  case 'company':
                    bgColor = 'bg-gradient-to-br from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-100';
                    textColor = 'text-orange-900';
                    borderColor = 'border-orange-300';
                    ringColor = 'ring-2 ring-orange-200';
                    break;
                  case 'public':
                    bgColor = 'bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-100';
                    textColor = 'text-blue-900';
                    borderColor = 'border-blue-300';
                    ringColor = 'ring-2 ring-blue-200';
                    break;
                  case 'religious':
                    bgColor = 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:from-emerald-100 hover:to-emerald-100';
                    textColor = 'text-emerald-900';
                    borderColor = 'border-emerald-300';
                    ringColor = 'ring-2 ring-emerald-200';
                    break;
                }
              }

              if (isToday) {
                ringColor = 'ring-2 ring-yellow-400';
              }

              return (
                <div
                  key={`${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`}
                  className={`relative h-28 border ${borderColor} ${bgColor} ${ringColor} rounded-lg transition-all cursor-pointer group`}
                >
                  {/* Day number */}
                  <div className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${textColor} ${isToday ? 'bg-yellow-400 text-gray-900' : ''}`}>
                    {day}
                  </div>

                  {/* Holidays for this date */}
                  {dayHolidays.length > 0 && (
                    <div className="pt-10 px-2 space-y-1">
                      {dayHolidays.map((holiday, holidayIndex) => (
                        <div
                          key={`${dateStr}-${holiday.id || holidayIndex}`}
                          onClick={() => handleEditHoliday(holiday)}
                          className="text-xs py-1.5 px-2 rounded-md font-medium cursor-pointer bg-white/80 hover:bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-all group-hover:scale-105"
                          title={i18n.language === 'th' ? holiday.name_th : holiday.name_en}
                        >
                          <div className="truncate text-gray-800">
                            {i18n.language === 'th' ? holiday.name_th : holiday.name_en}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-sm text-gray-600">
                  {i18n.language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // renderList() is now replaced by CompanyHolidaysListView component


  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {i18n.language === 'th' ? 'วันหยุดประจำปี' : 'Company Holidays'}
            </h1>
            <p className="text-blue-100">
              {i18n.language === 'th'
                ? `จัดการวันหยุดของบริษัทสำหรับปี ${getThaiYear(currentYear)}`
                : `Manage company holidays for year ${currentYear}`}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Calendar className="w-16 h-16 text-blue-200 opacity-50" />
          </div>
        </div>

      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <div className="shrink-0">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <Eye className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800 mb-1">
              {i18n.language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error'}
            </h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg bg-gray-100 p-1 w-full md:w-auto">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all flex-1 md:flex-none ${viewMode === 'calendar'
                ? 'bg-white text-blue-700 shadow-md font-medium'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{i18n.language === 'th' ? 'ปฏิทิน' : 'Calendar'}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all flex-1 md:flex-none ${viewMode === 'list'
                ? 'bg-white text-blue-700 shadow-md font-medium'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">{i18n.language === 'th' ? 'รายการ' : 'List'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadHolidays}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">
                {i18n.language === 'th' ? 'รีเฟรช' : 'Refresh'}
              </span>
            </button>

            <button
              onClick={handleAddHoliday}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">
                {i18n.language === 'th' ? 'เพิ่มวันหยุด' : 'Add Holiday'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'calendar' ? renderCalendar() : (
        <CompanyHolidaysListView
          holidays={holidays}
          currentYear={currentYear}
          loading={loading}
          error={error}
          onAddHoliday={handleAddHoliday}
          onEditHoliday={handleEditHoliday}
          onDeleteHoliday={handleDeleteHoliday}
          onRefresh={loadHolidays}
          onYearChange={setCurrentYear}
        />
      )}

      {/* Holiday Modal */}
      {showModal && (
        <HolidayModal
          holiday={editingHoliday}
          onClose={() => {
            setShowModal(false);
            setEditingHoliday(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
