/**
 * Compliance Report Page
 * 
 * Labor law and policy compliance monitoring:
 * - Employees exceeding leave quota
 * - Long-pending requests
 * - Leave frequency analysis
 * - Missing required attachments
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertTriangle,
    Clock,
    FileWarning,
    Users,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getLeaveBalanceReport, LeaveBalance } from '../../api/reports';
import api from '../../api/auth';
import { AttachmentBadge } from '../../components/common/AttachmentBadge';
import { DatePicker } from '../../components/common/DatePicker';

interface PendingRequest {
    id: string;
    employee_code: string;
    employee_name_th: string;
    employee_name_en: string;
    department_name_th: string;
    department_name_en: string;
    leave_type_name_th: string;
    leave_type_name_en: string;
    start_date: string;
    end_date: string;
    total_days: number;
    created_at: string;
    days_pending: number;
    attachment_urls?: string[];
}

interface OverQuotaEmployee {
    employee_code: string;
    employee_name_th: string;
    employee_name_en: string;
    department_name_th: string;
    department_name_en: string;
    leave_type: string;
    quota: number;
    used: number;
    over_by: number;
}

interface MissingAttachment {
    id: string;
    employee_code: string;
    employee_name_th: string;
    employee_name_en: string;
    leave_type_name_th: string;
    leave_type_name_en: string;
    start_date: string;
    end_date: string;
    total_days: number;
    status: string;
}

export default function ComplianceReportPage() {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const isThai = i18n.language === 'th';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data states
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [missingAttachments, setMissingAttachments] = useState<MissingAttachment[]>([]);

    // Filter states
    const [selectedTab, setSelectedTab] = useState<'overview' | 'quota' | 'pending' | 'attachments'>('overview');
    const [pendingDaysThreshold, setPendingDaysThreshold] = useState(3);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDateInput = (value: string) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const isWithinSelectedRange = (targetDate: string) => {
        if (!startDate || !endDate) return true;

        const target = parseDateInput(targetDate);
        const start = parseDateInput(startDate);
        const end = parseDateInput(endDate);

        if (!target || !start || !end) return true;
        return target >= start && target <= end;
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Load leave balances for quota analysis
            const balances = await getLeaveBalanceReport();
            setLeaveBalances(balances);

            // Load pending requests
            const pendingResponse = await api.get('/leave-requests?status=pending');
            const pending = pendingResponse.data.requests || pendingResponse.data.data || [];

            // Calculate days pending for each request
            const today = new Date();
            const pendingWithDays = pending.map((req: any) => {
                const createdDate = new Date(req.created_at);
                const daysPending = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    ...req,
                    days_pending: daysPending,
                };
            });
            setPendingRequests(pendingWithDays);

            // Load requests with missing attachments (leaves that require attachment but don't have one)
            const attachmentResponse = await api.get('/leave-requests?requires_attachment=true&has_attachment=false');
            setMissingAttachments(attachmentResponse.data.requests || attachmentResponse.data.data || []);

        } catch (err: any) {
            console.error('Failed to load compliance data:', err);
            setError(err.message || (isThai ? 'ไม่สามารถโหลดข้อมูลการปฏิบัติตามกฎได้' : 'Failed to load compliance data'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(formatDate(startOfMonth));
        setEndDate(formatDate(today));
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    // Calculate over-quota employees
    const overQuotaEmployees = useMemo(() => {
        const results: OverQuotaEmployee[] = [];

        leaveBalances.forEach(emp => {
            // Check sick leave
            if (emp.sick_leave_used > emp.sick_leave_balance) {
                results.push({
                    employee_code: emp.employee_code,
                    employee_name_th: emp.employee_name_th,
                    employee_name_en: emp.employee_name_en,
                    department_name_th: emp.department_name_th,
                    department_name_en: emp.department_name_en,
                    leave_type: isThai ? 'ลาป่วย' : 'Sick Leave',
                    quota: emp.sick_leave_balance,
                    used: emp.sick_leave_used,
                    over_by: emp.sick_leave_used - emp.sick_leave_balance,
                });
            }

            // Check annual leave
            if (emp.annual_leave_used > emp.annual_leave_balance) {
                results.push({
                    employee_code: emp.employee_code,
                    employee_name_th: emp.employee_name_th,
                    employee_name_en: emp.employee_name_en,
                    department_name_th: emp.department_name_th,
                    department_name_en: emp.department_name_en,
                    leave_type: isThai ? 'ลาพักร้อน' : 'Annual Leave',
                    quota: emp.annual_leave_balance,
                    used: emp.annual_leave_used,
                    over_by: emp.annual_leave_used - emp.annual_leave_balance,
                });
            }

            // Check personal leave
            if (emp.personal_leave_used > emp.personal_leave_balance) {
                results.push({
                    employee_code: emp.employee_code,
                    employee_name_th: emp.employee_name_th,
                    employee_name_en: emp.employee_name_en,
                    department_name_th: emp.department_name_th,
                    department_name_en: emp.department_name_en,
                    leave_type: isThai ? 'ลากิจ' : 'Personal Leave',
                    quota: emp.personal_leave_balance,
                    used: emp.personal_leave_used,
                    over_by: emp.personal_leave_used - emp.personal_leave_balance,
                });
            }
        });

        return results;
    }, [leaveBalances, isThai]);

    // Filter pending requests by threshold
    const longPendingRequests = useMemo(() => {
        return pendingRequests.filter(req =>
            req.days_pending >= pendingDaysThreshold && isWithinSelectedRange(req.start_date)
        );
    }, [pendingRequests, pendingDaysThreshold, startDate, endDate]);

    const filteredMissingAttachments = useMemo(() => {
        return missingAttachments.filter(req => isWithinSelectedRange(req.start_date));
    }, [missingAttachments, startDate, endDate]);

    // Summary stats
    const stats = useMemo(() => ({
        totalEmployees: leaveBalances.length,
        overQuotaCount: overQuotaEmployees.length,
        longPendingCount: longPendingRequests.length,
        missingAttachmentCount: filteredMissingAttachments.length,
        complianceScore: Math.max(0, Math.round(100 - (
            (overQuotaEmployees.length * 10) +
            (longPendingRequests.length * 5) +
            (filteredMissingAttachments.length * 3)
        ))),
    }), [leaveBalances, overQuotaEmployees, longPendingRequests, filteredMissingAttachments]);

    const getComplianceColor = (score: number) => {
        if (score >= 90) return 'text-green-600 bg-green-100';
        if (score >= 70) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6 pt-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isThai ? 'รายงานการปฏิบัติตามกฎ' : 'Compliance Report'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {isThai ? 'ติดตามการปฏิบัติตามนโยบายและกฎระเบียบ' : 'Track policy and regulation compliance'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    {isThai ? 'รีเฟรช' : 'Refresh'}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            <Calendar className="mr-1 inline h-4 w-4" />
                            {isThai ? 'วันที่เริ่มต้น' : 'Start Date'}
                        </label>
                        <DatePicker
                            value={startDate ? new Date(startDate) : null}
                            onChange={(date) => setStartDate(date ? formatDate(date) : '')}
                            placeholder={isThai ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            <Calendar className="mr-1 inline h-4 w-4" />
                            {isThai ? 'วันที่สิ้นสุด' : 'End Date'}
                        </label>
                        <DatePicker
                            value={endDate ? new Date(endDate) : null}
                            onChange={(date) => setEndDate(date ? formatDate(date) : '')}
                            placeholder={isThai ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                        />
                    </div>
                    <div className="text-sm text-gray-500 md:min-w-64">
                        {isThai
                            ? 'ช่วงวันที่นี้ใช้กรองรายการคำขอค้างอนุมัติและรายการที่ขาดเอกสารแนบ'
                            : 'This date range filters pending approval items and requests missing required attachments.'}
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Compliance Score Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-700">
                            {isThai ? 'คะแนนการปฏิบัติตามกฎ' : 'Compliance Score'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {isThai ? 'คำนวณจากปัญหาที่พบในระบบ' : 'Calculated from issues found in the system'}
                        </p>
                    </div>
                    <div className={`text-5xl font-bold px-6 py-3 rounded-xl ${getComplianceColor(stats.complianceScore)}`}>
                        {stats.complianceScore}%
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                    className={`bg-white rounded-xl shadow p-5 cursor-pointer transition-all hover:shadow-lg ${selectedTab === 'overview' ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedTab('overview')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{isThai ? 'พนักงานทั้งหมด' : 'Total Employees'}</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
                        </div>
                    </div>
                </div>

                <div
                    className={`bg-white rounded-xl shadow p-5 cursor-pointer transition-all hover:shadow-lg ${selectedTab === 'quota' ? 'ring-2 ring-red-500' : ''}`}
                    onClick={() => setSelectedTab('quota')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{isThai ? 'ลาเกินโควต้า' : 'Over Quota'}</p>
                            <p className="text-2xl font-bold text-red-600">{stats.overQuotaCount}</p>
                        </div>
                    </div>
                </div>

                <div
                    className={`bg-white rounded-xl shadow p-5 cursor-pointer transition-all hover:shadow-lg ${selectedTab === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
                    onClick={() => setSelectedTab('pending')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-yellow-100 rounded-lg">
                            <Clock className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{isThai ? 'รอนานเกินไป' : 'Long Pending'}</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.longPendingCount}</p>
                        </div>
                    </div>
                </div>

                <div
                    className={`bg-white rounded-xl shadow p-5 cursor-pointer transition-all hover:shadow-lg ${selectedTab === 'attachments' ? 'ring-2 ring-orange-500' : ''}`}
                    onClick={() => setSelectedTab('attachments')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <FileWarning className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{isThai ? 'ขาดเอกสาร' : 'Missing Docs'}</p>
                            <p className="text-2xl font-bold text-orange-600">{stats.missingAttachmentCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Sections */}
            {selectedTab === 'overview' && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                        {isThai ? 'ภาพรวมการปฏิบัติตามกฎ' : 'Compliance Overview'}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                            {stats.overQuotaCount === 0 ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                                <XCircle className="w-6 h-6 text-red-600" />
                            )}
                            <div>
                                <p className="font-medium">{isThai ? 'การใช้วันลาตามโควต้า' : 'Leave Quota Usage'}</p>
                                <p className="text-sm text-gray-500">
                                    {stats.overQuotaCount === 0
                                        ? (isThai ? 'ไม่มีพนักงานใช้วันลาเกินโควต้า' : 'No employees exceeded their leave quota')
                                        : `${stats.overQuotaCount} ${isThai ? 'กรณีที่ใช้วันลาเกินโควต้า' : 'cases of quota exceeded'}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                            {stats.longPendingCount === 0 ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                                <AlertCircle className="w-6 h-6 text-yellow-600" />
                            )}
                            <div>
                                <p className="font-medium">{isThai ? 'การอนุมัติตรงเวลา' : 'Timely Approvals'}</p>
                                <p className="text-sm text-gray-500">
                                    {stats.longPendingCount === 0
                                        ? (isThai ? 'ไม่มีคำขอที่รอนานเกินกำหนด' : 'No requests pending beyond threshold')
                                        : `${stats.longPendingCount} ${isThai ? `คำขอรอเกิน ${pendingDaysThreshold} วัน` : `requests pending over ${pendingDaysThreshold} days`}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                            {stats.missingAttachmentCount === 0 ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                                <AlertCircle className="w-6 h-6 text-orange-600" />
                            )}
                            <div>
                                <p className="font-medium">{isThai ? 'เอกสารประกอบครบถ้วน' : 'Complete Documentation'}</p>
                                <p className="text-sm text-gray-500">
                                    {stats.missingAttachmentCount === 0
                                        ? (isThai ? 'เอกสารประกอบครบทุกกรณี' : 'All required documents attached')
                                        : `${stats.missingAttachmentCount} ${isThai ? 'คำขอที่ขาดเอกสาร' : 'requests missing documents'}`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedTab === 'quota' && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                        {isThai ? 'พนักงานที่ใช้วันลาเกินโควต้า' : 'Employees Over Leave Quota'}
                    </h3>

                    {overQuotaEmployees.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                            <p className="text-lg font-medium">{isThai ? 'ไม่พบปัญหา' : 'No Issues Found'}</p>
                            <p>{isThai ? 'ไม่มีพนักงานที่ใช้วันลาเกินโควต้า' : 'No employees have exceeded their leave quota'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'รหัส' : 'Code'}</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'ชื่อ' : 'Name'}</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'แผนก' : 'Department'}</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'ประเภทลา' : 'Leave Type'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'โควต้า' : 'Quota'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'ใช้ไป' : 'Used'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'เกิน' : 'Over'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {overQuotaEmployees.map((emp, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-mono">{emp.employee_code}</td>
                                            <td className="px-4 py-3 text-sm">{isThai ? emp.employee_name_th : emp.employee_name_en}</td>
                                            <td className="px-4 py-3 text-sm">{isThai ? emp.department_name_th : emp.department_name_en}</td>
                                            <td className="px-4 py-3 text-sm">{emp.leave_type}</td>
                                            <td className="px-4 py-3 text-sm text-center">{emp.quota}</td>
                                            <td className="px-4 py-3 text-sm text-center font-medium text-red-600">{emp.used}</td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">+{emp.over_by}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {selectedTab === 'pending' && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">
                            {isThai ? 'คำขอที่รอนานเกินไป' : 'Long Pending Requests'}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{isThai ? 'เกณฑ์' : 'Threshold'}:</span>
                            <select
                                value={pendingDaysThreshold}
                                onChange={(e) => setPendingDaysThreshold(parseInt(e.target.value))}
                                className="px-3 py-1.5 border rounded-lg text-sm"
                            >
                                <option value={1}>1 {isThai ? 'วัน' : 'day'}</option>
                                <option value={2}>2 {isThai ? 'วัน' : 'days'}</option>
                                <option value={3}>3 {isThai ? 'วัน' : 'days'}</option>
                                <option value={5}>5 {isThai ? 'วัน' : 'days'}</option>
                                <option value={7}>7 {isThai ? 'วัน' : 'days'}</option>
                            </select>
                        </div>
                    </div>

                    {longPendingRequests.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                            <p className="text-lg font-medium">{isThai ? 'ไม่พบปัญหา' : 'No Issues Found'}</p>
                            <p>{isThai ? `ไม่มีคำขอที่รอเกิน ${pendingDaysThreshold} วัน` : `No requests pending over ${pendingDaysThreshold} days`}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'พนักงาน' : 'Employee'}</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'แผนก' : 'Department'}</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'ประเภท' : 'Type'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'วันลา' : 'Leave Date'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'รอมาแล้ว' : 'Waiting'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {longPendingRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm">
                                                <div>
                                                    <p className="font-medium">{isThai ? req.employee_name_th : req.employee_name_en}</p>
                                                    <p className="text-xs text-gray-500">{req.employee_code}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{isThai ? req.department_name_th : req.department_name_en}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span>{isThai ? req.leave_type_name_th : req.leave_type_name_en}</span>
                                                    {req.attachment_urls && req.attachment_urls.length > 0 && (
                                                        <AttachmentBadge count={req.attachment_urls.length} attachments={req.attachment_urls} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-center">{req.start_date}</td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <span className={`px-2 py-1 rounded-full font-bold ${req.days_pending >= 5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {req.days_pending} {isThai ? 'วัน' : 'days'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {selectedTab === 'attachments' && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                        {isThai ? 'คำขอที่ขาดเอกสารแนบ' : 'Requests Missing Attachments'}
                    </h3>

                    {filteredMissingAttachments.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                            <p className="text-lg font-medium">{isThai ? 'ไม่พบปัญหา' : 'No Issues Found'}</p>
                            <p>{isThai ? 'เอกสารแนบครบถ้วนทุกคำขอ' : 'All requests have required attachments'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'พนักงาน' : 'Employee'}</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{isThai ? 'ประเภทลา' : 'Leave Type'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'วันลา' : 'Leave Date'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'จำนวนวัน' : 'Days'}</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{isThai ? 'สถานะ' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredMissingAttachments.map((req) => (
                                        <tr key={req.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm">
                                                <div>
                                                    <p className="font-medium">{isThai ? req.employee_name_th : req.employee_name_en}</p>
                                                    <p className="text-xs text-gray-500">{req.employee_code}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{isThai ? req.leave_type_name_th : req.leave_type_name_en}</td>
                                            <td className="px-4 py-3 text-sm text-center">{req.start_date}</td>
                                            <td className="px-4 py-3 text-sm text-center">{req.total_days}</td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
