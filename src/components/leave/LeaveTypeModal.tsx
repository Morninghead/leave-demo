import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { createLeaveType, updateLeaveType, LeaveType } from '../../api/leaveTypes';

interface LeaveTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editLeaveType?: LeaveType | null;
}

export function LeaveTypeModal({ isOpen, onClose, onSuccess, editLeaveType }: LeaveTypeModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name_th: '',
    name_en: '',
    description_th: '',
    description_en: '',
    default_days: 0,
    requires_attachment: false,
    is_paid: true,
    color_code: '#3B82F6',
    is_active: true,
    color: '#3B82F6',
    allow_hourly_leave: false,
    is_annual_leave: false,
    is_unpaid_leave: false,
    is_sick_leave: false,
    is_personal_leave: false,
  });

  // Populate form when editing
  useEffect(() => {
    if (editLeaveType) {
      setFormData({
        code: editLeaveType.code || '',
        name_th: editLeaveType.name_th || '',
        name_en: editLeaveType.name_en || '',
        description_th: editLeaveType.description_th || '',
        description_en: editLeaveType.description_en || '',
        default_days: editLeaveType.default_days || 0,
        requires_attachment: editLeaveType.requires_attachment || false,
        is_paid: editLeaveType.is_paid !== undefined ? editLeaveType.is_paid : true,
        color_code: editLeaveType.color_code || '#3B82F6',
        is_active: editLeaveType.is_active !== undefined ? editLeaveType.is_active : true,
        color: editLeaveType.color || '#3B82F6',
        allow_hourly_leave: editLeaveType.allow_hourly_leave || false,
        is_annual_leave: (editLeaveType as any).is_annual_leave || false,
        is_unpaid_leave: (editLeaveType as any).is_unpaid_leave || false,
        is_sick_leave: (editLeaveType as any).is_sick_leave || false,
        is_personal_leave: (editLeaveType as any).is_personal_leave || false,
      });
    } else {
      // Reset form for create mode
      setFormData({
        code: '',
        name_th: '',
        name_en: '',
        description_th: '',
        description_en: '',
        default_days: 0,
        requires_attachment: false,
        is_paid: true,
        color_code: '#3B82F6',
        is_active: true,
        color: '#3B82F6',
        allow_hourly_leave: false,
        is_annual_leave: false,
        is_unpaid_leave: false,
        is_sick_leave: false,
        is_personal_leave: false,
      });
    }
  }, [editLeaveType, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editLeaveType) {
        // Update existing leave type
        await updateLeaveType(editLeaveType.id, formData);
      } else {
        // Create new leave type
        await createLeaveType(formData);
      }
      onSuccess();
      onClose();
      setFormData({
        code: '',
        name_th: '',
        name_en: '',
        description_th: '',
        description_en: '',
        default_days: 0,
        requires_attachment: false,
        is_paid: true,
        color_code: '#3B82F6',
        is_active: true,
        color: '#3B82F6',
        allow_hourly_leave: false,
        is_annual_leave: false,
        is_unpaid_leave: false,
        is_sick_leave: false,
        is_personal_leave: false,
      });
    } catch (err: any) {
      setError(err.message || `Failed to ${editLeaveType ? 'update' : 'create'} leave type`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {editLeaveType ? t('leaveType.edit') : t('leaveType.createNew')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.code')} *
              <span className="block mt-1 text-xs text-gray-500">
                รหัสประเภทการลา เช่น SICK, VAC, WFH หรือ MAT (ต้องไม่ซ้ำกับประเภทอื่น ไม่มีเว้นวรรคหรืออักขระพิเศษ) ใช้อ้างอิงในระบบ/รายงาน/เชื่อมกับระบบ HR หรือบัญชี กำหนดเองตามนโยบายองค์กร เช่น mapping กับระบบเงินเดือน
                {editLeaveType && <span className="text-orange-600"> (ไม่สามารถแก้ไขรหัสได้หลังจากสร้างแล้ว / Code cannot be changed after creation)</span>}
              </span>
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="เช่น SICK, VAC, WFH"
              disabled={!!editLeaveType}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.nameTh')} *
            </label>
            <input
              type="text"
              required
              value={formData.name_th}
              onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="ชื่อประเภทการลา (ภาษาไทย)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.nameEn')} *
            </label>
            <input
              type="text"
              required
              value={formData.name_en}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Leave Type Name (English)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.descriptionTh')}
            </label>
            <textarea
              value={formData.description_th}
              onChange={(e) => setFormData({ ...formData, description_th: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="คำอธิบาย (ภาษาไทย)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.descriptionEn')}
            </label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="Description (English)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.defaultDays')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.default_days}
              onChange={(e) => setFormData({ ...formData, default_days: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leaveType.color')}
            </label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value, color_code: e.target.value })}
              className="w-20 h-10 border border-gray-300 rounded-md"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.requires_attachment}
                onChange={(e) => setFormData({ ...formData, requires_attachment: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">{t('leaveType.requiresAttachment')}</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.allow_hourly_leave}
                onChange={(e) => setFormData({ ...formData, allow_hourly_leave: e.target.checked })}
                className="mr-2"
              />
              <div>
                <span className="text-sm font-medium">อนุญาตให้ลาเป็นชั่วโมง</span>
                <span className="block text-xs text-gray-500">
                  Allow hourly leave requests (1hr minimum, 8hr maximum)
                </span>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_paid}
                onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">{t('leaveType.isPaid')}</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">{t('leaveType.isActive')}</span>
            </label>
          </div>

          {/* Leave Type Classification Flags */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              ประเภทการลาเชิงระบบ (System Leave Type Classification)
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              เลือกหนึ่งข้อหรือไม่เลือกเลยก็ได้ หากเป็นประเภทพิเศษ ใช้สำหรับการคำนวณอัตโนมัติและรายงาน
            </p>
            <div className="space-y-2 bg-gray-50 p-3 rounded-md">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_annual_leave}
                  onChange={(e) => setFormData({ ...formData, is_annual_leave: e.target.checked })}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium">ลาพักร้อน (Annual Leave)</span>
                  <span className="block text-xs text-gray-500">
                    ใช้สำหรับการคำนวณ pro-rata และการติดตามวันพักร้อนประจำปี
                  </span>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_unpaid_leave}
                  onChange={(e) => setFormData({ ...formData, is_unpaid_leave: e.target.checked })}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium">ลาไม่รับค่าจ้าง (Unpaid Leave)</span>
                  <span className="block text-xs text-gray-500">
                    แสดงเป็นตัวนับจำนวนวันที่ลาไปโดยไม่หักจากยอดคงเหลือ
                  </span>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_sick_leave}
                  onChange={(e) => setFormData({ ...formData, is_sick_leave: e.target.checked })}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium">ลาป่วย (Sick Leave)</span>
                  <span className="block text-xs text-gray-500">
                    ใช้สำหรับรายงานและการติดตามการลาป่วยของพนักงาน
                  </span>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_personal_leave}
                  onChange={(e) => setFormData({ ...formData, is_personal_leave: e.target.checked })}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium">ลากิจ (Personal Leave)</span>
                  <span className="block text-xs text-gray-500">
                    ใช้สำหรับรายงานและการติดตามการลากิจของพนักงาน
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

