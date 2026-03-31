import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ArrowRightLeft, CheckCircle, XCircle, AlertCircle, Ban, X } from 'lucide-react';
import { ShiftSwapRequest } from '../types/shift';
import { getShiftSwapRequests, updateShiftRequestStatus, voidShiftSwap } from '../api/shift';
import { formatDateShort } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useToast } from '../hooks/useToast';

export function ShiftSwapApprovalPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'voided' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [voidingRequest, setVoidingRequest] = useState<ShiftSwapRequest | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  const loadRequests = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await getShiftSwapRequests();
      setRequests(data);
    } catch (error: any) {
      console.error('Failed to load requests:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Auto-refresh every 3 minutes for pending shift swap approval requests
  useAutoRefresh({
    category: 'LEAVE_REQUESTS',
    dataType: 'PENDING',
    onRefresh: () => loadRequests(true),
  });

  const handleApprove = async (requestId: string) => {
    const confirmed = await showModal('confirm', t('shift.approve'), {
      message: t('message.confirmApprove'),
      confirmText: t('shift.approve'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    setActionLoading(requestId);
    try {
      await updateShiftRequestStatus(requestId, { status: 'approved' });
      await loadRequests();
      showToast(t('shift.approveSuccess'), 'success');
    } catch (error: any) {
      console.warn('Update may have succeeded despite error:', error.message);
      await loadRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const initReject = (requestId: string) => {
    setRejectingId(requestId);
    setRejectionReasonText('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectingId) return;
    if (!rejectionReasonText.trim()) {
      showToast(t('shift.rejectionReasonRequired'), 'warning');
      return;
    }

    setActionLoading(rejectingId);
    try {
      await updateShiftRequestStatus(rejectingId, {
        status: 'rejected',
        rejection_reason: rejectionReasonText,
      });
      await loadRequests();
      showToast(t('shift.rejectSuccess'), 'success');
      setRejectingId(null);
      setRejectionReasonText('');
    } catch (error: any) {
      console.warn('Update may have succeeded despite error:', error.message);
      await loadRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const canApprove = (request: ShiftSwapRequest) => {
    if (!user) return false;
    return ['manager', 'hr', 'admin'].includes(user.role) && request.status === 'pending';
  };

  const canVoid = user && ['hr', 'admin'].includes(user.role);

  const handleVoid = async () => {
    if (!voidingRequest) return;
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      showToast(i18n.language === 'th' ? 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' : 'Please provide a reason (min 5 characters)', 'warning');
      return;
    }

    const confirmMsg = i18n.language === 'th'
      ? 'ต้องการยกเลิกคำขอสลับกะนี้หรือไม่?'
      : 'Are you sure you want to void this shift swap request?';

    const confirmed = await showModal('confirm', i18n.language === 'th' ? 'ยืนยันการยกเลิก' : 'Confirm Void', {
      message: confirmMsg,
      confirmText: i18n.language === 'th' ? 'ยืนยัน' : 'Confirm',
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    setActionLoading(voidingRequest.id);
    try {
      await voidShiftSwap(voidingRequest.id, voidReason);
      await loadRequests();
      setVoidingRequest(null);
      setVoidReason('');
      showToast(i18n.language === 'th' ? 'ยกเลิกคำขอเรียบร้อยแล้ว' : 'Request voided successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to void request', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests =
    filterStatus === 'pending'
      ? requests.filter((req) => req.status === 'pending')
      : filterStatus === 'approved'
        ? requests.filter((req) => req.status === 'approved')
        : filterStatus === 'voided'
          ? requests.filter((req) => (req as any).status === 'voided')
          : requests;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'canceled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'voided':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('shift.approval')}</h1>
          <p className="text-gray-600 mt-1">{t('shift.approvalDesc')}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'pending'
            ? 'bg-yellow-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {t('shift.pending')}
          <span className="ml-2 bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
            {requests.filter((r) => r.status === 'pending').length}
          </span>
        </button>
        {canVoid && (
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'approved'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {i18n.language === 'th' ? 'อนุมัติแล้ว (ยกเลิกได้)' : 'Approved (Voidable)'}
            <span className="ml-2 bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-xs">
              {requests.filter((r) => r.status === 'approved').length}
            </span>
          </button>
        )}
        {canVoid && (
          <button
            onClick={() => setFilterStatus('voided')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'voided'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {i18n.language === 'th' ? 'ยกเลิกแล้ว' : 'Voided'}
            <span className="ml-2 bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-xs">
              {requests.filter((r) => (r as any).status === 'voided').length}
            </span>
          </button>
        )}
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'all'
            ? 'bg-gray-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {t('common.all')}
        </button>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">{t('shift.noRequests')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {i18n.language === 'th' ? request.employee_name_th : request.employee_name_en}
                    </h3>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {t(`shift.${request.status}`)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {request.employee_id}
                  </p>
                </div>
              </div>

              {/* Date Swap Info */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">{t('shift.fromWorkDate')}</p>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        {request.work_date && formatDateShort(new Date(request.work_date), i18n.language)}
                      </span>
                    </div>
                  </div>

                  <ArrowRightLeft className="w-6 h-6 text-blue-600 mt-5" />

                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">{t('shift.toOffDate')}</p>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg">
                      <Calendar className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-gray-900">
                        {request.off_date && formatDateShort(new Date(request.off_date), i18n.language)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              {request.reason && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">{t('shift.reason')}:</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {request.reason}
                  </p>
                </div>
              )}

              {/* Rejection Reason */}
              {request.rejection_reason && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-900 mb-1">
                    {t('shift.rejectionReason')}:
                  </p>
                  <p className="text-sm text-red-800">{request.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              {canApprove(request) && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={actionLoading === request.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {actionLoading === request.id ? t('common.loading') : t('shift.approve')}
                  </button>
                  <button
                    onClick={() => initReject(request.id)}
                    disabled={actionLoading === request.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    {t('shift.reject')}
                  </button>
                </div>
              )}

              {/* Void Button for Approved Requests */}
              {canVoid && request.status === 'approved' && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setVoidingRequest(request)}
                    disabled={actionLoading === request.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Ban className="w-5 h-5" />
                    {i18n.language === 'th' ? 'ยกเลิก (Void)' : 'Void Request'}
                  </button>
                </div>
              )}

              {/* Request Info */}
              <p className="text-xs text-gray-500 mt-4">
                {t('common.requestedOn')} {formatDateShort(new Date(request.created_at), i18n.language)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3 text-white">
                <XCircle className="w-6 h-6" />
                <h2 className="text-xl font-semibold">
                  {t('shift.reject')}
                </h2>
              </div>
              <button
                onClick={() => { setRejectingId(null); setRejectionReasonText(''); }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shift.rejectionReason')} *
              </label>
              <textarea
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder={t('shift.rejectionReason')}
              />
            </div>
            <div className="border-t px-6 py-4 flex gap-3 justify-end bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { setRejectingId(null); setRejectionReasonText(''); }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={actionLoading === rejectingId || !rejectionReasonText.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === rejectingId
                  ? t('common.loading')
                  : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3 text-white">
                <Ban className="w-6 h-6" />
                <h2 className="text-xl font-semibold">
                  {i18n.language === 'th' ? 'ยกเลิกคำขอสลับกะ' : 'Void Shift Swap'}
                </h2>
              </div>
              <button
                onClick={() => { setVoidingRequest(null); setVoidReason(''); }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-600">
                  {i18n.language === 'th'
                    ? `ยกเลิกคำขอสลับกะของ ${voidingRequest.employee_name_th}`
                    : `Void shift swap request by ${voidingRequest.employee_name_en}`}
                </p>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'th' ? 'เหตุผลในการยกเลิก' : 'Void Reason'} *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder={i18n.language === 'th' ? 'เช่น พนักงานไม่ได้สลับกะจริง...' : 'e.g., Employee did not swap shifts...'}
              />
            </div>
            <div className="border-t px-6 py-4 flex gap-3 justify-end bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { setVoidingRequest(null); setVoidReason(''); }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleVoid}
                disabled={actionLoading === voidingRequest.id || voidReason.trim().length < 5}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {actionLoading === voidingRequest.id
                  ? t('common.loading')
                  : (i18n.language === 'th' ? 'ยืนยันยกเลิก' : 'Confirm Void')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

