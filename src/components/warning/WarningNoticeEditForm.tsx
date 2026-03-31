// src/components/warning/WarningNoticeEditForm.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X, AlertCircle, Plus, Trash2, Upload, Paperclip, FileVideo, ExternalLink } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';
import { DatePicker } from '../../components/common/DatePicker';
import { isImageFile, isVideoFile, uploadToSupabase, deleteFromSupabase, getFileNameFromUrl } from '../../utils/supabaseUpload';

interface Employee {
  id: number;
  employee_code: string;
  name_th: string;
  name_en: string;
}

interface OffenseType {
  id: number;
  code: string;
  name_th: string;
  name_en: string;
  severity_level: number;
}

interface Witness {
  id?: number;
  witness_employee_id?: number;
  witness_name: string;
  witness_position: string;
  statement: string;
}

interface Warning {
  id: number;
  notice_number: string;
  employee_id: number;
  warning_type: string;
  offense_type_id: number;
  incident_date: string;
  incident_description: string;
  incident_location: string;
  penalty_description: string;
  suspension_days: number;
  suspension_start_date: string;
  suspension_end_date: string;
  effective_date: string;
  status: string;
  witnesses?: Witness[];
  attachments_urls?: string[];
}

interface WarningFormData {
  employee_id: string;
  warning_type: string;
  offense_type_id: string;
  incident_date: string;
  incident_description: string;
  incident_location: string;
  penalty_description: string;
  suspension_days: number;
  suspension_start_date: string;
  suspension_end_date: string;
  effective_date: string;
  witnesses: Witness[];
  attachments_urls: string[];
}

