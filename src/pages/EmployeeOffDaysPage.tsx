import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, List, Download, RefreshCw, Info } from 'lucide-react';
import api from '../api/auth';
import { useAuth } from '../hooks/useAuth';

interface OffDay {
    id: string;
    employee_id: number;
    off_date: string;
    off_type: string;
    notes: string | null;
    created_at: string;
}

const OFF_DAY_COLORS: Record<string, string> = {
    weekly_saturday: 'bg-blue-100 border-blue-400 text-blue-900',
    alternating_saturday: 'bg-purple-100 border-purple-400 text-purple-900',
    weekly_sunday: 'bg-green-100 border-green-400 text-green-900',
    custom: 'bg-gray-100 border-gray-400 text-gray-900',
};

const OFF_DAY_LABELS: Record<string, { th: string; en: string }> = {
    weekly_saturday: { th: 'หยุดเสาร์ทุกสัปดาห์', en: 'Weekly Saturday Off' },
    alternating_saturday: { th: 'หยุดเสาร์เว้นเสาร์', en: 'Alternating Saturday Off' },
    weekly_sunday: { th: 'หยุดอาทิตย์ทุกสัปดาห์', en: 'Weekly Sunday Off' },
    custom: { th: 'กำหนดเอง', en: 'Custom Off-Day' },
};

export function EmployeeOffDaysPage() {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const [offDays, setOffDays] = useState<OffDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const loadOffDays = useCallback(async () => {
        try {
            setLoading(true);
            const startDate = `${currentYear}-01-01`;
            const endDate = `${currentYear}-12-31`;

            const response = await api.get(`/employee-off-days?start_date=${startDate}&end_date=${endDate}`);
            setOffDays(response.data.off_days || []);
        } catch (error) {
            console.error('Failed to load off-days:', error);
        } finally {
            setLoading(false);
        }
    }, [currentYear]);

    useEffect(() => {
        loadOffDays();
    }, [loadOffDays]);

    const groupedByMonth = useMemo(() => {
        const grouped: { [key: number]: OffDay[] } = {};

        for (let i = 0; i < 12; i++) {
            grouped[i] = [];
        }

        offDays.forEach(offDay => {
            // Safely parse month from YYYY-MM-DD string part
            const dateStr = offDay.off_date.split('T')[0];
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
                const month = parseInt(parts[1], 10) - 1; // 0-indexed
                if (grouped[month]) {
                    grouped[month].push(offDay);
                }
            }
        });

        return grouped;
    }, [offDays]);

    const exportToCSV = () => {
        const headers = i18n.language === 'th'
            ? ['วันที่', 'ประเภท', 'หมายเหตุ']
            : ['Date', 'Type', 'Notes'];

        const rows = offDays.map(offDay => {
            const date = new Date(offDay.off_date).toLocaleDateString('th-TH');
            const type = OFF_DAY_LABELS[offDay.off_type]?.[i18n.language] || offDay.off_type;
            return [date, type, offDay.notes || ''];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `my-off-days-${currentYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const getDaysInMonth = (monthIndex: number) => {
        const date = new Date(currentYear, monthIndex, 1);
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

    const isOffDay = (monthIndex: number, day: number) => {
        const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return offDays.find(od => {
            // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss..." formats
            return od.off_date.split('T')[0] === dateStr;
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {i18n.language === 'th' ? 'วันหยุดของฉัน' : 'My Off-Days'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {i18n.language === 'th'
                                ? `แสดงวันหยุดที่กำหนดไว้สำหรับคุณ (${offDays.length} วัน)`
                                : `Your scheduled off-days (${offDays.length} days)`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentYear(currentYear - 1)}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            ← {currentYear - 1}
                        </button>
                        <div className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">
                            {i18n.language === 'th' ? currentYear + 543 : currentYear}
                        </div>
                        <button
                            onClick={() => setCurrentYear(currentYear + 1)}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            {currentYear + 1} →
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="inline-flex rounded-lg bg-gray-100 p-1">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Calendar className="w-4 h-4" />
                            {i18n.language === 'th' ? 'ปฏิทิน' : 'Calendar'}
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <List className="w-4 h-4" />
                            {i18n.language === 'th' ? 'รายการ' : 'List'}
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={loadOffDays}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {i18n.language === 'th' ? 'รีเฟรช' : 'Refresh'}
                        </button>
                        <button
                            onClick={exportToCSV}
                            disabled={offDays.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {i18n.language === 'th' ? 'ส่งออก CSV' : 'Export CSV'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-900 mb-2">
                            {i18n.language === 'th' ? 'ประเภทวันหยุด:' : 'Off-Day Types:'}
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(OFF_DAY_LABELS).map(([type, labels]) => (
                                <div key={type} className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border-2 ${OFF_DAY_COLORS[type]}`} />
                                    <span className="text-sm text-gray-700">
                                        {labels[i18n.language]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar View */}
            {viewMode === 'calendar' && !loading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 12 }, (_, monthIndex) => {
                        const monthOffDays = groupedByMonth[monthIndex];
                        const monthName = i18n.language === 'th' ? thaiMonths[monthIndex] : englishMonths[monthIndex];

                        return (
                            <div key={monthIndex} className="bg-white rounded-lg shadow overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                                    <h3 className="text-center font-bold">
                                        {monthName} {i18n.language === 'th' ? currentYear + 543 : currentYear}
                                    </h3>
                                    <p className="text-center text-sm opacity-90 mt-1">
                                        {monthOffDays.length} {i18n.language === 'th' ? 'วันหยุด' : 'off-days'}
                                    </p>
                                </div>

                                <div className="p-3">
                                    {/* Weekday headers */}
                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {(i18n.language === 'th' ? ['อ', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((day, idx) => (
                                            <div key={idx} className={`text-center text-xs font-bold ${idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-600'
                                                }`}>
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar days */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {getDaysInMonth(monthIndex).map((day, idx) => {
                                            if (day === 0) {
                                                return <div key={`empty-${idx}`} className="h-8" />;
                                            }

                                            const offDay = isOffDay(monthIndex, day);
                                            const isToday =
                                                new Date().getDate() === day &&
                                                new Date().getMonth() === monthIndex &&
                                                new Date().getFullYear() === currentYear;

                                            return (
                                                <div
                                                    key={day}
                                                    className={`h-8 text-xs flex items-center justify-center rounded border ${offDay
                                                        ? `border-2 font-bold ${OFF_DAY_COLORS[offDay.off_type]}`
                                                        : 'border-gray-100 hover:bg-gray-50'
                                                        } ${isToday ? 'ring-2 ring-yellow-400' : ''}`}
                                                    title={offDay ? OFF_DAY_LABELS[offDay.off_type]?.[i18n.language] : ''}
                                                >
                                                    {day}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && !loading && (
                <div className="bg-white rounded-lg shadow">
                    {offDays.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            {i18n.language === 'th' ? 'ไม่มีวันหยุดที่กำหนดไว้' : 'No off-days scheduled'}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {offDays.map(offDay => (
                                <div key={offDay.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${OFF_DAY_COLORS[offDay.off_type]}`} />
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {new Date(offDay.off_date).toLocaleDateString('th-TH', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                    })}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {OFF_DAY_LABELS[offDay.off_type]?.[i18n.language]}
                                                </div>
                                            </div>
                                        </div>
                                        {offDay.notes && (
                                            <div className="text-sm text-gray-500 max-w-xs">
                                                {offDay.notes}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                    <p className="mt-4 text-gray-600">
                        {i18n.language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                    </p>
                </div>
            )}
        </div>
    );
}

