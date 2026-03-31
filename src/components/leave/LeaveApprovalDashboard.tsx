import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, Eye, XCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { LeaveRequest } from '../../types/leave';
import { getLeaveRequests } from '../../api/leave';
import { formatDateShort, formatDateTime } from '../../utils/dateUtils';
import { LeaveRequestDetail } from './LeaveRequestDetail';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { formatLeaveDurationDisplay } from '../../utils/leaveCalculator';
import { AttachmentBadge } from '../common/AttachmentBadge';

export function LeaveApprovalDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [filter, setFilter] = useState<string>('pending');

  const loadRequests = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // ⭐ getLeaveRequests return array โดยตรง ไม่ใช่ object
      const leaveRequests = await getLeaveRequests({
        for_approval: true,
        status: filter === 'all' ? undefined : filter,
      });

      // ⭐ leaveRequests เป็น array อยู่แล้ว
      setRequests(Array.isArray(leaveRequests) ? leaveRequests : []);
    } catch (error) {
      console.error('Failed to load requests:', error);
      setRequests([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filter]);

  // Auto-refresh every 3 minutes for pending approvals
  // Disable when detail modal is open to prevent disrupting user's review
  useAutoRefresh({
    category: 'LEAVE_REQUESTS',
    dataType: 'PENDING',
    onRefresh: () => loadRequests(true),
    enabled: !selectedRequest, // Disable when viewing details
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'department_approved':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    return t(`leave.${status}`);
  };

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
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const groupedRequests = useMemo(() => {
    const groups: Record<string, LeaveRequest[]> = {};
    requests.forEach(req => {
      const deptName = i18n.language === 'th'
        ? (req.department_name_th || t('common.unknownDepartment'))
        : (req.department_name_en || t('common.unknownDepartment'));

      const key = deptName || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(req);
    });
    return groups;
  }, [requests, i18n.language, t]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedRequests).sort((a, b) => a.localeCompare(b));
  }, [groupedRequests]);

  const createdAtLabel = i18n.language === 'th' ? 'สร้างเมื่อ' : 'Created';

  if (!user || !['manager', 'hr', 'admin'].includes(user.role)) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">{t('common.noPermission')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('leave.approvalDashboard')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('leave.approvalDescription')}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('leave.pending')}
            <span className="ml-2 bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
              {requests.filter((r) => r.status === 'pending').length}
            </span>
          </button>
          <button
            onClick={() => setFilter('department_approved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'department_approved'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('leave.departmentApproved')}
            <span className="ml-2 bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs">
              {requests.filter((r) => r.status === 'department_approved').length}
            </span>
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('common.all')}
          </button>
        </div>

        {/* Stats - Compact Version */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-700 font-medium uppercase tracking-wider">{t('leave.pendingApproval')}</p>
              <p className="text-xl font-bold text-yellow-900 mt-1">
                {requests.filter((r) => r.status === 'pending').length}
              </p>
            </div>
            <div className="bg-yellow-100 p-2 rounded-full">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium uppercase tracking-wider">{t('leave.departmentApproved')}</p>
              <p className="text-xl font-bold text-blue-900 mt-1">
                {requests.filter((r) => r.status === 'department_approved').length}
              </p>
            </div>
            <div className="bg-blue-100 p-2 rounded-full">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-medium uppercase tracking-wider">{t('leave.approved')}</p>
              <p className="text-xl font-bold text-green-900 mt-1">
                {requests.filter((r) => r.status === 'approved').length}
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        {/* Requests List - Grouped by Department */}
        {requests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('leave.noRequestsToApprove')}</p>
          </div>
        ) : (
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                              {t('leave.employee')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                              {t('leave.type')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">
                              {t('leave.dates')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                              {t('leave.duration')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                              {t('leave.status')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
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
                                    {(i18n.language === 'th' ? request.employee_name_th : request.employee_name_en).charAt(0)}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900">
                                      {i18n.language === 'th' ? request.employee_name_th : request.employee_name_en}
                                    </div>
                                    <div className="text-xs text-gray-500">{request.employee_code}</div>
                                    <div className="mt-1 space-y-0.5">
                                      <div className="text-xs font-mono text-blue-700">
                                        #{request.request_number}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {createdAtLabel}: {formatDateTime(request.created_at, i18n.language)}
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
                                  <span className="text-xs text-gray-400">to</span>
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
                                {/* Next Approver (Compact) */}
                                {(request.status === 'pending' || request.status === 'department_approved') && (request.next_approver_name_th || request.next_approver_name_en) && (
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
                                  {/* Quick Actions for Pending Requests */}
                                  {request.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const confirmed = await showModal('confirm', t('common.approve'), {
                                            message: t('common.confirmApprove'),
                                            confirmText: t('common.approve'),
                                            cancelText: t('common.cancel'),
                                          });

                                          if (confirmed) {
                                            // TODO: Call approve API
                                            // For now, open View to be safe, or implement quick approve if requested
                                            setSelectedRequest(request);
                                          }
                                        }}
                                        className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1.5 rounded-full transition-colors"
                                        title={t('common.approve')}
                                      >
                                        <CheckCircle className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedRequest(request); // Open detail for rejection reason
                                        }}
                                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-full transition-colors"
                                        title={t('common.reject')}
                                      >
                                        <XCircle className="w-5 h-5" />
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => setSelectedRequest(request)}
                                    className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-full transition-colors"
                                    title={t('common.view')}
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View (Keep for small screens) */}
                    <div className="md:hidden divide-y divide-gray-200">
                      {deptRequests.map((request) => (
                        <div key={request.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold">
                                {(i18n.language === 'th' ? request.employee_name_th : request.employee_name_en).charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {i18n.language === 'th' ? request.employee_name_th : request.employee_name_en}
                                </p>
                                <div className="mt-1 space-y-0.5">
                                  <p className="text-xs text-gray-500">{request.employee_code}</p>
                                  <p className="text-[11px] font-mono text-blue-700">#{request.request_number}</p>
                                  <p className="text-[11px] text-gray-500">
                                    {createdAtLabel}: {formatDateTime(request.created_at, i18n.language)}
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
                              <span className="block text-xs text-gray-500 uppercase">{t('leave.type')}</span>
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
                              <span className="block text-xs text-gray-500 uppercase">{t('leave.dates')}</span>
                              {formatDateShort(new Date(request.start_date), i18n.language)} - {formatDateShort(new Date(request.end_date), i18n.language)}
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setSelectedRequest(request)}
                              className="flex-1 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              {t('common.view')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <LeaveRequestDetail
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdate={async () => {
            setSelectedRequest(null);
            await loadRequests();
          }}
        />
      )}
    </>
  );
}

