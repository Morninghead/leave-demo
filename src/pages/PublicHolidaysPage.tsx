import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getCompanyHolidays, Holiday } from '../api/holidays';
import * as Icons from 'lucide-react';
import { isHolidayDate } from '../utils/dateUtils';
import { Logo } from '../components/common/logo';
import { useSettings } from '../hooks/useSettings';
import { useAutoRefresh } from '../hooks/useAutoRefresh';



// Constants moved outside component to avoid hoisting issues
const thaiMonthNames = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const englishMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthGradients = [
  'from-blue-500 to-cyan-600', // January
  'from-purple-500 to-pink-600', // February
  'from-green-500 to-emerald-600', // March
  'from-orange-500 to-red-600', // April
  'from-teal-500 to-cyan-600', // May
  'from-indigo-500 to-purple-600', // June
  'from-yellow-500 to-orange-600', // July
  'from-rose-500 to-pink-600', // August
  'from-amber-500 to-yellow-600', // September
  'from-lime-500 to-green-600', // October
  'from-slate-500 to-gray-600', // November
  'from-red-500 to-rose-600', // December
];

export function PublicHolidaysPage() {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());

  // Get company name from settings
  const companyName = useMemo(() =>
    i18n.language === 'th'
      ? (settings?.company_name_th || 'SSTH Leave Management System')
      : (settings?.company_name_en || 'SSTH Leave Management System'),
    [i18n.language, settings]
  );

  const loadHolidays = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);
      const data = await getCompanyHolidays(currentYear.toString());
      setHolidays(data);
    } catch (err: any) {
      console.error('Failed to load holidays:', err);
      setError(err.message || t('holidays.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentYear, t]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  // Auto-refresh every 30 minutes for public holidays
  // Holiday data is relatively static and changes infrequently
  // Disable refresh when modal is open (viewing holiday details)
  useAutoRefresh({
    category: 'MASTER_DATA',
    dataType: 'LEAVE_TYPES',
    onRefresh: () => loadHolidays(true),
    enabled: !selectedHoliday,
  });

  const changeYear = useCallback((direction: number) => {
    setCurrentYear(prev => prev + direction);
    setSelectedHoliday(null);
  }, []);

  const getDaysInMonth = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(0);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, []);

  const getHolidaysForDate = useCallback((date: Date) => {
    return holidays.filter(holiday => {
      return isHolidayDate(date, holiday.holiday_date);
    });
  }, [holidays]);

  const getHolidayTypeColor = useCallback(() => {
    return 'border-orange-400 bg-gradient-to-br from-orange-100 to-orange-200 text-orange-900';
  }, []);

  // Helper functions for month management
  const toggleMonthExpansion = useCallback((monthIndex: number) => {
    setExpandedMonths(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(monthIndex)) {
        newExpanded.delete(monthIndex);
      } else {
        newExpanded.add(monthIndex);
      }
      return newExpanded;
    });
  }, []);

  const expandAllMonths = useCallback(() => {
    const allMonths = new Set(Array.from({ length: 12 }, (_, i) => i));
    setExpandedMonths(allMonths);
  }, []);

  const collapseAllMonths = useCallback(() => {
    setExpandedMonths(new Set());
  }, []);

  const groupedHolidaysByMonth = useMemo(() => {
    const grouped: { [key: number]: Holiday[] } = {};

    // Initialize all months
    for (let i = 0; i < 12; i++) {
      grouped[i] = [];
    }

    // Group holidays by month
    holidays.forEach(holiday => {
      const date = new Date(holiday.holiday_date);
      const month = date.getMonth();
      grouped[month].push(holiday);
    });

    // Sort holidays within each month by date
    Object.keys(grouped).forEach(month => {
      grouped[parseInt(month)].sort((a, b) =>
        new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime()
      );
    });

    return grouped;
  }, [holidays]);

  const exportToCSV = useCallback(() => {
    const headers = i18n.language === 'th'
      ? ['วันที่', 'ชื่อวันหยุด (ไทย)', 'ชื่อวันหยุด (อังกฤษ)', 'ประเภทวันหยุด', 'สถานที่', 'หมายเหตุ']
      : ['Date', 'Holiday Name (Thai)', 'Holiday Name (English)', 'Holiday Type', 'Location', 'Notes'];

    const rows = holidays.map(holiday => {
      const date = new Date(holiday.holiday_date);
      const dateStr = date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      if (i18n.language === 'th') {
        return [
          dateStr,
          holiday.name_th || '',
          holiday.name_en || '',
          'วันหยุดบริษัท',
          holiday.location || '',
          holiday.notes || ''
        ];
      } else {
        return [
          dateStr,
          holiday.name_th || '',
          holiday.name_en || '',
          'Company Holiday',
          holiday.location || '',
          holiday.notes || ''
        ];
      }
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = i18n.language === 'th'
      ? `วันหยุดประจำปี_${currentYear}.csv`
      : `holiday_list_${currentYear}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [holidays, i18n.language, currentYear]);

  const handleExportPDF = useCallback(() => {
    if (holidays.length === 0) return;

    import('../utils/reportPDFExport').then(({ exportCompanyHolidaysPDF }) => {
      exportCompanyHolidaysPDF(holidays, {
        title: i18n.language === 'th'
          ? `ปฏิทินวันหยุดประจำปี ${currentYear + 543}`
          : `Company Annual Holidays ${currentYear}`,
        subtitle: companyName,
        companyName: companyName,
        orientation: 'landscape'
      });
    });
  }, [holidays, i18n.language, currentYear, companyName]);

  const getMonthGradient = useCallback((monthIndex: number) => {
    return monthGradients[monthIndex] || 'from-gray-500 to-gray-600';
  }, []);

  const monthsWithHolidays = useMemo(() => {
    return Object.keys(groupedHolidaysByMonth)
      .map(month => parseInt(month))
      .filter(month => groupedHolidaysByMonth[month].length > 0);
  }, [groupedHolidaysByMonth]);

  const ListView = useMemo(() => {
    return () => (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <Icons.List className="w-8 h-8" />
                {i18n.language === 'th' ? 'รายการวันหยุดตามเดือน' : 'Holidays by Month'}
              </h3>
              <p className="text-indigo-100 mt-2">
                {holidays.length} {i18n.language === 'th' ? 'วันหยุดใน' : 'holidays in'} {monthsWithHolidays.length} {i18n.language === 'th' ? 'เดือน' : 'months'} {i18n.language === 'th' ? currentYear + 543 : currentYear}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAllMonths}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                <Icons.ChevronDown className="w-4 h-4" />
                {i18n.language === 'th' ? 'ขยายทั้งหมด' : 'Expand All'}
              </button>
              <button
                onClick={collapseAllMonths}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                <Icons.ChevronUp className="w-4 h-4" />
                {i18n.language === 'th' ? 'ย่อทั้งหมด' : 'Collapse All'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {monthsWithHolidays.length === 0 ? (
              <div className="text-center py-12">
                <Icons.Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {i18n.language === 'th' ? 'ไม่มีวันหยุดในปีนี้' : 'No holidays found for this year'}
                </p>
              </div>
            ) : (
              monthsWithHolidays.map(monthIndex => {
                const monthHolidays = groupedHolidaysByMonth[monthIndex];
                const isExpanded = expandedMonths.has(monthIndex);
                const monthName = i18n.language === 'th' ? thaiMonthNames[monthIndex] : englishMonthNames[monthIndex];
                const monthGradient = getMonthGradient(monthIndex);

                return (
                  <div key={monthIndex} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Month Header */}
                    <button
                      onClick={() => toggleMonthExpansion(monthIndex)}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r hover:opacity-90 transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 bg-gradient-to-br ${monthGradient} rounded-lg text-white font-bold shadow-lg`}>
                          {monthIndex + 1}
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-gray-900 text-lg">
                            {monthName} {i18n.language === 'th' ? currentYear + 543 : currentYear}
                          </h4>
                          <p className="text-gray-600 text-sm">
                            {monthHolidays.length} {i18n.language === 'th' ? 'วันหยุด' : 'holidays'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icons.ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''
                            }`}
                        />
                      </div>
                    </button>

                    {/* Holiday Items (Collapsible) */}
                    {isExpanded && (
                      <div className="p-4 bg-gray-50 space-y-3 border-t border-gray-200">
                        {monthHolidays.map((holiday, index) => {
                          const date = new Date(holiday.holiday_date);
                          const dateStr = date.toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          });

                          const holidayBgGradient = 'from-orange-50 to-orange-100 border-orange-200';

                          const holidayIconBg = 'from-orange-500 to-orange-600';

                          return (
                            <div
                              key={holiday.id}
                              className={`group bg-gradient-to-r ${holidayBgGradient} rounded-xl p-4 border hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]`}
                              onClick={() => setSelectedHoliday(holiday)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className={`flex items-center justify-center w-10 h-10 bg-gradient-to-br ${holidayIconBg} rounded-lg text-white font-bold shadow-lg`}>
                                      {date.getDate()}
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-gray-900">
                                        {i18n.language === 'th' ? holiday.name_th : holiday.name_en}
                                      </h4>
                                      <p className="text-gray-600 text-sm">{dateStr}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Icons.MapPin className="w-4 h-4" />
                                      {holiday.location || (i18n.language === 'th' ? 'ทุกสถานที่' : 'All locations')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Icons.Building className="w-4 h-4" />
                                      {(i18n.language === 'th' ? 'วันหยุดบริษัท' : 'Company Holiday')}
                                    </span>
                                  </div>

                                  {holiday.notes && (
                                    <p className="mt-2 text-sm text-gray-600 bg-white/50 rounded-lg p-3">
                                      {holiday.notes}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Icons.ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }, [groupedHolidaysByMonth, monthsWithHolidays, expandedMonths, toggleMonthExpansion, expandAllMonths, collapseAllMonths, getMonthGradient, setSelectedHoliday, i18n.language, currentYear]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Modern Header */}
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-lg p-8 mb-1.5 border border-gray-200">
          {/* Logo Section - Centered */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100 mb-4">
              <div className="scale-[2.16]">
                <Logo />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 text-center">
              {i18n.language === 'th'
                ? `ปฏิทินวันหยุดประจำปี ${currentYear + 543}`
                : `Company Annual Holidays ${currentYear}`}
            </h1>
            <p className="text-gray-600 mt-2 text-center">
              {companyName}
            </p>
          </div>

          {/* Year Navigation - Centered */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => changeYear(-1)}
              className="p-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title={i18n.language === 'th' ? 'ปีก่อนหน้า' : 'Previous Year'}
            >
              <Icons.ChevronLeft className="w-5 h-5" />
            </button>

            <div className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold text-lg min-w-[120px] text-center">
              {i18n.language === 'th' ? currentYear + 543 : currentYear}
            </div>

            <button
              onClick={() => changeYear(1)}
              className="p-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title={i18n.language === 'th' ? 'ปีถัดไป' : 'Next Year'}
            >
              <Icons.ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Section - Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-200">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${viewMode === 'calendar'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <Icons.Calendar className="w-4 h-4" />
                <span className="text-sm">{i18n.language === 'th' ? 'ปฏิทิน' : 'Calendar'}</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${viewMode === 'list'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <Icons.List className="w-4 h-4" />
                <span className="text-sm">{i18n.language === 'th' ? 'รายการ' : 'List'}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadHolidays(false)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icons.RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">{i18n.language === 'th' ? 'รีเฟรช' : 'Refresh'}</span>
              </button>

              <button
                onClick={handleExportPDF}
                disabled={holidays.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icons.FileText className="w-4 h-4" />
                <span className="text-sm font-medium">{i18n.language === 'th' ? 'PDF' : 'PDF'}</span>
              </button>

              <button
                onClick={exportToCSV}
                disabled={holidays.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icons.Download className="w-4 h-4" />
                <span className="text-sm font-medium">{i18n.language === 'th' ? 'CSV' : 'CSV'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {!loading && holidays.length > 0 && (
          <>
            {viewMode === 'calendar' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                {/* Title and Stats */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icons.Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      {i18n.language === 'th' ? 'ปฏิทินวันหยุดบริษัท' : 'Company Holidays Calendar'}
                    </h2>
                    <p className="text-gray-600 mt-2 ml-13">
                      {i18n.language === 'th'
                        ? `แสดงวันหยุดบริษัททั้งหมด ${holidays.length} วัน`
                        : `Showing ${holidays.length} company holidays`}
                    </p>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 bg-orange-50 px-4 py-3 rounded-lg border border-orange-200">
                    <div className="w-6 h-6 bg-orange-500 rounded-md"></div>
                    <span className="text-sm font-medium text-gray-700">
                      {i18n.language === 'th' ? 'วันหยุดบริษัท' : 'Company Holiday'}
                    </span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Array.from({ length: 12 }, (_, monthIndex) => {
                    const monthDate = new Date(currentYear, monthIndex, 1);
                    const monthHolidays = holidays.filter(holiday => {
                      const holidayDate = new Date(holiday.holiday_date);
                      return holidayDate.getMonth() === monthIndex && holidayDate.getFullYear() === currentYear;
                    });

                    return (
                      <div key={monthIndex} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border border-slate-100">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                          <h3 className="text-center font-bold text-lg">
                            {i18n.language === 'th' ? thaiMonthNames[monthIndex] : englishMonthNames[monthIndex]} {i18n.language === 'th' ? currentYear + 543 : currentYear}
                          </h3>
                          <p className="text-center text-sm opacity-90 mt-1">
                            {monthHolidays.length} {i18n.language === 'th' ? 'วันหยุดบริษัท' : 'company holidays'}
                          </p>
                        </div>

                        <div className="p-3 min-h-[280px]">
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {(i18n.language === 'th' ? ['อ', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((day, dayIndex) => (
                              <div
                                key={`header-${dayIndex}`}
                                className={`text-center text-xs font-bold ${dayIndex === 0 ? 'text-red-600' : dayIndex === 6 ? 'text-blue-600' : 'text-gray-600'
                                  }`}
                              >
                                {day}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {getDaysInMonth(monthDate).map((day, dayIndex) => {
                              if (day === 0) {
                                return <div key={`empty-${dayIndex}`} className="h-7"></div>;
                              }

                              const date = new Date(currentYear, monthIndex, day);
                              const dateStr = date.toISOString().split('T')[0];
                              const dayHolidays = getHolidaysForDate(date);
                              const isToday = dateStr === new Date().toISOString().split('T')[0];

                              let cellStyle = 'h-7 text-xs border border-gray-100 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 rounded-lg transition-all';

                              if (dayHolidays.length > 0) {
                                const firstHoliday = dayHolidays[0];
                                const holidayColorStyle = getHolidayTypeColor();
                                cellStyle = `h-7 text-xs border-2 ${holidayColorStyle} flex flex-col items-center justify-center cursor-pointer hover:opacity-80 font-bold rounded-lg shadow-sm hover:shadow-md transition-all`;
                              }

                              if (isToday) {
                                cellStyle = `${cellStyle} ring-2 ring-yellow-400 bg-yellow-100`;
                              }

                              return (
                                <div
                                  key={day}
                                  className={cellStyle}
                                  title={dayHolidays.length > 0 ? dayHolidays.map(h =>
                                    i18n.language === 'th' ? h.name_th : h.name_en
                                  ).join(', ') : undefined}
                                  onClick={() => dayHolidays.length > 0 && setSelectedHoliday(dayHolidays[0])}
                                >
                                  <span className={isToday ? 'text-yellow-900 font-bold' : ''}>
                                    {day}
                                  </span>
                                  {dayHolidays.length > 0 && (
                                    <span className="text-xs leading-none">
                                      {'🏢'}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {monthHolidays.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {monthHolidays.map((holiday) => {
                                  const holidayBgColor = 'bg-orange-50 hover:bg-orange-100';
                                  const holidayIcon = '🏢';
                                  return (
                                    <div key={holiday.id} className={`flex items-center gap-2 text-xs text-gray-600 p-1.5 rounded cursor-pointer transition-colors ${holidayBgColor}`}
                                      onClick={() => setSelectedHoliday(holiday)}>
                                      <span className="shrink-0">{holidayIcon}</span>
                                      <span className="truncate font-medium">
                                        {i18n.language === 'th' ? holiday.name_th : holiday.name_en}
                                      </span>
                                      <span className="text-xs text-gray-400 ml-auto">
                                        {new Date(holiday.holiday_date).getDate()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'list' && <ListView />}
          </>
        )}

        {/* Holiday Detail Modal */}
        {selectedHoliday && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedHoliday(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  {i18n.language === 'th' ? 'รายละเอียดวันหยุด' : 'Holiday Details'}
                </h3>
                <button
                  onClick={() => setSelectedHoliday(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icons.X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl text-white font-bold text-lg">
                    {new Date(selectedHoliday.holiday_date).getDate()}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">
                      {i18n.language === 'th' ? selectedHoliday.name_th : selectedHoliday.name_en}
                    </h4>
                    <p className="text-gray-600 text-sm">
                      {new Date(selectedHoliday.holiday_date).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Icons.Building className="w-4 h-4 text-gray-600" />
                    </div>
                    <span className="text-sm">{(i18n.language === 'th' ? 'วันหยุดบริษัท' : 'Company Holiday')}</span>
                  </div>

                  {selectedHoliday.location && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icons.MapPin className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="text-sm">{selectedHoliday.location}</span>
                    </div>
                  )}

                  {selectedHoliday.notes && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">{i18n.language === 'th' ? 'หมายเหตุ:' : 'Notes:'}</span><br />
                        {selectedHoliday.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-200">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-xl">
              <Icons.RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <p className="text-gray-600 mt-4 font-medium">
              {i18n.language === 'th' ? 'กำลังโหลดวันหยุด...' : 'Loading holidays...'}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-xl">
              <Icons.AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-red-700 font-medium mt-4">
              {i18n.language === 'th' ? 'เกิดข้อผิดพลาด: ' : 'Error: '} {error}
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && holidays.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-xl">
              <Icons.Calendar className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-bold text-yellow-800 mt-4">
              {i18n.language === 'th' ? 'ยังไม่มีวันหยุดประจำปี' : 'No holidays found'}
            </h3>
            <p className="text-yellow-700 mt-2">
              {i18n.language === 'th'
                ? `ไม่พบวันหยุดสำหรับปี ${currentYear + 543}`
                : `No holidays found for year ${currentYear}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
