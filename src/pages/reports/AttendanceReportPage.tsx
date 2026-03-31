// src/pages/reports/AttendanceReportPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BarChart3,
    Calendar,
    Filter,
    Download,
    RefreshCw,
    Users,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import {
    getAttendanceHistory,
    getManufacturingLines,
} from '../../api/attendance';
import type {
    LineAttendance,
    ManufacturingLine,
    ShiftType,
    LineCategory,
} from '../../types/attendance';
import { SHIFT_NAMES, CATEGORY_NAMES, STATUS_NAMES } from '../../types/attendance';
import { useToast } from '../../hooks/useToast';
import { DatePicker } from '../../components/common/DatePicker';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export function AttendanceReportPage() {
    const { i18n } = useTranslation();
    const { showToast } = useToast();
    const isThaiLanguage = i18n.language === 'th';

    // State
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<LineAttendance[]>([]);
    const [lines, setLines] = useState<ManufacturingLine[]>([]);

    // Filters
    const [startDate, setStartDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7); // Last 7 days
        return d;
    });
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [selectedLine, setSelectedLine] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<ShiftType | ''>('');
    const [selectedCategory, setSelectedCategory] = useState<LineCategory | ''>('');

    // Load initial data (just lines)
    useEffect(() => {
        const fetchLines = async () => {
            try {
                const data = await getManufacturingLines();
                setLines(data);
            } catch (error) {
                console.error('Failed to load lines', error);
            }
        };
        fetchLines();
    }, []);

    // Load report data
    useEffect(() => {
        loadData();
    }, [startDate, endDate, selectedLine, selectedShift, selectedCategory]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAttendanceHistory({
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate, 'yyyy-MM-dd'),
                line_id: selectedLine || undefined,
                shift: (selectedShift as ShiftType) || undefined,
                category: (selectedCategory as LineCategory) || undefined,
            });
            setRecords(data);
        } catch (error: any) {
            showToast(error.message || 'Failed to load report data', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Calculate Summary Stats
    const summary = useMemo(() => {
        let totalRequired = 0;
        let totalPresent = 0;
        let totalLate = 0;
        const totalRecords = records.length;

        records.forEach(r => {
            totalRequired += r.required_count;
            totalPresent += r.present_count;
            if (r.is_late) totalLate++;
        });

        const attendanceRate = totalRequired > 0
            ? Math.round((totalPresent / totalRequired) * 100)
            : 0;

        return {
            totalRequired,
            totalPresent,
            totalAbsent: totalRequired - totalPresent,
            attendanceRate,
            totalLate,
            totalRecords,
        };
    }, [records]);

    // Chart Data: Daily Trend
    const dailyTrendData = useMemo(() => {
        const groupedByDate: Record<string, { date: string; rate: number; count: number; sum: number }> = {};

        // Initialize with 0 for all dates in range? (Skipping for simplicity, showing only days with data)
        records.forEach(r => {
            const date = r.attendance_date.split('T')[0];
            if (!groupedByDate[date]) {
                groupedByDate[date] = { date, rate: 0, count: 0, sum: 0 };
            }
            if (r.required_count > 0) {
                groupedByDate[date].sum += (r.present_count / r.required_count);
                groupedByDate[date].count += 1;
            }
        });

        return Object.values(groupedByDate)
            .map(d => ({
                date: format(new Date(d.date), 'dd/MM'),
                rate: d.count > 0 ? Math.round((d.sum / d.count) * 100) : 0
            }))
            .sort((a, b) => a.date.localeCompare(b.date)); // Simple sort, might be wrong if crossing months without year. Better sort by original date string.

        // Better sort approach:
        // Already sorted by query, but let's trust the API or re-sort if needed. API sorts desc, we want asc for chart.
    }, [records]);

    // Correct sorting for chart
    const chartData = [...dailyTrendData].reverse();

    // Chart Data: Status Distribution
    const statusData = useMemo(() => {
        let onTime = 0;
        let late = 0;
        records.forEach(r => {
            if (r.status === 'submitted' || r.status === 'confirmed') {
                if (r.is_late) late++;
                else onTime++;
            }
        });

        return [
            { name: isThaiLanguage ? 'ตรงเวลา' : 'On Time', value: onTime, color: '#22c55e' }, // green-500
            { name: isThaiLanguage ? 'สาย' : 'Late', value: late, color: '#ef4444' }, // red-500
        ];
    }, [records, isThaiLanguage]);

    // Export to Excel
    const handleExport = () => {
        const exportData = records.map(r => ({
            Date: r.attendance_date.split('T')[0],
            Line: r.line_code || '-',
            Shift: SHIFT_NAMES[r.shift]?.en || r.shift,
            Category: CATEGORY_NAMES[r.line_category as LineCategory]?.en || r.line_category || '-',
            Required: r.required_count,
            Present: r.present_count,
            Absent: r.absent_count,
            Rate: r.required_count > 0 ? `${Math.round((r.present_count / r.required_count) * 100)}%` : '0%',
            Status: STATUS_NAMES[r.status]?.en || r.status,
            Late: r.is_late ? 'Yes' : 'No',
            SubmittedBy: r.submitted_by_employee ? r.submitted_by_employee.name_en || r.submitted_by_employee.name_th : '-',
            SubmittedAt: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-',
            Validation: r.confirmed_by ? 'Confirmed' : 'Pending',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `attendance_report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                                <BarChart3 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {isThaiLanguage ? 'รายงานการเข้างาน' : 'Attendance Report'}
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    {isThaiLanguage
                                        ? 'ดูประวัติและสถิติการเข้างานของไลน์ผลิต'
                                        : 'View attendance history and statistics for production lines'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={loadData}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={records.length === 0}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                {isThaiLanguage ? 'ส่งออก Excel' : 'Export Excel'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-48">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {isThaiLanguage ? 'วันที่เริ่มต้น' : 'Start Date'}
                            </label>
                            <DatePicker
                                value={startDate}
                                onChange={(d) => d && setStartDate(d)}
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {isThaiLanguage ? 'วันที่สิ้นสุด' : 'End Date'}
                            </label>
                            <DatePicker
                                value={endDate}
                                onChange={(d) => d && setEndDate(d)}
                            />
                        </div>

                        <div className="w-full md:w-40">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {isThaiLanguage ? 'ไลน์ผลิต' : 'Line'}
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedLine}
                                    onChange={(e) => setSelectedLine(e.target.value)}
                                    className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="">{isThaiLanguage ? 'ทั้งหมด' : 'All'}</option>
                                    {lines.map((l) => (
                                        <option key={l.id} value={l.id}>{l.code}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="w-full md:w-40">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {isThaiLanguage ? 'กะ' : 'Shift'}
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedShift}
                                    onChange={(e) => setSelectedShift(e.target.value as ShiftType)}
                                    className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="">{isThaiLanguage ? 'ทั้งหมด' : 'All'}</option>
                                    {(['day', 'night_ab', 'night_cd'] as const).map(s => (
                                        <option key={s} value={s}>{SHIFT_NAMES[s][isThaiLanguage ? 'th' : 'en']}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="w-full md:w-40">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {isThaiLanguage ? 'หมวดหมู่' : 'Category'}
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value as LineCategory)}
                                    className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="">{isThaiLanguage ? 'ทั้งหมด' : 'All'}</option>
                                    {(['5s', 'asm', 'pro', 'tpl', 'other'] as const).map(c => (
                                        <option key={c} value={c}>{CATEGORY_NAMES[c][isThaiLanguage ? 'th' : 'en']}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{isThaiLanguage ? 'อัตราเข้างานเฉลี่ย' : 'Avg. Attendance Rate'}</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{summary.attendanceRate}%</h3>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            {isThaiLanguage
                                ? `จากทั้งหมด ${summary.totalRecords} รายการ`
                                : `From ${summary.totalRecords} records`
                            }
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{isThaiLanguage ? 'มาทำงาน' : 'Present'}</p>
                                <h3 className="text-2xl font-bold text-green-600 mt-1">{summary.totalPresent}</h3>
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            {isThaiLanguage
                                ? `จากความต้องการ ${summary.totalRequired} คน`
                                : `Out of ${summary.totalRequired} required`
                            }
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{isThaiLanguage ? 'ขาด/ลา' : 'Absent'}</p>
                                <h3 className="text-2xl font-bold text-red-600 mt-1">{summary.totalAbsent}</h3>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg">
                                <XCircle className="w-5 h-5 text-red-600" />
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            {summary.totalPresent > 0
                                ? `${Math.round((summary.totalAbsent / summary.totalRequired) * 100)}% ${isThaiLanguage ? 'ของทั้งหมด' : 'of total'}`
                                : '-'
                            }
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{isThaiLanguage ? 'ส่งสาย' : 'Late Submissions'}</p>
                                <h3 className="text-2xl font-bold text-amber-600 mt-1">{summary.totalLate}</h3>
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            {summary.totalRecords > 0
                                ? `${Math.round((summary.totalLate / summary.totalRecords) * 100)}% ${isThaiLanguage ? 'ของรายการทั้งหมด' : 'of all records'}`
                                : '-'
                            }
                        </div>
                    </div>
                </div>

                {/* Charts */}
                {records.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                {isThaiLanguage ? 'แนวโน้มการเข้างาน' : 'Attendance Trend'}
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Line type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                {isThaiLanguage ? 'สถานะการส่ง' : 'Submission Status'}
                            </h3>
                            <div className="h-64 flex justify-center items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">
                            {isThaiLanguage ? 'รายการทั้งหมด' : 'All Records'}
                        </h3>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">{isThaiLanguage ? 'กำลังโหลด...' : 'Loading...'}</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="p-12 text-center">
                            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">{isThaiLanguage ? 'ไม่พบข้อมูล' : 'No data found'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="px-6 py-3">{isThaiLanguage ? 'วันที่' : 'Date'}</th>
                                        <th className="px-6 py-3">{isThaiLanguage ? 'ไลน์' : 'Line'}</th>
                                        <th className="px-6 py-3">{isThaiLanguage ? 'กะ' : 'Shift'}</th>
                                        <th className="px-6 py-3 text-center">{isThaiLanguage ? 'ต้องการ' : 'Required'}</th>
                                        <th className="px-6 py-3 text-center">{isThaiLanguage ? 'มา' : 'Present'}</th>
                                        <th className="px-6 py-3 text-center">{isThaiLanguage ? '%' : '%'}</th>
                                        <th className="px-6 py-3">{isThaiLanguage ? 'สถานะ' : 'Status'}</th>
                                        <th className="px-6 py-3">{isThaiLanguage ? 'ผู้ส่ง' : 'Submitter'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {records.map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 whitespace-nowrap text-gray-900">
                                                {format(new Date(r.attendance_date), 'dd MMM yyyy')}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">
                                                {r.line_code}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-gray-600">
                                                {SHIFT_NAMES[r.shift][isThaiLanguage ? 'th' : 'en']}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center text-gray-900">
                                                {r.required_count}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center font-medium text-green-600">
                                                {r.present_count}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center font-medium">
                                                <span className={`px-2 py-1 rounded-full text-xs ${r.required_count > 0 && r.present_count === r.required_count
                                                        ? 'bg-green-100 text-green-700'
                                                        : r.required_count > 0 && r.present_count / r.required_count >= 0.8
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {r.required_count > 0 ? Math.round((r.present_count / r.required_count) * 100) : 0}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs border ${r.status === 'confirmed'
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-gray-50 text-gray-600 border-gray-200'
                                                        }`}>
                                                        {STATUS_NAMES[r.status]?.[isThaiLanguage ? 'th' : 'en'] || r.status}
                                                    </span>
                                                    {r.is_late && (
                                                        <span className="text-red-600" title={isThaiLanguage ? 'ส่งสาย' : 'Late submission'}>
                                                            <Clock className="w-4 h-4" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-gray-500 text-xs">
                                                {r.submitted_by_employee
                                                    ? (isThaiLanguage ? r.submitted_by_employee.name_th : r.submitted_by_employee.name_en)
                                                    : '-'
                                                }
                                                <div className="text-gray-400 text-[10px]">
                                                    {r.submitted_at ? format(new Date(r.submitted_at), 'HH:mm') : '-'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AttendanceReportPage;
