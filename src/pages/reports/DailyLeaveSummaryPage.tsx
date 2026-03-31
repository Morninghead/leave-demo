/**
 * Daily Leave Summary Report Page
 * 
 * Shows daily/weekly/monthly leave summary with employee names
 * Grouped by date and leave type
 */

import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CalendarDays,
    Download,
    Building2,
    ArrowLeft,
    Users,
    ChevronDown,
    ChevronRight,
    Calendar,
    CalendarRange,
    BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    getDailyLeaveSummaryReport,
    DailyLeaveSummaryReport,
    DailyLeaveGroup,
    WeeklyLeaveGroup,
    MonthlyLeaveGroup,
    LeaveEmployeeEntry
} from '../../api/dailyLeaveSummary';
import { DatePicker } from '../../components/common/DatePicker';
import { getFiscalMonthContext, getFiscalMonthRange } from '../../utils/dateUtils';
import { exportToPDF } from '../../utils/exportToPDF'; // Added import
import api from '../../api/auth';
import { AttachmentBadge } from '../../components/common/AttachmentBadge';

interface Department {
    id: string;
    code: string;
    name_th: string;
    name_en: string;
}

export default function DailyLeaveSummaryPage() {
    const { i18n } = useTranslation();
    const navigate = useNavigate();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [groupBy, setGroupBy] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<DailyLeaveSummaryReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingDepts, setLoadingDepts] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    // Helper to normalize date string to Date object (local time midnight)
    const getDateObject = (dateStr: string) => {
        if (!dateStr) return null;
        return new Date(dateStr);
    };

    // Helper to format Date object to YYYY-MM-DD string
    const handleDateChange = (setter: (val: string) => void) => (date: Date | null) => {
        if (!date) {
            setter('');
            return;
        }
        // Force YYYY-MM-DD format manually to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
    };

    // Set default date range (current fiscal month)
    useEffect(() => {
        const now = new Date();
        const { year, month } = getFiscalMonthContext(now);
        const { startDate, endDate } = getFiscalMonthRange(year, month);

        setStartDate(startDate);
        setEndDate(endDate);
    }, []);

    // Load departments
    useEffect(() => {
        loadDepartments();
    }, []);

    const loadDepartments = async () => {
        setLoadingDepts(true);
        try {
            const response = await api.get('/departments');
            setDepartments(response.data.departments || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load departments');
        } finally {
            setLoadingDepts(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            setError(i18n.language === 'th' ? 'กรุณาเลือกช่วงวันที่' : 'Please select date range');
            return;
        }

        setLoading(true);
        setError(null);
        setExpandedDates(new Set());

        try {
            const data = await getDailyLeaveSummaryReport({
                start_date: startDate,
                end_date: endDate,
                department_id: selectedDeptId || undefined,
                group_by: groupBy,
            });

            setReportData(data);
        } catch (err: any) {
            setError(err.message || (i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการสร้างรายงาน' : 'Failed to generate report'));
        } finally {
            setLoading(false);
        }
    };

    const toggleDateExpand = (key: string) => {
        const newExpanded = new Set(expandedDates);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedDates(newExpanded);
    };

    const expandAll = () => {
        if (!reportData) return;
        const allKeys = reportData.data.map((item: any) =>
            item.date || item.week || item.month
        );
        setExpandedDates(new Set(allKeys));
    };

    const collapseAll = () => {
        setExpandedDates(new Set());
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        if (i18n.language === 'th') {
            return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
        }
        return `${daysEn[date.getDay()]} ${date.toLocaleDateString('en-GB')}`;
    };

    const getMonthName = (monthNumber: number) => {
        const monthsTh = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return i18n.language === 'th' ? monthsTh[monthNumber - 1] : monthsEn[monthNumber - 1];
    };

    const handleExportPDF = () => {
        if (!reportData) return;

        const columns = [
            { header: i18n.language === 'th' ? 'กลุ่มเวลา' : 'Time Group', dataKey: 'group_date' },
            { header: i18n.language === 'th' ? 'รหัส' : 'ID', dataKey: 'code' },
            { header: i18n.language === 'th' ? 'ชื่อ-นามสกุล' : 'Name', dataKey: 'name' },
            { header: i18n.language === 'th' ? 'แผนก' : 'Dept', dataKey: 'dept' },
            { header: i18n.language === 'th' ? 'ประเภท' : 'Type', dataKey: 'type' },
            { header: i18n.language === 'th' ? 'สถานะ' : 'Status', dataKey: 'status' },
            { header: i18n.language === 'th' ? 'จำนวน' : 'Amount', dataKey: 'amount' },
            { header: i18n.language === 'th' ? 'ช่วงเวลา' : 'Period', dataKey: 'period' },
            { header: i18n.language === 'th' ? 'เลขที่คำขอ' : 'Ref No.', dataKey: 'ref_no' },
        ];

        const rows: any[] = [];

        // Helper to process entries
        const processEmployees = (groupLabel: string, employees: LeaveEmployeeEntry[]) => {
            // Sort: Pending first, then Approved
            const sortedEmployees = [...employees].sort((a, b) => {
                if (a.status === b.status) return 0;
                return a.status === 'pending' ? -1 : 1;
            });

            sortedEmployees.forEach(emp => {
                rows.push({
                    group_date: groupLabel,
                    code: emp.employee_code,
                    name: i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en,
                    dept: i18n.language === 'th' ? emp.department_name_th : emp.department_name_en,
                    type: i18n.language === 'th' ? emp.leave_type_name_th : emp.leave_type_name_en,
                    status: emp.status === 'approved' ? (i18n.language === 'th' ? 'อนุมัติ' : 'Approved') : (i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'),
                    amount: emp.is_hourly_leave
                        ? `${(emp.leave_minutes / 60).toFixed(1)} ${i18n.language === 'th' ? 'ชม.' : 'hrs'}`
                        : `${emp.total_days} ${i18n.language === 'th' ? 'วัน' : 'days'}`,
                    period: emp.start_date && emp.end_date
                        ? (emp.start_date === emp.end_date ? formatDate(emp.start_date) : `${formatDate(emp.start_date)} - ${formatDate(emp.end_date)}`)
                        : (emp.leave_dates ? emp.leave_dates.map(d => formatDate(d)).join(', ') : (emp.leave_date ? formatDate(emp.leave_date) : '-')),
                    ref_no: emp.request_number || '-'
                });
            });
        };

        if (groupBy === 'daily') {
            (reportData.data as DailyLeaveGroup[]).forEach(group => {
                processEmployees(formatDate(group.date), group.employees);
            });
        } else if (groupBy === 'weekly') {
            (reportData.data as WeeklyLeaveGroup[]).forEach(group => {
                processEmployees(`${group.week} (${formatDate(group.week_start)} - ${formatDate(group.week_end)})`, group.employees);
            });
        } else if (groupBy === 'monthly') {
            (reportData.data as MonthlyLeaveGroup[]).forEach(group => {
                processEmployees(`${getMonthName(group.month_number)} ${group.year}`, group.employees);
            });
        }

        exportToPDF(
            rows,
            columns,
            `Leave_Summary_${groupBy}_${new Date().toISOString().split('T')[0]}`,
            {
                title: i18n.language === 'th' ? 'รายงานสรุปการลา' : 'Leave Summary Report',
                subtitle: `${i18n.language === 'th' ? 'ช่วงวันที่' : 'Period'}: ${formatDate(startDate)} - ${formatDate(endDate)}`,
                orientation: 'landscape'
            }
        );
    };

    const renderEmployeeRow = (emp: LeaveEmployeeEntry, index: number) => (
        <tr key={`${emp.employee_id}-${index}`} className="hover:bg-gray-50 border-b border-gray-100">
            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                {emp.employee_code}
            </td>
            <td className="px-4 py-2 text-sm text-gray-900">
                {i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en}
            </td>
            <td className="px-4 py-2 text-sm text-gray-600">
                {i18n.language === 'th' ? emp.department_name_th : emp.department_name_en}
            </td>
            <td className="px-4 py-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                            backgroundColor: getLeaveTypeColor(emp.leave_type_code) + '20',
                            color: getLeaveTypeColor(emp.leave_type_code),
                        }}
                    >
                        {i18n.language === 'th' ? emp.leave_type_name_th : emp.leave_type_name_en}
                    </span>
                    {(emp as any).attachment_urls && (emp as any).attachment_urls.length > 0 && (
                        <AttachmentBadge count={(emp as any).attachment_urls.length} attachments={(emp as any).attachment_urls} />
                    )}
                </div>
            </td>
            <td className="px-4 py-2 text-sm text-center text-gray-600">
                {emp.is_hourly_leave
                    ? `${(emp.leave_minutes / 60).toFixed(1)} ${i18n.language === 'th' ? 'ชม.' : 'hrs'}`
                    : `${emp.total_days} ${i18n.language === 'th' ? 'วัน' : 'day(s)'}`
                }
            </td>
            <td className="px-4 py-2 text-sm text-gray-600 whitespace-pre-wrap">
                {emp.start_date && emp.end_date
                    ? emp.start_date === emp.end_date
                        ? formatDate(emp.start_date)
                        : `${formatDate(emp.start_date)} - ${formatDate(emp.end_date)}`
                    : (emp.leave_dates && emp.leave_dates.length > 0)
                        ? emp.leave_dates.map(d => formatDate(d)).join(groupBy === 'monthly' ? '\n' : ', ')
                        : (emp.leave_date ? formatDate(emp.leave_date) : '-')
                }
            </td>
            <td className="px-4 py-2 text-sm text-gray-500 font-mono text-center">
                #{emp.request_number || '-'}
            </td>
        </tr>
    );

    const getLeaveTypeColor = (code: string): string => {
        const colors: Record<string, string> = {
            'SICK': '#EF4444',
            'VAC': '#3B82F6',
            'PER': '#F59E0B',
            'MAT': '#EC4899',
            'PAT': '#8B5CF6',
            'WFH': '#10B981',
        };
        return colors[code] || '#6B7280';
    };

    const renderRowsByDepartment = (employees: LeaveEmployeeEntry[]) => {
        // Group by Department -> Leave Type
        const groups: Record<string, Record<string, LeaveEmployeeEntry[]>> = {};

        employees.forEach(emp => {
            const deptName = i18n.language === 'th' ? emp.department_name_th : emp.department_name_en;
            const typeName = i18n.language === 'th' ? emp.leave_type_name_th : emp.leave_type_name_en;

            if (!groups[deptName]) groups[deptName] = {};
            if (!groups[deptName][typeName]) groups[deptName][typeName] = [];
            groups[deptName][typeName].push(emp);
        });

        const deptNames = Object.keys(groups).sort();
        const colSpan = 7;

        return deptNames.map(deptName => {
            const typeNames = Object.keys(groups[deptName]).sort();
            return (
                <Fragment key={deptName}>
                    {/* Dept Header */}
                    <tr className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={colSpan} className="px-4 py-2 font-bold text-blue-800">
                            {deptName}
                        </td>
                    </tr>
                    {typeNames.map(typeName => (
                        <Fragment key={`${deptName}-${typeName}`}>
                            {/* Type Header */}
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <td colSpan={colSpan} className="px-4 py-1 text-sm font-semibold text-gray-700 pl-8">
                                    {typeName} ({groups[deptName][typeName].length})
                                </td>
                            </tr>
                            {/* Employees */}
                            {groups[deptName][typeName].map((emp, idx) =>
                                renderEmployeeRow(emp, idx)
                            )}
                        </Fragment>
                    ))}
                </Fragment>
            );
        });
    };

    const renderGroupedEmployees = (employees: LeaveEmployeeEntry[]) => {
        const pending = employees.filter(e => e.status === 'pending');
        const approved = employees.filter(e => e.status === 'approved');
        const colSpan = 7;

        return (
            <>
                {pending.length > 0 && (
                    <>
                        <tr className="bg-amber-100 border-b border-amber-200">
                            <td colSpan={colSpan} className="px-4 py-2 font-bold text-amber-900 border-l-4 border-l-amber-500">
                                {i18n.language === 'th' ? 'รออนุมัติ' : 'Awaiting Approval'} ({pending.length})
                            </td>
                        </tr>
                        {renderRowsByDepartment(pending)}
                    </>
                )}

                {approved.length > 0 && (
                    <>
                        {/* Add margin/separator if both exist */}
                        {pending.length > 0 && (
                            <tr><td colSpan={colSpan} className="h-4 bg-white border-t border-gray-100"></td></tr>
                        )}
                        <tr className="bg-green-100 border-b border-green-200">
                            <td colSpan={colSpan} className="px-4 py-2 font-bold text-green-900 border-l-4 border-l-green-500">
                                {i18n.language === 'th' ? 'อนุมัติแล้ว' : 'Approved'} ({approved.length})
                            </td>
                        </tr>
                        {renderRowsByDepartment(approved)}
                    </>
                )}

                {/* Fallback if status is missing or other status (shouldn't happen with current filters) */}
                {employees.some(e => e.status !== 'pending' && e.status !== 'approved') && (
                    renderRowsByDepartment(employees.filter(e => e.status !== 'pending' && e.status !== 'approved'))
                )}
            </>
        );
    };

    const renderDailyGroup = (group: DailyLeaveGroup) => {
        const isExpanded = expandedDates.has(group.date);
        const hasEmployees = group.total_employees > 0;

        return (
            <div key={group.date} className="border rounded-lg overflow-hidden mb-3">
                {/* Header */}
                <button
                    onClick={() => hasEmployees && toggleDateExpand(group.date)}
                    className={`w-full flex items-center justify-between p-4 ${hasEmployees ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-default'
                        } ${isExpanded ? 'bg-blue-50' : 'bg-white'}`}
                    disabled={!hasEmployees}
                >
                    <div className="flex items-center gap-3">
                        {hasEmployees ? (
                            isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            )
                        ) : (
                            <div className="w-5 h-5" />
                        )}
                        <CalendarDays className={`w-5 h-5 ${hasEmployees ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${hasEmployees ? 'text-gray-900' : 'text-gray-500'}`}>
                            {formatDate(group.date)}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Leave type badges */}
                        <div className="flex gap-2">
                            {group.by_leave_type.map(lt => (
                                <span
                                    key={lt.leave_type_code}
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{
                                        backgroundColor: getLeaveTypeColor(lt.leave_type_code) + '20',
                                        color: getLeaveTypeColor(lt.leave_type_code),
                                    }}
                                >
                                    {lt.leave_type_code}: {lt.count}
                                </span>
                            ))}
                        </div>

                        {/* Total count */}
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${hasEmployees ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                            }`}>
                            <Users className="w-4 h-4" />
                            <span className="font-semibold">{group.total_employees}</span>
                            <span className="text-xs">{i18n.language === 'th' ? 'คน' : 'person(s)'}</span>
                        </div>
                    </div>
                </button>

                {/* Expanded content */}
                {isExpanded && group.employees.length > 0 && (
                    <div className="border-t">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'รหัส' : 'Code'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ชื่อ-นามสกุล' : 'Name'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'แผนก' : 'Department'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Type'}
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'จำนวน' : 'Duration'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ช่วงเวลา' : 'Period'}
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'เลขที่คำขอ' : 'Request No.'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderGroupedEmployees(group.employees)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderWeeklyGroup = (group: WeeklyLeaveGroup) => {
        const isExpanded = expandedDates.has(group.week);
        const hasEmployees = group.total_leave_instances > 0;

        return (
            <div key={group.week} className="border rounded-lg overflow-hidden mb-3">
                <button
                    onClick={() => hasEmployees && toggleDateExpand(group.week)}
                    className={`w-full flex items-center justify-between p-4 ${hasEmployees ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-default'
                        } ${isExpanded ? 'bg-green-50' : 'bg-white'}`}
                    disabled={!hasEmployees}
                >
                    <div className="flex items-center gap-3">
                        {hasEmployees ? (
                            isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            )
                        ) : (
                            <div className="w-5 h-5" />
                        )}
                        <CalendarRange className={`w-5 h-5 ${hasEmployees ? 'text-green-600' : 'text-gray-400'}`} />
                        <div className="text-left">
                            <span className={`font-medium ${hasEmployees ? 'text-gray-900' : 'text-gray-500'}`}>
                                {(i18n.language === 'th' && group.week) ? group.week.replace(/^(\d{4})/, (y) => (parseInt(y) + 543).toString()) : group.week}
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                                ({formatDate(group.week_start)} - {formatDate(group.week_end)})
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Leave type badges */}
                        <div className="flex gap-2">
                            {group.by_leave_type.map(lt => (
                                <span
                                    key={lt.leave_type_code}
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{
                                        backgroundColor: getLeaveTypeColor(lt.leave_type_code) + '20',
                                        color: getLeaveTypeColor(lt.leave_type_code),
                                    }}
                                >
                                    {lt.leave_type_code}: {lt.count}
                                </span>
                            ))}
                        </div>

                        {/* Total count */}
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${hasEmployees ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                            }`}>
                            <Users className="w-4 h-4" />
                            <span className="font-semibold">{group.unique_employee_count}</span>
                            <span className="text-xs">{i18n.language === 'th' ? 'คน' : 'unique'}</span>
                        </div>
                    </div>
                </button>

                {isExpanded && group.employees.length > 0 && (
                    <div className="border-t">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'รหัส' : 'Code'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ชื่อ-นามสกุล' : 'Name'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'แผนก' : 'Department'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Type'}
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'จำนวน' : 'Duration'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ช่วงเวลา' : 'Period'}
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'เลขที่คำขอ' : 'Request No.'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderGroupedEmployees(group.employees)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderMonthlyGroup = (group: MonthlyLeaveGroup) => {
        const isExpanded = expandedDates.has(group.month);
        const hasEmployees = group.total_leave_instances > 0;

        return (
            <div key={group.month} className="border rounded-lg overflow-hidden mb-3">
                <button
                    onClick={() => hasEmployees && toggleDateExpand(group.month)}
                    className={`w-full flex items-center justify-between p-4 ${hasEmployees ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-default'
                        } ${isExpanded ? 'bg-purple-50' : 'bg-white'}`}
                    disabled={!hasEmployees}
                >
                    <div className="flex items-center gap-3">
                        {hasEmployees ? (
                            isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            )
                        ) : (
                            <div className="w-5 h-5" />
                        )}
                        <Calendar className={`w-5 h-5 ${hasEmployees ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${hasEmployees ? 'text-gray-900' : 'text-gray-500'}`}>
                            {getMonthName(group.month_number)} {i18n.language === 'th' ? group.year + 543 : group.year}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Leave type badges */}
                        <div className="flex gap-2 flex-wrap justify-end">
                            {group.by_leave_type.map(lt => (
                                <span
                                    key={lt.leave_type_code}
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{
                                        backgroundColor: getLeaveTypeColor(lt.leave_type_code) + '20',
                                        color: getLeaveTypeColor(lt.leave_type_code),
                                    }}
                                >
                                    {lt.leave_type_code}: {lt.count}
                                </span>
                            ))}
                        </div>

                        {/* Total count */}
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${hasEmployees ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'
                            }`}>
                            <Users className="w-4 h-4" />
                            <span className="font-semibold">{group.unique_employee_count}</span>
                            <span className="text-xs">{i18n.language === 'th' ? 'คน' : 'unique'}</span>
                        </div>
                    </div>
                </button>

                {isExpanded && group.employees.length > 0 && (
                    <div className="border-t">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'รหัส' : 'Code'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ชื่อ-นามสกุล' : 'Name'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'แผนก' : 'Department'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Type'}
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'จำนวน' : 'Duration'}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'ช่วงเวลา' : 'Period'}
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                                        {i18n.language === 'th' ? 'เลขที่คำขอ' : 'Request No.'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderGroupedEmployees(group.employees)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6 pt-16">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/reports')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <BarChart3 className="w-8 h-8 text-blue-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {i18n.language === 'th' ? 'สรุปการลารายวัน/สัปดาห์/เดือน' : 'Daily/Weekly/Monthly Leave Summary'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {i18n.language === 'th'
                                ? 'แสดงจำนวนและรายชื่อพนักงานที่ลา แยกตามประเภทการลา'
                                : 'Shows leave count and employee names by leave type'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                    {i18n.language === 'th' ? 'ตัวกรอง' : 'Filters'}
                </h2>

                {/* Group By Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {i18n.language === 'th' ? 'จัดกลุ่มตาม' : 'Group By'}
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setGroupBy('daily')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${groupBy === 'daily'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <CalendarDays className="w-4 h-4" />
                            {i18n.language === 'th' ? 'รายวัน' : 'Daily'}
                        </button>
                        <button
                            onClick={() => setGroupBy('weekly')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${groupBy === 'weekly'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <CalendarRange className="w-4 h-4" />
                            {i18n.language === 'th' ? 'รายสัปดาห์' : 'Weekly'}
                        </button>
                        <button
                            onClick={() => setGroupBy('monthly')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${groupBy === 'monthly'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Calendar className="w-4 h-4" />
                            {i18n.language === 'th' ? 'รายเดือน' : 'Monthly'}
                        </button>
                    </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'วันที่เริ่มต้น' : 'Start Date'}
                        </label>
                        <DatePicker
                            value={getDateObject(startDate)}
                            onChange={handleDateChange(setStartDate)}
                            placeholder={i18n.language === 'th' ? 'เลือกวันที่เริ่มต้น' : 'Select start date'}
                            maxDate={endDate ? getDateObject(endDate) : undefined}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'วันที่สิ้นสุด' : 'End Date'}
                        </label>
                        <DatePicker
                            value={getDateObject(endDate)}
                            onChange={handleDateChange(setEndDate)}
                            placeholder={i18n.language === 'th' ? 'เลือกวันที่สิ้นสุด' : 'Select end date'}
                            minDate={startDate ? getDateObject(startDate) : undefined}
                        />
                    </div>
                </div>

                {/* Department Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        {i18n.language === 'th' ? 'แผนก (ไม่บังคับ)' : 'Department (Optional)'}
                    </label>
                    {loadingDepts ? (
                        <div className="text-center py-2 text-gray-500">Loading...</div>
                    ) : (
                        <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">
                                {i18n.language === 'th' ? '-- ทุกแผนก --' : '-- All Departments --'}
                            </option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.code} - {i18n.language === 'th' ? dept.name_th : dept.name_en}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerateReport}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    {loading
                        ? i18n.language === 'th'
                            ? 'กำลังสร้างรายงาน...'
                            : 'Generating Report...'
                        : i18n.language === 'th'
                            ? 'สร้างรายงาน'
                            : 'Generate Report'}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Report Results */}
            {reportData && (
                <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
                    {/* Report Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900">
                            {i18n.language === 'th' ? 'ผลลัพธ์รายงาน' : 'Report Results'}
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportPDF}
                                className="px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors flex items-center gap-1"
                            >
                                <Download className="w-4 h-4" />
                                {i18n.language === 'th' ? 'นำออก PDF' : 'Export PDF'}
                            </button>
                            <button
                                onClick={expandAll}
                                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                                {i18n.language === 'th' ? 'ขยายทั้งหมด' : 'Expand All'}
                            </button>
                            <button
                                onClick={collapseAll}
                                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                                {i18n.language === 'th' ? 'ยุบทั้งหมด' : 'Collapse All'}
                            </button>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-blue-600">
                                {reportData.summary.periods_count}
                            </div>
                            <div className="text-sm text-gray-600">
                                {groupBy === 'daily'
                                    ? (i18n.language === 'th' ? 'วัน' : 'Days')
                                    : groupBy === 'weekly'
                                        ? (i18n.language === 'th' ? 'สัปดาห์' : 'Weeks')
                                        : (i18n.language === 'th' ? 'เดือน' : 'Months')
                                }
                            </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-green-600">
                                {reportData.summary.unique_employees}
                            </div>
                            <div className="text-sm text-gray-600">
                                {i18n.language === 'th' ? 'พนักงานไม่ซ้ำ' : 'Unique Employees'}
                            </div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-amber-600">
                                {reportData.summary.total_leave_instances}
                            </div>
                            <div className="text-sm text-gray-600">
                                {i18n.language === 'th' ? 'ครั้งที่ลาทั้งหมด' : 'Total Leave Instances'}
                            </div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-purple-600">
                                {reportData.summary.by_leave_type.length}
                            </div>
                            <div className="text-sm text-gray-600">
                                {i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Types'}
                            </div>
                        </div>
                    </div>

                    {/* Leave Type Summary */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                        <h3 className="font-semibold text-gray-900 mb-3">
                            {i18n.language === 'th' ? 'สรุปตามประเภทการลา' : 'Summary by Leave Type'}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {reportData.summary.by_leave_type.map(lt => (
                                <div
                                    key={lt.leave_type_code}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-sm"
                                >
                                    <span
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: getLeaveTypeColor(lt.leave_type_code) }}
                                    />
                                    <span className="font-medium text-gray-900">
                                        {i18n.language === 'th' ? lt.leave_type_name_th : lt.leave_type_name_en}
                                    </span>
                                    <span className="text-gray-600">({lt.total_instances})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Data Groups */}
                    <div>
                        {reportData.data.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                {i18n.language === 'th'
                                    ? 'ไม่พบข้อมูลการลาในช่วงเวลาที่เลือก'
                                    : 'No leave data found in the selected period'}
                            </div>
                        ) : (
                            <>
                                {groupBy === 'daily' && (reportData.data as DailyLeaveGroup[]).map(renderDailyGroup)}
                                {groupBy === 'weekly' && (reportData.data as WeeklyLeaveGroup[]).map(renderWeeklyGroup)}
                                {groupBy === 'monthly' && (reportData.data as MonthlyLeaveGroup[]).map(renderMonthlyGroup)}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
