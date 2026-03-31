// src/components/approval/LeaveApprovalList.tsx
import { logger } from '../../utils/logger';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  // Eye, - Removed unused
  // FileText, - Removed unused
  // Calendar - Removed unused
} from 'lucide-react';
import type { LeaveRequest } from '../../api/leave';
import { getPendingLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../../api/leave';
import { useToast } from '../../hooks/useToast';
import { ApprovalConfirmModal } from './ApprovalConfirmModal';
import { RejectReasonModal } from './RejectReasonModal';
import { formatDateShort, formatDateTime } from '../../utils/dateUtils';
import { formatLeaveDurationDisplay } from '../../utils/leaveCalculator';
import { AttachmentBadge } from '../common/AttachmentBadge';

interface LeaveApprovalListProps {
  onUpdate: () => Promise<void>;
}

export function LeaveApprovalList({ onUpdate }: LeaveApprovalListProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<LeaveRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingLeaveRequests();
      setRequests(data);
    } catch (error: any) {
      logger.error('Failed to load leave requests:', error);
      setError(error.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;
    setApprovingRequest(request);
  };

  const confirmApprove = async () => {
    if (!approvingRequest) return;

    try {
      await approveLeaveRequest(approvingRequest.id);
      showToast(t('approval.requestApproved'), 'success');
      await loadRequests();
      await onUpdate();
      setApprovingRequest(null);
    } catch (error: any) {
      logger.error('Failed to approve:', error);
      showToast(error.message || t('approval.approveError'), 'error');
    }
  };

  const handleReject = async (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;
    setRejectingRequest(request);
  };

  const confirmReject = async (reason: string) => {
    if (!rejectingRequest) return;

    try {
      await rejectLeaveRequest(rejectingRequest.id, reason);
      showToast(t('approval.requestRejected'), 'success');
      await loadRequests();
      await onUpdate();
      setRejectingRequest(null);
    } catch (error: any) {
      logger.error('Failed to reject:', error);
      showToast(error.message || t('approval.rejectError'), 'error');
    }
  };

  const groupedRequests = useMemo(() => {
    const groups: Record<string, LeaveRequest[]> = {};
    requests.forEach(req => {
      const deptName = i18n.language === 'th'
        ? (req.department_name_th || t('common.department') + ' ' + t('common.unknown'))
        : (req.department_name_en || t('common.department') + ' Unknown');

      const key = deptName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(req);
    });
    return groups;
  }, [requests, i18n.language, t]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedRequests).sort((a, b) => a.localeCompare(b));
  }, [groupedRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'department_approved':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'voided':
      case 'cancelled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    if (status === 'voided') return t('leave.cancelled');
    return t(`leave.${status}`);
  };

  const createdAtLabel = i18n.language === 'th' ? 'สร้างเมื่อ' : 'Created';
  const formatRequestCreatedAt = (createdAt?: string) =>
    createdAt ? formatDateTime(createdAt, i18n.language) : '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-red-50 rounded-lg">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadRequests}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">{t('approval.noLeaveRequests')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {sortedGroupKeys.map((deptName) => {
          const deptRequests = groupedRequests[deptName];
          return (
            <div key={deptName} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3 px-1 border-l-4 border-blue-600 pl-3">
                {deptName}
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200 font-normal">
                  {deptRequests.length}
                </span>
              </h3>

              <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('leave.employee')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('leave.leaveType')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('leave.leavePeriod')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('leave.duration')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('leave.status')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('common.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deptRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                {(i18n.language === 'th' ? request.employee_name_th : request.employee_name_en)?.charAt(0) || 'U'}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {i18n.language === 'th' ? request.employee_name_th : request.employee_name_en}
                                </div>
                                <div className="text-xs text-gray-500">{request.department_name_th || request.department_name_en}</div>
                                <div className="mt-1 space-y-0.5">
                                  <div className="text-xs font-mono text-blue-700">
                                    #{request.request_number}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {createdAtLabel}: {formatRequestCreatedAt(request.created_at)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {i18n.language === 'th' ? request.leave_type_name_th : request.leave_type_name_en}
                            </span>
                            {request.attachment_urls && request.attachment_urls.length > 0 && (
                              <div className="mt-1">
                                <AttachmentBadge count={request.attachment_urls.length} attachments={request.attachment_urls} />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-col">
                              <span>{formatDateShort(new Date(request.start_date), i18n.language)}</span>
                              <span className="text-xs text-gray-400 text-center">-</span>
                              <span>{formatDateShort(new Date(request.end_date), i18n.language)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {request.is_hourly_leave ? (
                              (() => {
                                const finalMinutes = Math.round(request.leave_minutes || 0);
                                const hours = Math.floor(finalMinutes / 60);
                                const minutes = finalMinutes % 60;
                                return i18n.language === 'th'
                                  ? `${hours} ชม. ${minutes > 0 ? minutes + ' นาที' : ''}`
                                  : `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`;
                              })()
                            ) : (
                              formatLeaveDurationDisplay(request, i18n.language as 'th' | 'en')
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                              {getStatusText(request.status)}
                            </span>
                            {(request.next_approver_name_th || request.next_approver_name_en) && (
                              <div className="mt-1 text-xs text-gray-500 flex items-center gap-1" title={t('approval.needsApprovalFrom')}>
                                <Clock className="w-3 h-3" />
                                <span className="truncate max-w-[100px]">
                                  {i18n.language === 'th' ? request.next_approver_name_th : request.next_approver_name_en}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              {(request.canApprove !== false) && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprove(request.id);
                                    }}
                                    className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1.5 rounded-full transition-colors"
                                    title={t('common.approve')}
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReject(request.id);
                                    }}
                                    className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-full transition-colors"
                                    title={t('common.reject')}
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View (Compact) */}
                <div className="md:hidden divide-y divide-gray-200">
                  {deptRequests.map((request) => (
                    <div key={request.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold">
                            {(i18n.language === 'th' ? request.employee_name_th : request.employee_name_en)?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {i18n.language === 'th' ? request.employee_name_th : request.employee_name_en}
                            </p>
                            <div className="mt-1 space-y-0.5">
                              {request.employee_code && (
                                <p className="text-xs text-gray-500">{request.employee_code}</p>
                              )}
                              <p className="text-[11px] font-mono text-blue-700">#{request.request_number}</p>
                              <p className="text-[11px] text-gray-500">
                                {createdAtLabel}: {formatRequestCreatedAt(request.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                          {getStatusText(request.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="block text-xs text-gray-500 uppercase">{t('leave.leaveType')}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{i18n.language === 'th' ? request.leave_type_name_th : request.leave_type_name_en}</span>
                            {request.attachment_urls && request.attachment_urls.length > 0 && (
                              <AttachmentBadge count={request.attachment_urls.length} attachments={request.attachment_urls} />
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500 uppercase">{t('leave.duration')}</span>
                          {formatLeaveDurationDisplay(request, i18n.language as 'th' | 'en')}
                        </div>
                        <div className="col-span-2">
                          <span className="block text-xs text-gray-500 uppercase">{t('leave.leavePeriod')}</span>
                          {formatDateShort(new Date(request.start_date), i18n.language)} - {formatDateShort(new Date(request.end_date), i18n.language)}
                        </div>
                      </div>

                      {(request.canApprove !== false) && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="flex-1 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {t('common.approve')}
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="flex-1 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            {t('common.reject')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Approval Confirmation Modal */}
      {approvingRequest && (
        <ApprovalConfirmModal
          request={approvingRequest}
          onConfirm={confirmApprove}
          onClose={() => setApprovingRequest(null)}
        />
      )}

      {/* Reject Reason Modal */}
      {rejectingRequest && (
        <RejectReasonModal
          request={rejectingRequest}
          onConfirm={confirmReject}
          onClose={() => setRejectingRequest(null)}
        />
      )}
    </>
  );
}

