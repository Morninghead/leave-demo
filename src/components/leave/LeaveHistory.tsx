import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, FileText, Clock, CheckCircle, XCircle, Ban, Trash2, UserCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { LeaveRequest, getLeaveRequests, updateLeaveRequestStatus } from '../../api/leave';
import { formatDateShort, formatDateTime } from '../../utils/dateUtils';
import { LeaveRequestDetail } from './LeaveRequestDetail';
import { AttachmentBadge } from '../common/AttachmentBadge';
import { formatLeaveDurationDisplay } from '../../utils/leaveCalculator';
import { formatThaiLeaveBalance, formatLeaveDuration } from '../../utils/leaveTimeFormatter';
import { CancellationRequestModal } from './CancellationRequestModal';

export function LeaveHistory() {
  const { t, i18n } = useTranslation();
  const { showToast, showModal } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'canceled' | 'voided' | 'cancellation_pending'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancellationRequest, setCancellationRequest] = useState<LeaveRequest | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    loadRequests();
  }, []);

  // Reset page เป็น 1 ทุกครั้งที่เงื่อนไขกลุ่มข้อมูลเปลี่ยน
  useEffect(() => {
    setPage(1);
  }, [filterStatus, pageSize, requests]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequests();
      setRequests(data);
    } catch (error: any) {
      console.error('Failed to load leave history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    const confirmed = await showModal('confirm', t('leave.cancelRequest'), {
      message: t('leave.confirmCancel'),
      confirmText: t('leave.cancel'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;
    setActionLoading(requestId);
    try {
      await updateLeaveRequestStatus(requestId, 'cancel');
      await handleUpdate();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestClick = (request: LeaveRequest) => {
    setSelectedRequest(request);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
  };

  const handleUpdate = async () => {
    const freshData = await getLeaveRequests();
    setRequests(freshData);
    if (selectedRequest) {
      const updated = freshData.find(r => r.id === selectedRequest.id);
      if (updated) {
        setSelectedRequest(updated);
      }
    }
  };

  const canCancel = (request: LeaveRequest) => {
    return request.status === 'pending';
  };

  // Check if request can request cancellation (approved + 24hrs before start)
  const canRequestCancellation = (request: LeaveRequest) => {
    if (request.status !== 'approved') return false;

    // Check 24hrs in Thailand timezone
    const thaiOffset = 7 * 60 * 60 * 1000;
    const thaiNow = new Date(Date.now() + thaiOffset);
    const startDate = new Date(request.start_date);
    startDate.setHours(0, 0, 0, 0);

    const hoursUntilStart = (startDate.getTime() - thaiNow.getTime()) / (1000 * 60 * 60);
    return hoursUntilStart >= 24;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'department_approved':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'canceled':
        return <Ban className="w-5 h-5 text-gray-600" />;
      case 'voided':
        return <Ban className="w-5 h-5 text-orange-600" />;
      case 'cancellation_pending':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'department_approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'canceled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'voided':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cancellation_pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getApprovalStageName = (stage: number | undefined, lang: string, approverName?: string) => {
    if (!stage) return null;

    // Backend now always returns an approver name via COALESCE chain:
    // Dept Admin → Dept Manager → HR
    if (approverName) {
      const suffix = lang === 'th' ? ' อนุมัติ' : '';
      return `${lang === 'th' ? 'รอ' : 'Awaiting '}${approverName}${suffix}`;
    }

    // Fallback only if backend somehow returns null (should not happen)
    return lang === 'th' ? 'รอผู้อนุมัติ' : 'Awaiting Approver';
  };


  // Count for each status
  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    canceled: requests.filter(r => r.status === 'canceled').length,
    voided: requests.filter(r => r.status === 'voided').length,
    cancellation_pending: requests.filter(r => r.status === 'cancellation_pending').length,
  };

  const filteredRequests = requests.filter(req => req.status === filterStatus);
  const createdAtLabel = i18n.language === 'th' ? 'สร้างเมื่อ' : 'Created';

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 rounded"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('leave.pending')}
            <span className="ml-2 bg-yellow-100 text-yellow-800 py-0.5 px-2.5 rounded-full text-xs">
              {counts.pending}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'approved'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('leave.approved')}
            <span className="ml-2 bg-green-100 text-green-800 py-0.5 px-2.5 rounded-full text-xs">
              {counts.approved}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'rejected'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('leave.rejected')}
            <span className="ml-2 bg-red-100 text-red-800 py-0.5 px-2.5 rounded-full text-xs">
              {counts.rejected}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus('canceled')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'canceled'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('leave.canceled')}
            <span className="ml-2 bg-gray-100 text-gray-800 py-0.5 px-2.5 rounded-full text-xs">
              {counts.canceled}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus('voided')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'voided'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {i18n.language === 'th' ? 'ยกเลิก' : 'Voided'}
            <span className="ml-2 bg-orange-100 text-orange-800 py-0.5 px-2.5 rounded-full text-xs">
              {counts.voided}
            </span>
          </button>
          {counts.cancellation_pending > 0 && (
            <button
              onClick={() => setFilterStatus('cancellation_pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'cancellation_pending'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
            >
              {t('leave.cancellationPending')}
              <span className="ml-2 bg-amber-100 text-amber-800 py-0.5 px-2.5 rounded-full text-xs">
                {counts.cancellation_pending}
              </span>
            </button>
          )}
        </div>

        {/* --- Pagination controls --- */}
        <div className="flex items-center gap-2 mb-2 mt-1">
          <span>แสดงผลหน้าละ:</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
            }}
            className="border rounded px-2 py-1"
          >
            {[5, 10, 15, 20].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="border rounded px-3 py-1"
          >
            ก่อนหน้า
          </button>
          <span>{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="border rounded px-3 py-1"
          >
            ถัดไป
          </button>
        </div>

        {/* List */}
        {paginatedRequests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">{t('leave.noHistory')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* ...ส่วน card/request เดิมของคุณ... */}
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleRequestClick(request)}
                  >
                    {/* Header with Status and Attachment Icon */}
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {getStatusIcon(request.status)}
                      <h3 className="font-semibold text-gray-900">
                        {i18n.language === 'th'
                          ? request.leave_type_name_th
                          : request.leave_type_name_en}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {t(`leave.${request.status}`)}
                      </span>
                      {request.attachment_urls && request.attachment_urls.length > 0 && (
                        <AttachmentBadge
                          count={request.attachment_urls.length}
                          attachments={request.attachment_urls}
                        />
                      )}
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-mono text-blue-700">#{request.request_number}</span>
                      <span className="text-gray-500">
                        {createdAtLabel}: {formatDateTime(request.created_at, i18n.language)}
                      </span>
                    </div>
                    {/* Approval Stage - แสดงเฉพาะ pending */}
                    {request.status === 'pending' && request.current_approval_stage && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-lg w-fit">
                        <UserCheck className="w-4 h-4" />
                        <span>{getApprovalStageName(
                          request.current_approval_stage,
                          i18n.language,
                          i18n.language === 'th' ? request.next_approver_name_th : request.next_approver_name_en
                        )}</span>
                      </div>
                    )}
                    {/* Date and Days */}
                    <div className="grid md:grid-cols-3 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatDateShort(new Date(request.start_date), i18n.language)}
                          {' - '}
                          {formatDateShort(new Date(request.end_date), i18n.language)}
                        </span>
                      </div>
                      <div>
                        {request.is_hourly_leave ? (
                          <div className="flex flex-col">
                            <div>
                              <span className="font-medium">
                                {formatLeaveDuration(
                                  request.total_days,
                                  request.leave_minutes,
                                  true,
                                  i18n.language as 'th' | 'en'
                                )}
                              </span>
                            </div>
                            {request.leave_start_time && request.leave_end_time && (
                              <div className="text-xs text-gray-500">
                                {request.leave_start_time} - {request.leave_end_time}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{formatLeaveDurationDisplay(request, i18n.language as 'th' | 'en')}</span>
                          </>
                        )}
                      </div>
                      <div className="text-gray-500">
                        {createdAtLabel}: {formatDateTime(request.created_at, i18n.language)}
                      </div>
                    </div>
                    {/* Reason Preview (ถ้ามี) */}
                    {request.reason_th && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-1">
                        {i18n.language === 'th' ? request.reason_th : request.reason_en}
                      </p>
                    )}
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {canCancel(request) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(request.id);
                        }}
                        disabled={actionLoading === request.id}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title={t('leave.cancel')}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {actionLoading === request.id ? t('common.loading') : t('leave.cancel')}
                        </span>
                      </button>
                    )}
                    {/* Request Cancellation button for approved requests */}
                    {canRequestCancellation(request) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancellationRequest(request);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-orange-200"
                        title={t('leave.requestCancellation')}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {t('leave.requestCancellation')}
                        </span>
                      </button>
                    )}
                    {/* Show cancellation pending badge */}
                    {request.status === 'cancellation_pending' && (
                      <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm rounded-lg border border-amber-200">
                        {t('leave.cancellationPending')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <LeaveRequestDetail
          request={selectedRequest}
          onClose={handleCloseModal}
          onUpdate={handleUpdate}
        />
      )}

      {/* Cancellation Request Modal */}
      {cancellationRequest && (
        <CancellationRequestModal
          request={cancellationRequest}
          onClose={() => setCancellationRequest(null)}
          onSuccess={() => {
            loadRequests();
            setCancellationRequest(null);
          }}
        />
      )}
    </>
  );
}

