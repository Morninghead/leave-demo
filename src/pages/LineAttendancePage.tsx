// src/pages/LineAttendancePage.tsx
// Daily Line Attendance submission and dashboard

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users,
    Calendar,
    Clock,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Sun,
    Moon,
    ChevronDown,
    Send,
    Search,
    Filter,
    UserCircle,
} from 'lucide-react';
import {
    getLineAttendanceStatus,
    getAttendanceSummary,
} from '../api/attendance';
import type {
    LineAttendanceStatus,
    AttendanceSummary,
    ShiftType,
    LineCategory,
} from '../types/attendance';
import { SHIFT_NAMES, CATEGORY_NAMES, CATEGORY_COLORS } from '../types/attendance';
import { useToast } from '../hooks/useToast';
import { DatePicker } from '../components/common/DatePicker';
import { AttendanceFormModal } from '../components/attendance/AttendanceFormModal';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

export function LineAttendancePage() {
    const { i18n } = useTranslation();
    const { showToast } = useToast();
    const isThaiLanguage = i18n.language === 'th';

    // State
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState<Date>(new Date());
    const [shift, setShift] = useState<ShiftType>('day');
    const [lines, setLines] = useState<LineAttendanceStatus[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [activeCategory, setActiveCategory] = useState<LineCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [selectedLine, setSelectedLine] = useState<LineAttendanceStatus | null>(null);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);

    // Format date for API
    const dateString = useMemo(() => {
        return date.toISOString().split('T')[0];
    }, [date]);

    // Load data
    useEffect(() => {
        loadData();
    }, [dateString, shift]);

    // Auto-refresh every 2 minutes for line attendance dashboard
    // This allows monitoring of real-time attendance submissions
    useAutoRefresh({
        category: 'DASHBOARD',
        dataType: 'ACTIVE',
        onRefresh: () => loadData(true),
        enabled: !showAttendanceModal,
    });

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const [linesData, summaryData] = await Promise.all([
                getLineAttendanceStatus({ date: dateString, shift }),
                getAttendanceSummary({ date: dateString, shift }),
            ]);

            setLines(linesData);
            setSummary(summaryData);
        } catch (error: any) {
            showToast(error.message || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter lines
    const filteredLines = useMemo(() => {
        return lines.filter((item) => {
            if (activeCategory !== 'all' && item.line.category !== activeCategory) {
                return false;
            }
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (
                    item.line.code.toLowerCase().includes(search) ||
                    item.line.name_th?.toLowerCase().includes(search) ||
                    item.line.name_en?.toLowerCase().includes(search)
                );
            }
            return true;
        });
    }, [lines, activeCategory, searchTerm]);

    // Group by category
    const groupedLines = useMemo(() => {
        const groups: Record<string, LineAttendanceStatus[]> = {};
        filteredLines.forEach((item) => {
            const cat = item.line.category;
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [filteredLines]);

    // Sort categories
    const sortedCategories = useMemo(() => {
        return Object.keys(groupedLines).sort((a, b) => {
            const order = ['5s', 'asm', 'pro', 'tpl', 'other'];
            return order.indexOf(a) - order.indexOf(b);
        });
    }, [groupedLines]);

    // Get status colors
    const getStatusBadge = (status: string, isLate: boolean) => {
        if (status === 'not_submitted') {
            return (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    {isThaiLanguage ? 'ยังไม่ส่ง' : 'Not Submitted'}
                </span>
            );
        }
        if (status === 'submitted' || status === 'confirmed') {
            return (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${isLate
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                    {status === 'confirmed'
                        ? (isThaiLanguage ? 'ยืนยันแล้ว' : 'Confirmed')
                        : isLate
                            ? (isThaiLanguage ? 'ส่งแล้ว (สาย)' : 'Submitted (Late)')
                            : (isThaiLanguage ? 'ส่งแล้ว' : 'Submitted')}
                </span>
            );
        }
        return null;
    };

    // Calculate progress for a line
    const getProgressBar = (present: number, required: number) => {
        const percentage = required > 0 ? Math.round((present / required) * 100) : 0;
        const color = percentage >= 100 ? 'bg-green-500'
            : percentage >= 80 ? 'bg-blue-500'
                : percentage >= 60 ? 'bg-amber-500'
                    : 'bg-red-500';

        return (
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className={`h-2 rounded-full ${color} transition-all duration-300`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
        );
    };

    // Category tabs
    const categories = [
        { key: 'all' as const, label: isThaiLanguage ? 'ทั้งหมด' : 'All' },
        { key: '5s' as const, label: '5S' },
        { key: 'asm' as const, label: 'Assembly' },
        { key: 'pro' as const, label: 'Processing' },
        { key: 'tpl' as const, label: 'TPL' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {isThaiLanguage ? 'รายงานประจำวัน' : 'Daily Line Attendance'}
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    {isThaiLanguage
                                        ? 'ติดตามสถานะการรายงานพนักงานในแต่ละไลน์'
                                        : 'Track attendance status for each production line'}
                                </p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Date Picker */}
                            <div className="w-40">
                                <DatePicker
                                    value={date}
                                    onChange={(d) => d && setDate(d)}
                                    placeholder={isThaiLanguage ? 'เลือกวันที่' : 'Select date'}
                                />
                            </div>

                            {/* Shift Selector */}
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                {(['day', 'night_ab', 'night_cd'] as const).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setShift(s)}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${shift === s
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {s === 'day' ? (
                                            <Sun className="w-4 h-4 inline mr-1" />
                                        ) : (
                                            <Moon className="w-4 h-4 inline mr-1" />
                                        )}
                                        {SHIFT_NAMES[s][isThaiLanguage ? 'th' : 'en']}
                                    </button>
                                ))}
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={() => loadData(false)}
                                disabled={loading}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">{isThaiLanguage ? 'ไลน์ทั้งหมด' : 'Total Lines'}</p>
                                    <p className="text-2xl font-bold text-gray-900">{summary.total_lines}</p>
                                </div>
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <Users className="w-5 h-5 text-gray-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-100 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-green-600 uppercase">{isThaiLanguage ? 'ส่งแล้ว' : 'Submitted'}</p>
                                    <p className="text-2xl font-bold text-green-900">{summary.submitted_lines}</p>
                                </div>
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-100 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-amber-600 uppercase">{isThaiLanguage ? 'รอดำเนินการ' : 'Pending'}</p>
                                    <p className="text-2xl font-bold text-amber-900">{summary.pending_lines}</p>
                                </div>
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl shadow-sm border border-red-100 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-red-600 uppercase">{isThaiLanguage ? 'ส่งสาย' : 'Late'}</p>
                                    <p className="text-2xl font-bold text-red-900">{summary.late_submissions}</p>
                                </div>
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-blue-600 uppercase">{isThaiLanguage ? 'อัตราเข้างาน' : 'Rate'}</p>
                                    <p className="text-2xl font-bold text-blue-900">{summary.overall_attendance_rate}%</p>
                                </div>
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl shadow-sm border border-purple-100 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-purple-600 uppercase">{isThaiLanguage ? 'มาทำงาน' : 'Present'}</p>
                                    <p className="text-2xl font-bold text-purple-900">
                                        {summary.total_present}/{summary.total_required}
                                    </p>
                                </div>
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Tabs & Search */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                            {categories.map((cat) => {
                                const count = cat.key === 'all'
                                    ? lines.length
                                    : lines.filter((l) => l.line.category === cat.key).length;

                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => setActiveCategory(cat.key)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.key
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {cat.label}
                                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${activeCategory === cat.key
                                            ? 'bg-white/20 text-white'
                                            : 'bg-gray-200 text-gray-600'
                                            }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={isThaiLanguage ? 'ค้นหาไลน์...' : 'Search lines...'}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Lines Grid */}
                {loading ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">{isThaiLanguage ? 'กำลังโหลด...' : 'Loading...'}</p>
                    </div>
                ) : filteredLines.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">{isThaiLanguage ? 'ไม่พบไลน์' : 'No lines found'}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedCategories.map((category) => (
                            <div key={category} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                {/* Category Header */}
                                <div className={`px-6 py-4 border-b border-gray-100 bg-gradient-to-r ${category === '5s' ? 'from-purple-50 to-violet-50'
                                    : category === 'asm' ? 'from-blue-50 to-indigo-50'
                                        : category === 'pro' ? 'from-green-50 to-emerald-50'
                                            : category === 'tpl' ? 'from-orange-50 to-amber-50'
                                                : 'from-gray-50 to-slate-50'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-900">
                                            {CATEGORY_NAMES[category as LineCategory]?.en || category.toUpperCase()}
                                        </h2>
                                        <span className="text-sm text-gray-600">
                                            {groupedLines[category]?.length || 0} {isThaiLanguage ? 'ไลน์' : 'lines'}
                                        </span>
                                    </div>
                                </div>

                                {/* Lines Table */}
                                <div className="divide-y divide-gray-100">
                                    {groupedLines[category]?.map((item) => (
                                        <div
                                            key={item.line.id}
                                            className="px-6 py-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center gap-4"
                                        >
                                            {/* Line Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-700">
                                                        {item.line.code}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{item.line.code}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {isThaiLanguage ? item.line.name_th : item.line.name_en || item.line.code}
                                                        </p>
                                                        {(item.line.line_leader_name_th || item.line.line_leader_name_en) && (
                                                            <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                                                                <UserCircle className="w-3 h-3" />
                                                                {isThaiLanguage
                                                                    ? (item.line.line_leader_name_th || item.line.line_leader_name_en)
                                                                    : (item.line.line_leader_name_en || item.line.line_leader_name_th)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="md:w-32">
                                                {getStatusBadge(item.status, item.is_late)}
                                            </div>

                                            {/* Attendance Progress */}
                                            <div className="md:w-48">
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-gray-600">
                                                        {item.present_count}/{item.required_count}
                                                    </span>
                                                    <span className={`font-medium ${item.present_count >= item.required_count ? 'text-green-600'
                                                        : item.present_count >= item.required_count * 0.8 ? 'text-blue-600'
                                                            : 'text-amber-600'
                                                        }`}>
                                                        {item.required_count > 0
                                                            ? Math.round((item.present_count / item.required_count) * 100)
                                                            : 0}%
                                                    </span>
                                                </div>
                                                {getProgressBar(item.present_count, item.required_count)}
                                            </div>

                                            {/* Replacement Badge */}
                                            {item.replacement_requested > 0 && (
                                                <div className="md:w-24">
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                                                        {isThaiLanguage ? 'ขอคน' : 'Need'} +{item.replacement_requested}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Action Button */}
                                            <div className="md:w-32 flex justify-end">
                                                <button
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${item.status === 'not_submitted'
                                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                    onClick={() => {
                                                        setSelectedLine(item);
                                                        setShowAttendanceModal(true);
                                                    }}
                                                >
                                                    {item.status === 'not_submitted'
                                                        ? (isThaiLanguage ? 'ส่งรายชื่อ' : 'Submit')
                                                        : (isThaiLanguage ? 'ดูรายละเอียด' : 'View')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Attendance Form Modal */}
            {selectedLine && (
                <AttendanceFormModal
                    isOpen={showAttendanceModal}
                    onClose={() => {
                        setShowAttendanceModal(false);
                        setSelectedLine(null);
                    }}
                    lineId={selectedLine.line.id}
                    lineCode={selectedLine.line.code}
                    lineName={isThaiLanguage ? (selectedLine.line.name_th || selectedLine.line.code) : (selectedLine.line.name_en || selectedLine.line.code)}
                    date={dateString}
                    shift={shift}
                    requiredCount={selectedLine.required_count}
                    onSuccess={() => {
                        loadData();
                    }}
                />
            )}
        </div>
    );
}

export default LineAttendancePage;
