import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { getLeaveTypes, adjustLeaveBalance } from '../../api/leave';

interface Props {
  employee: {
    id: string;
    employee_code: string;
    name_th: string;
  };
  year: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

export function AdjustBalanceModal({ employee, year, onClose, onSuccess }: Props) {
  const { t, i18n } = useTranslation();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [adjustmentDays, setAdjustmentDays] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await getLeaveTypes();
      setLeaveTypes(response || []);
    } catch (error) {
      console.error('Failed to fetch leave types:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLeaveType || adjustmentDays === 0 || !reason) {
      setError(t('common.fillAllFields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adjustLeaveBalance(
        employee.id,
        selectedLeaveType,
        year,
        adjustmentDays,
        reason
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 bg-orange-600 text-white flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold">{t('admin.adjustBalance')}</h2>
            <p className="text-orange-100 text-sm">
              {employee.name_th}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-orange-500 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('leave.leaveType')} <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLeaveType}
              onChange={(e) => setSelectedLeaveType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">{t('common.select')}</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {i18n.language === 'th' ? type.name_th : type.name_en}
                </option>
              ))}
            </select>
          </div>

          {/* Adjustment Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin.adjustmentDays')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={adjustmentDays}
                onChange={(e) => setAdjustmentDays(parseFloat(e.target.value))}
                step="0.5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="0.0"
                required
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {adjustmentDays > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : adjustmentDays < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                ) : null}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.adjustmentDaysHint')}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.reason')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
              placeholder={t('admin.adjustmentReasonPlaceholder')}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

