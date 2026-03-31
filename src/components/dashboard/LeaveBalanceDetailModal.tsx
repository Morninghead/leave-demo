import { useState, useEffect } from 'react';
import { X, Calendar, FileText, Infinity as InfinityIcon, Check, Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '../../hooks/useHaptic';
import { SkeletonList } from '../../components/ui/Skeleton';
import { ResponsiveModal } from '../../components/ui';
import { LeaveBalance, LeaveRequest } from '../../types/leave';
import { getLeaveRequests } from '../../api/leave';
import { format } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { formatThaiLeaveBalanceFromMinutes, formatLeaveDuration } from '../../utils/leaveTimeFormatter';
import { formatDateTime } from '../../utils/dateUtils';

interface LeaveBalanceDetailModalProps {
    balance: LeaveBalance;
    colorGradient: string;
    onClose: () => void;
}

export function LeaveBalanceDetailModal({ balance, colorGradient, onClose }: LeaveBalanceDetailModalProps) {
    const { t, i18n } = useTranslation();
    const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const haptic = useHaptic();
    const isThaiLanguage = i18n.language === 'th';

    const leaveTypeName = isThaiLanguage ? balance.leave_type_name_th : balance.leave_type_name_en;
    const isUnlimited = Number(balance.total_days) === 999 || Number(balance.total_days) === 0;

    useEffect(() => {
        const fetchLeaveHistory = async () => {
            setLoading(true);
            try {
                // Fetch all leave requests and filter by this leave type
                // Note: Ideally, specific API should support filtering by leave_type_id
                const requests = await getLeaveRequests();
                const filtered = requests.filter(req => req.leave_type_id === balance.leave_type_id);
                // Sort by date desc
                filtered.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
                setLeaveHistory(filtered);
            } catch (error) {
                console.error("Failed to fetch leave history", error);
            } finally {
                setLoading(false);
            }
        };

        if (balance.leave_type_id) {
            fetchLeaveHistory();
        }
    }, [balance.leave_type_id]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return format(date, 'dd MMM yyyy', { locale: isThaiLanguage ? th : enUS });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return {
                    bg: 'bg-green-100 text-green-800 border-green-200',
                    icon: <Check className="w-3 h-3" />,
                    text: isThaiLanguage ? 'อนุมัติแล้ว' : 'Approved'
                };
            case 'pending':
                return {
                    bg: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    icon: <Clock className="w-3 h-3" />,
                    text: isThaiLanguage ? 'รออนุมัติ' : 'Pending'
                };
            case 'rejected':
                return {
                    bg: 'bg-red-100 text-red-800 border-red-200',
                    icon: <X className="w-3 h-3" />,
                    text: isThaiLanguage ? 'ไม่อนุมัติ' : 'Rejected'
                };
            case 'canceled':
            case 'cancellation_pending':
                return {
                    bg: 'bg-gray-100 text-gray-800 border-gray-200',
                    icon: <AlertCircle className="w-3 h-3" />,
                    text: isThaiLanguage ? 'ยกเลิก' : 'Canceled'
                };
            default:
                return {
                    bg: 'bg-gray-100 text-gray-800 border-gray-200',
                    icon: <div />,
                    text: status
                };
        }
    };

    return (
        <ResponsiveModal
            isOpen={true}
            onClose={onClose}
            hideCloseButton={true}
            title={leaveTypeName}
        >
            <div className="bg-white w-full h-full flex flex-col">
                {/* Header with Gradient */}
                <div className={`bg-gradient-to-br ${colorGradient} p-6 text-white relative overflow-hidden shrink-0`}>
                    {/* Decorative Circle */}
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-black/5 rounded-full blur-xl" />

                    {/* Close button */}
                    <button
                        onClick={() => {
                            haptic.trigger('light');
                            onClose();
                        }}
                        className="absolute top-3 right-3 p-3 bg-white/20 hover:bg-white/40 rounded-full transition-colors z-20 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="relative z-10 pr-12">
                        <h2 id="modal-title" className="text-2xl font-bold mb-2">{leaveTypeName}</h2>



                        {isUnlimited ? (
                            <div className="flex items-center gap-3">
                                <InfinityIcon className="w-10 h-10" />
                                <div>
                                    <p className="text-lg font-semibold">{isThaiLanguage ? 'ไม่จำกัด' : 'Unlimited'}</p>
                                    <p className="text-sm opacity-80">
                                        {isThaiLanguage ? 'ใช้ไปแล้ว' : 'Used'}: {balance.used_days} {isThaiLanguage ? 'วัน' : 'days'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-white/20 rounded-xl p-3 text-center">
                                    <p className="text-3xl font-bold">
                                        {balance.allow_hourly_leave && balance.remaining_minutes !== undefined
                                            ? formatThaiLeaveBalanceFromMinutes(balance.remaining_minutes, 480, i18n.language as 'th' | 'en')
                                            : `${balance.remaining_days}`}
                                    </p>
                                    <p className="text-xs opacity-80">{isThaiLanguage ? 'คงเหลือ' : 'Remaining'}</p>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3 text-center">
                                    <p className="text-3xl font-bold">
                                        {balance.allow_hourly_leave && balance.used_minutes !== undefined
                                            ? formatThaiLeaveBalanceFromMinutes(balance.used_minutes, 480, i18n.language as 'th' | 'en')
                                            : `${balance.used_days}`}
                                    </p>
                                    <p className="text-xs opacity-80">{isThaiLanguage ? 'ใช้ไป' : 'Used'}</p>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3 text-center">
                                    <p className="text-3xl font-bold">{balance.total_days}</p>
                                    <p className="text-xs opacity-80">{isThaiLanguage ? 'ทั้งหมด' : 'Total'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content - Leave History */}
                <div className="p-6 overflow-y-auto flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        {isThaiLanguage ? 'ประวัติการลาประเภทนี้' : 'Leave History for This Type'}
                    </h3>

                    {loading ? (
                        <div className="py-2">
                            <SkeletonList count={3} />
                        </div>
                    ) : leaveHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>{isThaiLanguage ? 'ยังไม่มีประวัติการลาประเภทนี้' : 'No leave history for this type'}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {leaveHistory.map((leave) => {
                                const statusBadge = getStatusBadge(leave.status);
                                return (
                                    <div
                                        key={leave.id}
                                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <span className="text-sm text-gray-700">
                                                        {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                                                    </span>
                                                </div>
                                                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                    <span className="font-mono text-blue-700">#{leave.request_number}</span>
                                                    <span className="text-gray-500">
                                                        {isThaiLanguage ? 'สร้างเมื่อ' : 'Created'}: {formatDateTime(leave.created_at, i18n.language)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {/* Days/Hours Badge */}
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                                        {formatLeaveDuration(
                                                            leave.total_days,
                                                            leave.leave_minutes,
                                                            leave.is_hourly_leave || false,
                                                            isThaiLanguage ? 'th' : 'en'
                                                        )}
                                                    </span>

                                                    {/* Status Badge */}
                                                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusBadge.bg}`}>
                                                        {statusBadge.icon}
                                                        {statusBadge.text}
                                                    </span>
                                                </div>

                                                {leave.reason_th && (
                                                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                                        <span className="font-medium">{isThaiLanguage ? 'เหตุผล:' : 'Reason:'}</span> {leave.reason_th}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 shrink-0">
                    <button
                        onClick={() => {
                            haptic.trigger('light');
                            onClose();
                        }}
                        className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-900 transition-colors"
                    >
                        {isThaiLanguage ? 'ปิด' : 'Close'}
                    </button>
                </div>
            </div>
        </ResponsiveModal>
    );
}
