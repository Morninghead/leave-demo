import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, UserMinus, Calendar } from 'lucide-react';
import { DatePicker } from '../common/DatePicker';

interface DeleteConfirmModalProps {
  employeeName: string;
  employeeCode: string;
  onConfirm: (resignationDate?: string, resignationReason?: string) => Promise<void>;
  onClose: () => void;
}

export function DeleteConfirmModal({
  employeeName,
  employeeCode,
  onConfirm,
  onClose
}: DeleteConfirmModalProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [resignationDate, setResignationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [resignationReason, setResignationReason] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(resignationDate, resignationReason);
      onClose();
    } catch (error) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  const isThaiLanguage = i18n.language === 'th';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <UserMinus className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {isThaiLanguage ? 'บันทึกการลาออก' : 'Record Resignation'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            {isThaiLanguage
              ? 'บันทึกการลาออกของพนักงานคนนี้ ข้อมูลจะถูกเก็บไว้เพื่อการตรวจสอบ'
              : 'Record resignation for this employee. Data will be retained for audit purposes.'}
          </p>

          {/* Employee Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">{t('employee.employeeCode')}</p>
            <p className="font-semibold text-gray-900">{employeeCode}</p>
            <p className="text-sm text-gray-600 mb-1 mt-2">{t('employee.name')}</p>
            <p className="font-semibold text-gray-900">{employeeName}</p>
          </div>

          {/* Resignation Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline-block mr-1" />
              {isThaiLanguage ? 'วันที่ลาออก' : 'Resignation Date'} *
            </label>
            <DatePicker
              value={resignationDate ? new Date(resignationDate) : null}
              onChange={(date) => {
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setResignationDate(`${year}-${month}-${day}`);
                } else {
                  setResignationDate('');
                }
              }}
              required
              placeholder={isThaiLanguage ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
            />
          </div>

          {/* Resignation Reason */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isThaiLanguage ? 'เหตุผลการลาออก' : 'Resignation Reason'}
            </label>
            <textarea
              value={resignationReason}
              onChange={(e) => setResignationReason(e.target.value)}
              placeholder={isThaiLanguage ? 'ระบุเหตุผล (ไม่บังคับ)' : 'Enter reason (optional)'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              {isThaiLanguage
                ? '📋 พนักงานจะถูกตั้งสถานะเป็น "ไม่ใช้งาน" และข้อมูลทั้งหมดจะถูกเก็บรักษาไว้เพื่อการตรวจสอบ'
                : '📋 Employee will be marked as "inactive" and all data will be preserved for audit purposes.'}
            </p>
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
            disabled={loading || !resignationDate}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <UserMinus className="w-5 h-5" />
            {loading
              ? (isThaiLanguage ? 'กำลังบันทึก...' : 'Saving...')
              : (isThaiLanguage ? 'บันทึกลาออก' : 'Record Resignation')}
          </button>
        </div>
      </div>
    </div>
  );
}

