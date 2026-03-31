// src/components/approval/ApprovalConfirmModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle, Calendar, Clock, FileText, Paperclip } from 'lucide-react';
import type { LeaveRequest } from '../../api/leave';
import { formatDateShort } from '../../utils/dateUtils';
import { AttachmentsList } from '../leave/AttachmentsList';

interface ApprovalConfirmModalProps {
  request: LeaveRequest;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ApprovalConfirmModal({
  request,
  onConfirm,
  onClose,
}: ApprovalConfirmModalProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      // onConfirm handles closing on success
    } catch (error) {
      // Error handled in parent, close modal on error
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {t('approval.confirmApprove')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            {t('approval.confirmApproveMessage')}
          </p>

          {/* Request Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">
                {t('leave.employee')}
              </p>
              <p className="font-semibold text-gray-900">
                {i18n.language === 'th'
                  ? request.employee_name_th
                  : request.employee_name_en}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">
                {t('leave.leaveType')}
              </p>
              <p className="font-semibold text-gray-900">
                {i18n.language === 'th'
                  ? request.leave_type_name_th
                  : request.leave_type_name_en}
              </p>
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {formatDateShort(request.start_date)} -{' '}
                {formatDateShort(request.end_date)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                {request.total_days} {t('leave.days')}
              </span>
            </div>

            {request.reason && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <FileText className="w-4 h-4" />
                  <p className="text-sm">{t('leave.reason')}</p>
                </div>
                <p className="text-sm text-gray-700 pl-6">{request.reason}</p>
              </div>
            )}

            {/* Attachments */}
            {request.attachment_urls && request.attachment_urls.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <Paperclip className="w-4 h-4" />
                  <p className="text-sm font-medium">
                    {t('leave.attachments')} ({request.attachment_urls.length})
                  </p>
                </div>
                <AttachmentsList attachments={request.attachment_urls} />
              </div>
            )}
          </div>

          <p className="text-sm text-green-600 mt-4">
            {t('approval.approvalStage')}: {request.current_approval_stage}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            {loading ? t('common.loading') : t('approval.approve')}
          </button>
        </div>
      </div>
    </div>
  );
}

