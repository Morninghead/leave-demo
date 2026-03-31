import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, ArrowRightLeft } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { ShiftSwapRequest } from '../../types/shift';
import { getShiftSwapRequests, updateShiftRequestStatus } from '../../api/shift';
import { formatDateShort } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

interface ShiftHistoryProps {
  onRefresh?: number;
}

export function ShiftHistory({ onRefresh }: ShiftHistoryProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  useEffect(() => {
    loadRequests();
  }, [filter, onRefresh]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getShiftSwapRequests(filter === 'all' ? undefined : filter);
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    const confirmed = await showModal('confirm', t('shift.approve'), {
      message: t('message.confirmSubmit'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    setActionLoading(requestId);
    try {
      await updateShiftRequestStatus(requestId, {
        status: 'approved',
      });
      loadRequests();
      showToast(t('shift.approveSuccess'), 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
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
      loadRequests();
      showToast(t('shift.rejectSuccess'), 'success');
      setRejectingId(null);
      setRejectionReasonText('');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    const confirmed = await showModal('confirm', t('shift.cancel'), {
      message: t('shift.confirmCancel'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    setActionLoading(requestId);
    try {
      await updateShiftRequestStatus(requestId, {
        status: 'canceled',
      });
      loadRequests();
      showToast(t('shift.cancelSuccess'), 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'canceled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: t('shift.pending'),
      approved: t('leave.approved'),
      rejected: t('leave.rejected'),
      canceled: t('leave.canceled'),
    };
    return statusMap[status] || status;
  };

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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const canApprove = (request: ShiftSwapRequest) => {
    return request.status === 'pending' && ['manager', 'hr', 'admin'].includes(user?.role || '');
  };

  const canCancel = (request: ShiftSwapRequest) => {
    return request.status === 'pending' && request.employee_id === user?.id;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          {t('shift.myShifts')}
        </h3>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">{t('common.all')}</option>
          <option value="pending">{t('shift.pending')}</option>
          <option value="approved">{t('leave.approved')}</option>
          <option value="rejected">{t('leave.rejected')}</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {request.request_number}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {getStatusText(request.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {i18n.language === 'th'
                      ? request.employee_name_th
                      : request.employee_name_en}
                  </p>
                </div>
                {getStatusIcon(request.status)}
              </div>

              {/* Dates with Arrow */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-blue-700 font-medium">
                      {t('shift.workDate')}
                    </p>
                  </div>
                  <p className="text-sm text-blue-900 font-semibold">
                    {request.work_date && formatDateShort(new Date(request.work_date), i18n.language)}
                  </p>
                </div>

                <div className="shrink-0">
                  <ArrowRightLeft className="w-6 h-6 text-gray-400" />
                </div>

                <div className="flex-1 bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-green-700 font-medium">
                      {t('shift.offDate')}
                    </p>
                  </div>
                  <p className="text-sm text-green-900 font-semibold">
                    {request.off_date && formatDateShort(new Date(request.off_date), i18n.language)}
                  </p>
                </div>
              </div>

              {/* Reason */}
              {request.reason && (
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">{t('shift.reason')}:</span>{' '}
                  {request.reason}
                </p>
              )}

              {/* Rejection Reason */}
              {request.rejection_reason && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-xs text-red-700 font-medium">{t('shift.rejectionReason')}:</p>
                  <p className="text-sm text-red-900">{request.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {canApprove(request) && (
                  <>
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={actionLoading === request.id}
                      className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionLoading === request.id ? t('common.loading') : t('shift.approve')}
                    </button>
                    <button
                      onClick={() => initReject(request.id)}
                      disabled={actionLoading === request.id}
                      className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {t('shift.reject')}
                    </button>
                  </>
                )}
                {canCancel(request) && (
                  <button
                    onClick={() => handleCancel(request.id)}
                    disabled={actionLoading === request.id}
                    className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    {actionLoading === request.id ? t('common.loading') : t('shift.cancel')}
                  </button>
                )}
              </div>
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
                {/* Using X icon but need to import it or just use similar */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
    </div>
  );
}


