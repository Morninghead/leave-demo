// src/components/approval/RejectReasonModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, XCircle, Calendar, Clock, FileText } from 'lucide-react';
import type { LeaveRequest } from '../../api/leave';
import { formatDateShort } from '../../utils/dateUtils';

interface RejectReasonModalProps {
  request: LeaveRequest;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function RejectReasonModal({
  request,
  onConfirm,
  onClose,
}: RejectReasonModalProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(t('approval.reasonRequired'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason);
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
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {t('approval.rejectRequest')}
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
            {t('approval.confirmRejectMessage')}
          </p>

          {/* Request Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
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
          </div>

          {/* Rejection Reason Input */}
          <div>
            <label
              htmlFor="rejection-reason"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              {t('approval.enterRejectionReason')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              rows={4}
              className={`w-full px-3 py-2 border ${
                error ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none`}
              placeholder={t('approval.rejectionReasonPlaceholder')}
              disabled={loading}
            />
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          </div>
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
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" />
            {loading ? t('common.loading') : t('approval.reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

