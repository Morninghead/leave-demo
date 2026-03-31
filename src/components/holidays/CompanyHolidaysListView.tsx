import { useTranslation } from 'react-i18next';
import { Calendar, Plus, Edit2, Trash2, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { Holiday } from './CompanyHolidaysCalendar';

interface CompanyHolidaysListViewProps {
  holidays: Holiday[];
  currentYear: number;
  loading: boolean;
  error: string | null;
  onAddHoliday: () => void;
  onEditHoliday: (holiday: Holiday) => void;
  onDeleteHoliday: (holidayId: string) => void;
  onRefresh: () => void;
  onYearChange: (year: number) => void;
}

export function CompanyHolidaysListView({
  holidays,
  currentYear,
  loading,
  error,
  onAddHoliday,
  onEditHoliday,
  onDeleteHoliday,
  onYearChange
}: CompanyHolidaysListViewProps) {
  const { i18n } = useTranslation();

  // Month names for Thai and English
  const monthNames = {
    th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
    en: ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
  };


  // Group holidays by month
  const holidaysByMonth: { [key: number]: Holiday[] } = {};
  holidays.forEach(holiday => {
    const month = new Date(holiday.holiday_date).getMonth();
    if (!holidaysByMonth[month]) {
      holidaysByMonth[month] = [];
    }
    holidaysByMonth[month].push(holiday);
  });

  // Sort months
  const sortedMonths = Object.keys(holidaysByMonth)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'รายการวันหยุดประจำปี' : 'Holiday List'}
            </h2>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
              <span>{i18n.language === 'th' ? `ปี ${currentYear + 543}` : `Year ${currentYear}`}</span>
              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {holidays.length} {i18n.language === 'th' ? 'วันหยุด' : 'holidays'}
              </span>
            </p>
          </div>
        </div>

        {/* Year Navigator */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onYearChange(currentYear - 1)}
            className="px-3 py-2 text-sm font-medium hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
          >
            <ChevronLeft className="w-3 h-3 inline mr-1" /> {i18n.language === 'th' ? currentYear - 1 + 543 : currentYear - 1}
          </button>

          <div className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm font-semibold text-sm">
            {i18n.language === 'th' ? currentYear + 543 : currentYear}
          </div>

          <button
            onClick={() => onYearChange(currentYear + 1)}
            className="px-3 py-2 text-sm font-medium hover:bg-white rounded-lg transition-all shadow-sm hover:shadow"
          >
            {i18n.language === 'th' ? currentYear + 1 + 543 : currentYear + 1} <ChevronRight className="w-3 h-3 inline ml-1" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-sm font-medium text-gray-600">
              {i18n.language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && holidays.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Calendar className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {i18n.language === 'th' ? 'ยังไม่มีวันหยุดประจำปี' : 'No holidays found'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {i18n.language === 'th'
              ? `ไม่พบวันหยุดสำหรับปี ${currentYear + 543} เริ่มต้นเพิ่มวันหยุดแรกของคุณตอนนี้`
              : `No holidays found for year ${currentYear}. Start by adding your first holiday now.`}
          </p>
          <button
            onClick={onAddHoliday}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            {i18n.language === 'th' ? 'เพิ่มวันหยุดแรก' : 'Add First Holiday'}
          </button>
        </div>
      )}

      {/* Holiday List Grouped by Month */}
      {!loading && holidays.length > 0 && (
        <div className="p-6 space-y-8">
          {sortedMonths.map(month => (
            <div key={month} className="space-y-4">
              {/* Month Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl px-5 py-3 shadow-md">
                  <Calendar className="w-5 h-5" />
                  <h3 className="text-lg font-bold">
                    {monthNames[i18n.language === 'th' ? 'th' : 'en'][month]}
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">
                    {holidaysByMonth[month].length}
                  </span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
              </div>

              {/* Holidays in this month */}
              <div className="grid gap-4 md:grid-cols-2">
                {holidaysByMonth[month].map((holiday) => {
                  // Holiday type colors (company only)
                  const typeColor = 'bg-orange-500';
                  const bgGradient = 'from-orange-50 to-white';
                  const borderColor = 'border-orange-200';

                  return (
                    <div
                      key={holiday.id}
                      className={`group relative bg-gradient-to-br ${bgGradient} border-2 ${borderColor} rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date Badge */}
                        <div className="shrink-0">
                          <div className={`${typeColor} text-white rounded-xl p-4 shadow-md min-w-[70px] text-center`}>
                            <div className="text-3xl font-bold leading-none mb-1">
                              {new Date(holiday.holiday_date).getDate()}
                            </div>
                            <div className="text-xs uppercase font-medium opacity-90">
                              {new Date(holiday.holiday_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', { weekday: 'short' })}
                            </div>
                          </div>
                        </div>

                        {/* Holiday Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                            {i18n.language === 'th' ? holiday.name_th : holiday.name_en}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {new Date(holiday.holiday_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>

                          {/* Holiday Type Badge */}
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white ${typeColor}`}>
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                              {i18n.language === 'th' ? 'บริษัท' : 'Company'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditHoliday(holiday)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title={i18n.language === 'th' ? 'แก้ไข' : 'Edit'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteHoliday(holiday.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title={i18n.language === 'th' ? 'ลบ' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                {i18n.language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error'}
              </h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

