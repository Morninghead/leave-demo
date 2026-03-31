// src/components/admin/ResetBalancesModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';
import { resetAllLeaveBalances } from '../../api/leave';
import { useToast } from '../../hooks/useToast';

interface ResetBalancesModalProps {
  year: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetBalancesModal({ year, onClose, onSuccess }: ResetBalancesModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const handleReset = async () => {
    if (confirmation !== `RESET ${year}`) {
      showToast(t('admin.resetConfirmationError'), 'error');
      return;
    }

    setLoading(true);
    try {
      await resetAllLeaveBalances(year);
      showToast(t('admin.resetSuccess'), 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message || t('admin.resetFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('admin.resetBalancesTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4 bg-red-50 p-4 rounded-lg">
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <div>
              <h3 className="font-bold text-red-800">{t('admin.resetWarningTitle')}</h3>
              <p className="text-sm text-red-700">{t('admin.resetWarningText', { year })}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('admin.resetConfirmationLabel', { year })}
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleReset}
            disabled={loading || confirmation !== `RESET ${year}`}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
          >
            {loading ? t('common.loading') : t('admin.resetButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