const WARNING_TYPES = [
  { value: 'VERBAL', label_th: 'ตักเตือนด้วยวาจา', label_en: 'Verbal Warning' },
  { value: 'WRITTEN_1ST', label_th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 1', label_en: 'Written Warning 1st' },
  { value: 'WRITTEN_2ND', label_th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 2', label_en: 'Written Warning 2nd' },
  { value: 'FINAL_WARNING', label_th: 'ตักเตือนครั้งสุดท้าย', label_en: 'Final Warning' },
  { value: 'SUSPENSION', label_th: 'พักงาน', label_en: 'Suspension' },
  { value: 'TERMINATION', label_th: 'เลิกจ้าง', label_en: 'Termination' },
];

export function WarningNoticeEditForm({
  warning,
  onClose,
  onSuccess,
}: {
  warning: Warning;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offenseTypes, setOffenseTypes] = useState<OffenseType[]>([]);
  const [requiresReapproval, setRequiresReapproval] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState<WarningFormData>({
    employee_id: warning.employee_id.toString(),
    warning_type: warning.warning_type,
    offense_type_id: warning.offense_type_id.toString(),
    incident_date: warning.incident_date.split('T')[0],
    incident_description: warning.incident_description || (warning as any).incident_description_th, // Fallback for transition
    incident_location: warning.incident_location || '',
    penalty_description: warning.penalty_description || (warning as any).penalty_description_th, // Fallback for transition
    suspension_days: warning.suspension_days || 0,
    suspension_start_date: warning.suspension_start_date ? warning.suspension_start_date.split('T')[0] : '',
    suspension_end_date: warning.suspension_end_date ? warning.suspension_end_date.split('T')[0] : '',
    effective_date: warning.effective_date.split('T')[0],
    witnesses: warning.witnesses || [],
    attachments_urls: warning.attachments_urls || [],
  });

  useEffect(() => {
    loadEmployees();
    loadOffenseTypes();
    checkReapprovalNeeded();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees?status=active');
      if (response.data.success) {
        setEmployees(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadOffenseTypes = async () => {
    try {
      const response = await api.get('/offense-types');
      if (response.data.success) {
        setOffenseTypes(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load offense types:', error);
    }
  };

  const checkReapprovalNeeded = () => {
    // If warning is already acknowledged/refused/appealed, editing will require re-approval
    const needsReapproval = ['ACKNOWLEDGED', 'REFUSED', 'APPEALED'].includes(warning.status);
    setRequiresReapproval(needsReapproval);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_id || !formData.offense_type_id) {
      showToast(t('warning.pleaseSelectEmployee'), 'warning');
      return;
    }

    if (!formData.incident_description || !formData.penalty_description) {
      showToast(t('warning.pleaseFillRequired'), 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put('/warning-notice-update', {
        warning_id: warning.id,
        ...formData,
      });

      if (response.data.success) {
        const message = response.data.requires_reapproval
          ? i18n.language === 'th'
            ? 'อัพเดทใบเตือนสำเร็จ - ต้องการการอนุมัติจาก HR อีกครั้ง'
            : 'Warning updated successfully - HR re-approval required'
          : i18n.language === 'th'
            ? 'อัพเดทใบเตือนสำเร็จ'
            : 'Warning updated successfully';

        showToast(message, 'success');
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to update warning:', error);
      showToast(
        error.response?.data?.message || t('warning.updateFailed'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const addWitness = () => {
    setFormData({
      ...formData,
      witnesses: [
        ...formData.witnesses,
        {
          witness_name: '',
          witness_position: '',
          statement: '',
        },
      ],
    });
  };

  const removeWitness = (index: number) => {
    setFormData({
      ...formData,
      witnesses: formData.witnesses.filter((_, i) => i !== index),
    });
  };

  const updateWitness = (index: number, field: keyof Witness, value: string) => {
    const updatedWitnesses = [...formData.witnesses];
    updatedWitnesses[index] = { ...updatedWitnesses[index], [field]: value };
    setFormData({ ...formData, witnesses: updatedWitnesses });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (formData.attachments_urls.length + files.length > 10) {
      showToast('Maximum 10 attachments allowed', 'error');
      return;
    }

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const publicUrl = await uploadToSupabase(file, 'warning-evidence');
        if (publicUrl) {
          uploadedUrls.push(publicUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData(prev => ({
          ...prev,
          attachments_urls: [...prev.attachments_urls, ...uploadedUrls]
        }));
        showToast(i18n.language === 'th' ? 'อัพโหลดไฟล์สำเร็จ' : 'Files uploaded successfully', 'success');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast(i18n.language === 'th' ? 'อัพโหลดไฟล์ล้มเหลว' : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments_urls: prev.attachments_urls.filter((_, i) => i !== index)
    }));
  };

  const isSuspension = formData.warning_type === 'SUSPENSION';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('warning.editWarningNotice')} - {warning.notice_number}
            </h2>
            {requiresReapproval && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {i18n.language === 'th'
                  ? 'หมายเหตุ: การแก้ไขใบเตือนที่รับทราบแล้วจะต้องได้รับการอนุมัติจาก HR อีกครั้ง'
                  : 'Note: Editing an acknowledged warning requires HR re-approval'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Employee Selection (Disabled in edit mode) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.employee')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.employee_id}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} - {i18n.language === 'th' ? emp.name_th : emp.name_en}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {i18n.language === 'th'
                ? 'ไม่สามารถเปลี่ยนพนักงานได้หลังจากสร้างใบเตือนแล้ว'
                : 'Employee cannot be changed after warning creation'}
            </p>
          </div>

          {/* Warning Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.warningType')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.warning_type}
              onChange={(e) => setFormData({ ...formData, warning_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              {WARNING_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {i18n.language === 'th' ? type.label_th : type.label_en}
                </option>
              ))}
            </select>
          </div>

          {/* Offense Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.offenseType')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.offense_type_id}
              onChange={(e) => setFormData({ ...formData, offense_type_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">{t('common.pleaseSelect')}</option>
              {offenseTypes.map((offense) => (
                <option key={offense.id} value={offense.id}>
                  {i18n.language === 'th' ? offense.name_th : offense.name_en} (Severity: {offense.severity_level})
                </option>
              ))}
            </select>
          </div>

          {/* Incident Date and Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('warning.incidentDate')} <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={formData.incident_date ? new Date(formData.incident_date) : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setFormData({ ...formData, incident_date: `${year}-${month}-${day}` });
                  } else {
                    setFormData({ ...formData, incident_date: '' });
                  }
                }}
                required
                placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('warning.incidentLocation')}
              </label>
              <input
                type="text"
                value={formData.incident_location}
                onChange={(e) => setFormData({ ...formData, incident_location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder={i18n.language === 'th' ? 'สถานที่เกิดเหตุ' : 'Incident location'}
              />
            </div>
          </div>

          {/* Incident Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.incidentDescription')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.incident_description}
              onChange={(e) => setFormData({ ...formData, incident_description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={i18n.language === 'th' ? 'รายละเอียดเหตุการณ์...' : 'Incident description...'}
              required
            />
          </div>

          {/* Penalty Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.penaltyDescription')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.penalty_description}
              onChange={(e) => setFormData({ ...formData, penalty_description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={i18n.language === 'th' ? 'บทลงโทษ...' : 'Penalty description...'}
              required
            />
          </div>

          {/* Suspension Details */}
          {isSuspension && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {i18n.language === 'th' ? 'รายละเอียดการพักงาน' : 'Suspension Details'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {i18n.language === 'th' ? 'จำนวนวัน' : 'Days'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.suspension_days}
                    onChange={(e) => setFormData({ ...formData, suspension_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {i18n.language === 'th' ? 'วันเริ่มต้น' : 'Start Date'}
                  </label>
                  <DatePicker
                    value={formData.suspension_start_date ? new Date(formData.suspension_start_date) : null}
                    onChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setFormData({ ...formData, suspension_start_date: `${year}-${month}-${day}` });
                      } else {
                        setFormData({ ...formData, suspension_start_date: '' });
                      }
                    }}
                    placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {i18n.language === 'th' ? 'วันสิ้นสุด' : 'End Date'}
                  </label>
                  <DatePicker
                    value={formData.suspension_end_date ? new Date(formData.suspension_end_date) : null}
                    onChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setFormData({ ...formData, suspension_end_date: `${year}-${month}-${day}` });
                      } else {
                        setFormData({ ...formData, suspension_end_date: '' });
                      }
                    }}
                    placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Effective Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.effectiveDate')} <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={formData.effective_date ? new Date(formData.effective_date) : null}
              onChange={(date) => {
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setFormData({ ...formData, effective_date: `${year}-${month}-${day}` });
                } else {
                  setFormData({ ...formData, effective_date: '' });
                }
              }}
              required
              placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
            />
          </div>


          {/* Evidence Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {i18n.language === 'th' ? 'หลักฐานแนบ (รูปภาพ/วิดีโอ)' : 'Evidence Attachments (Images/Videos)'}
            </label>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="warning-evidence-upload-edit"
                disabled={isUploading}
              />
              <label
                htmlFor="warning-evidence-upload-edit"
                className={`cursor-pointer flex flex-col items-center ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {isUploading
                    ? (i18n.language === 'th' ? 'กำลังอัพโหลด...' : 'Uploading...')
                    : (i18n.language === 'th' ? 'คลิกเพื่ออัพโหลดไฟล์' : 'Click to upload files')}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  JPG, PNG, MP4, WebM (Max 50MB)
                </span>
              </label>
            </div>

            {/* Attachment List */}
            {formData.attachments_urls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {formData.attachments_urls.map((url, index) => (
                  <div key={index} className="relative group aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {isImageFile(url) ? (
                      <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover" />
                    ) : isVideoFile(url) ? (
                      <div className="flex flex-col items-center justify-center w-full h-full text-gray-500">
                        <FileVideo className="w-8 h-8 mb-1" />
                        <span className="text-[10px] uppercase font-semibold">Video</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full text-gray-500">
                        <Paperclip className="w-8 h-8 mb-1" />
                        <span className="text-[10px]">File</span>
                      </div>
                    )}

                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      title="View"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Witnesses Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('warning.witnesses')}
              </label>
              <button
                type="button"
                onClick={addWitness}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                {i18n.language === 'th' ? 'เพิ่มพยาน' : 'Add Witness'}
              </button>
            </div>

            {formData.witnesses.map((witness, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {i18n.language === 'th' ? `พยาน ${index + 1}` : `Witness ${index + 1}`}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeWitness(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={witness.witness_name}
                    onChange={(e) => updateWitness(index, 'witness_name', e.target.value)}
                    placeholder={i18n.language === 'th' ? 'ชื่อพยาน' : 'Witness name'}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                  <input
                    type="text"
                    value={witness.witness_position}
                    onChange={(e) => updateWitness(index, 'witness_position', e.target.value)}
                    placeholder={i18n.language === 'th' ? 'ตำแหน่ง' : 'Position'}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <textarea
                  value={witness.statement}
                  onChange={(e) => updateWitness(index, 'statement', e.target.value)}
                  placeholder={i18n.language === 'th' ? 'คำให้การ' : 'Statement'}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
