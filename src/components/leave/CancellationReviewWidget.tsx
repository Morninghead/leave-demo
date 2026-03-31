/**
 * Cancellation Review Widget
 * 
 * Widget for HR to review and approve/reject leave cancellation requests.
 * Shows pending cancellation requests with employee details and reason.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertCircle,
    CheckCircle,
    XCircle,
    Calendar,
    User,
    MessageSquare,
    Clock,
    RefreshCw,
    Loader2
} from 'lucide-react';
import { LeaveRequest } from '../../types/leave';
import { getCancellationPendingRequests, reviewLeaveCancellation } from '../../api/leave';
import { useToast } from '../../hooks/useToast';

interface CancellationReviewWidgetProps {
    onUpdate?: () => void;
}

export const CancellationReviewWidget: React.FC<CancellationReviewWidgetProps> = ({ onUpdate }) => {
    const { t, i18n } = useTranslation();
    const { showToast, showModal } = useToast();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);
    const requestIdRef = useRef(0);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchRequests = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const data = await getCancellationPendingRequests();
            if (!mountedRef.current || requestId !== requestIdRef.current) {
                return;
            }
            setRequests(data);
        } catch (err: any) {
            if (!mountedRef.current || requestId !== requestIdRef.current) {
                return;
            }
            setError(err.message);
        } finally {
            if (mountedRef.current && requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const groupedRequests = React.useMemo(() => {
        const groups: Record<string, LeaveRequest[]> = {};
        requests.forEach(req => {
            const deptName = i18n.language === 'th'
                ? (req.department_name_th || 'ไม่ระบุแผนก')
                : (req.department_name_en || 'Unknown Department');

            const key = deptName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(req);
        });
        return groups;
    }, [requests, i18n.language]);

    const sortedGroupKeys = React.useMemo(() => {
        return Object.keys(groupedRequests).sort((a, b) => a.localeCompare(b));
    }, [groupedRequests]);

    const handleApprove = async (requestId: string) => {
        const confirmed = await showModal('confirm', i18n.language === 'th' ? 'ยืนยันอนุมัติ' : 'Approve Confirmation', {
            message: i18n.language === 'th'
                ? 'ยืนยันอนุมัติการยกเลิก? วันลาจะถูกคืนให้พนักงาน'
                : 'Confirm approval? Leave days will be restored to employee.',
            confirmText: i18n.language === 'th' ? 'อนุมัติ' : 'Approve',
            cancelText: t('common.cancel'),
        });

        if (!confirmed) {
            return;
        }

        setActionLoading(requestId);
        try {
            await reviewLeaveCancellation(requestId, 'approve');
            showToast(i18n.language === 'th'
                ? 'อนุมัติการยกเลิกแล้ว คืนวันลาเรียบร้อย'
                : 'Cancellation approved. Leave days restored.', 'success');
            fetchRequests();
            onUpdate?.();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (requestId: string) => {
        if (rejectionReason.trim().length < 5) {
            showToast(i18n.language === 'th'
                ? 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'
                : 'Please provide a reason (minimum 5 characters)', 'warning');
            return;
        }

        setActionLoading(requestId);
        try {
            await reviewLeaveCancellation(requestId, 'reject', rejectionReason);
            showToast(i18n.language === 'th'
                ? 'ไม่อนุมัติการยกเลิก การลายังคงมีผล'
                : 'Cancellation rejected. Leave remains approved.', 'success');
            setRejectingId(null);
            setRejectionReason('');
            fetchRequests();
            onUpdate?.();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <div className="flex items-center justify-center gap-3 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{i18n.language === 'th' ? 'กำลังโหลด...' : 'Loading...'}</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8">
                <div className="text-center text-red-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>{error}</p>
                    <button
                        onClick={fetchRequests}
                        className="mt-3 text-blue-600 hover:underline"
                    >
                        {i18n.language === 'th' ? 'ลองใหม่' : 'Try again'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {i18n.language === 'th' ? 'คำขอยกเลิกการลา' : 'Cancellation Requests'}
                            </h3>
                            <p className="text-orange-100 text-sm">
                                {requests.length} {i18n.language === 'th' ? 'รายการรออนุมัติ' : 'pending approval'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchRequests}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                        title={i18n.language === 'th' ? 'รีเฟรช' : 'Refresh'}
                    >
                        <RefreshCw className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {requests.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>{i18n.language === 'th' ? 'ไม่มีคำขอยกเลิกที่รออนุมัติ' : 'No pending cancellation requests'}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {sortedGroupKeys.map((deptName) => {
                            const deptRequests = groupedRequests[deptName];
                            return (
                                <div key={deptName} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3 px-1 border-l-4 border-orange-500 pl-3">
                                        {deptName}
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200 font-normal">
                                            {deptRequests.length}
                                        </span>
                                    </h3>

                                    <div className="space-y-4">
                                        {deptRequests.map((request) => (
                                            <div
                                                key={request.id}
                                                className="border border-gray-200 rounded-xl p-4 hover:border-orange-200 transition-colors bg-white shadow-sm"
                                            >
                                                {/* Request Info */}
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-4 h-4 text-gray-400" />
                                                            <span className="font-semibold text-gray-800">
                                                                {(request as any).employee_name_th || (request as any).employee_name_en || 'Unknown'}
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                ({(request as any).employee_code})
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                            <span className="font-mono text-blue-700">
                                                                #{request.request_number}
                                                            </span>
                                                            <span>
                                                                {i18n.language === 'th' ? 'สร้างเมื่อ' : 'Created'}:{' '}
                                                                {formatDateTime(request.created_at)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Calendar className="w-4 h-4 text-gray-400" />
                                                            <span>
                                                                {(request as any).leave_type_name_th || (request as any).leave_type_name_en}:
                                                            </span>
                                                            <span className="font-medium">
                                                                {formatDate(request.start_date)} - {formatDate(request.end_date)}
                                                            </span>
                                                            <span className="text-orange-600">
                                                                ({request.total_days} {i18n.language === 'th' ? 'วัน' : 'days'})
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                                            <Clock className="w-3 h-3" />
                                                            <span>
                                                                {i18n.language === 'th' ? 'ขอยกเลิกเมื่อ' : 'Requested at'}:
                                                                {' '}{formatDateTime((request as any).cancellation_requested_at || new Date().toISOString())}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Cancellation Reason */}
                                                <div className="bg-orange-50 rounded-lg p-3 mb-4">
                                                    <div className="flex items-start gap-2">
                                                        <MessageSquare className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                                        <div>
                                                            <span className="text-xs font-medium text-orange-600 block mb-1">
                                                                {i18n.language === 'th' ? 'เหตุผลในการขอยกเลิก' : 'Cancellation Reason'}
                                                            </span>
                                                            <p className="text-sm text-gray-700">
                                                                {(request as any).cancellation_reason || '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Rejection Reason Input (if rejecting) */}
                                                {rejectingId === request.id && (
                                                    <div className="bg-red-50 rounded-lg p-3 mb-4">
                                                        <label className="text-xs font-medium text-red-600 block mb-2">
                                                            {i18n.language === 'th' ? 'เหตุผลที่ไม่อนุมัติ *' : 'Rejection Reason *'}
                                                        </label>
                                                        <textarea
                                                            value={rejectionReason}
                                                            onChange={(e) => setRejectionReason(e.target.value)}
                                                            placeholder={i18n.language === 'th'
                                                                ? 'กรุณาระบุเหตุผลที่ไม่อนุมัติ...'
                                                                : 'Please provide a reason for rejection...'}
                                                            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none"
                                                            rows={2}
                                                            minLength={5}
                                                        />
                                                        <p className="text-xs text-red-400 mt-1">
                                                            {rejectionReason.length}/5 {i18n.language === 'th' ? 'ตัวอักษรขั้นต่ำ' : 'minimum'}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    {rejectingId === request.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setRejectingId(null);
                                                                    setRejectionReason('');
                                                                }}
                                                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
                                                                disabled={actionLoading === request.id}
                                                            >
                                                                {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(request.id)}
                                                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                                                                disabled={actionLoading === request.id || rejectionReason.trim().length < 5}
                                                            >
                                                                {actionLoading === request.id
                                                                    ? (i18n.language === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                                                                    : (i18n.language === 'th' ? 'ยืนยันไม่อนุมัติ' : 'Confirm Reject')}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(request.id)}
                                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all text-sm font-medium disabled:opacity-50"
                                                                disabled={actionLoading === request.id}
                                                            >
                                                                {actionLoading === request.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle className="w-4 h-4" />
                                                                )}
                                                                {i18n.language === 'th' ? 'อนุมัติยกเลิก' : 'Approve'}
                                                            </button>
                                                            <button
                                                                onClick={() => setRejectingId(request.id)}
                                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg hover:from-red-600 hover:to-rose-600 transition-all text-sm font-medium disabled:opacity-50"
                                                                disabled={actionLoading === request.id}
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                                {i18n.language === 'th' ? 'ไม่อนุมัติ' : 'Reject'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CancellationReviewWidget;

