// src/components/approval/LeaveRequestCard.tsx
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, User, FileText } from 'lucide-react';
import type { LeaveRequest } from '../../api/leave';
import { formatDateShort } from '../../utils/dateUtils';
import { getApprovalFlowInfo } from '../../api/leave';
import { useQuery } from '@tanstack/react-query';
import { AttachmentBadge } from '../common/AttachmentBadge';
import { formatLeaveDurationDisplay } from '../../utils/leaveCalculator';

interface LeaveRequestCardProps {
  request: LeaveRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function LeaveRequestCard({ request, onApprove, onReject }: LeaveRequestCardProps) {
  const { t, i18n } = useTranslation();
  // ✅ Use canApprove from backend API instead of frontend hook
  const canApprove = request.canApprove ?? false;

  // Get approval flow with approver names
  const { data: approvalFlow, isLoading: loadingApprovals } = useQuery({
    queryKey: ['approvalFlow', request.employee_id, request.department_id],
    queryFn: () => getApprovalFlowInfo(request.employee_id!, request.department_id!),
    enabled: !!request.employee_id && !!request.department_id,
  });

  // Get current stage info
  const actualCurrentStage = approvalFlow?.currentStage || request.current_approval_stage;
  const currentStageInfo = approvalFlow?.stages?.find(
    (stage) => stage.stage === actualCurrentStage
  );

  // Get current stage approvers
  const getCurrentStageApprovers = () => {
    return currentStageInfo?.approvers || [];
  };

  const formatApproverNames = (approvers: any[]) => {
    if (!approvers || approvers.length === 0) return '';

    return approvers
      .map((approver) => i18n.language === 'th' ? approver.name_th : approver.name_en)
      .join(', ');
  };

  return (
    <div
      key={request.id}
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {i18n.language === 'th' ? request.employee_name_th : request.employee_name_en}
            </h3>
            <p className="text-sm text-gray-600">
              {request.department_name_th || request.department_name_en}
            </p>
          </div>
        </div>

        {/* Status Badge with Approver Names */}
        <div className="text-right">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
            {t('leave.pending')} - {
              (i18n.language === 'th' ? request.next_approver_name_th : request.next_approver_name_en) ||
              (i18n.language === 'th' ? currentStageInfo?.description_th : currentStageInfo?.description_en) ||
              `${t('approval.stage')} ${approvalFlow?.currentStage || request.current_approval_stage}`
            }
            {approvalFlow?.skippedStages && approvalFlow.skippedStages.length > 0 && (
              <span className="ml-1 text-xs text-yellow-600">
                ⏭️
              </span>
            )}
          </span>
          {!loadingApprovals && (
            <div className="mt-1 text-xs text-gray-600 max-w-[200px]">
              {getCurrentStageApprovers().length > 0 ? (
                <>
                  <span className="font-medium">
                    {t('approval.needsApprovalFrom')}:
                  </span>
                  <div className="text-gray-700 font-normal">
                    {formatApproverNames(getCurrentStageApprovers())}
                  </div>
                  {approvalFlow?.autoSkipReason && (
                    <div className="text-xs text-gray-500 italic mt-1">
                      {approvalFlow.autoSkipReason}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-500 italic">
                  {t('approval.noApproversFound')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="w-4 h-4" />
          <span>
            {i18n.language === 'th'
              ? request.leave_type_name_th
              : request.leave_type_name_en}
          </span>
          {request.attachment_urls && request.attachment_urls.length > 0 && (
            <AttachmentBadge
              count={request.attachment_urls.length}
              attachments={request.attachment_urls}
              className="ml-1"
            />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>
            {formatDateShort(new Date(request.start_date), i18n.language)} - {formatDateShort(new Date(request.end_date), i18n.language)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            {request.is_hourly_leave ? (
              (() => {
                const finalMinutes = Math.round(request.leave_minutes || 0);
                const isExactHour = finalMinutes % 60 === 0;
                const hours = Math.floor(finalMinutes / 60);
                const minutes = isExactHour ? 0 : finalMinutes % 60;
                const language = i18n.language as 'th' | 'en';
                if (language === 'th') {
                  return `${hours} ชม.${minutes > 0 ? ` ${minutes} นาที` : ''}`;
                } else {
                  return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
                }
              })()
            ) : (
              formatLeaveDurationDisplay(request, i18n.language as 'th' | 'en')
            )}
          </span>
        </div>
      </div>

      {/* Reason */}
      {(request.reason_th || request.reason_en) && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-700">
            {i18n.language === 'th' ? request.reason_th : request.reason_en}
          </p>
        </div>
      )}

      {/* Actions - Only show if user can approve */}
      {canApprove ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onApprove(request.id)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
          >
            ✓ {t('common.approve')}
          </button>
          <button
            onClick={() => onReject(request.id)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
          >
            ✗ {t('common.reject')}
          </button>
        </div>
      ) : (
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">
            {t('approval.cannotApproveAtThisStage')}
          </p>
        </div>
      )}
    </div>
  );
}
