// src/components/warning/WarningNoticeCreateForm.tsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X, AlertCircle, Plus, Trash2, Search, Paperclip, Image as ImageIcon, FileVideo, Loader2 } from 'lucide-react';
import { uploadToSupabase, isImageFile, getFileNameFromUrl } from '../../utils/supabaseUpload';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';
import { DatePicker } from '../../components/common/DatePicker';

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
  witness_employee_id?: number;
  witness_name: string;
  witness_position: string;
  statement: string;
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
  attachments_urls: string[];
  witnesses: Witness[];
}

const WARNING_TYPES = [
  { value: 'VERBAL', label_th: 'ตักเตือนด้วยวาจา', label_en: 'Verbal Warning' },
  { value: 'WRITTEN_1ST', label_th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 1', label_en: 'Written Warning 1st' },
  { value: 'WRITTEN_2ND', label_th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 2', label_en: 'Written Warning 2nd' },
  { value: 'FINAL_WARNING', label_th: 'ตักเตือนครั้งสุดท้าย', label_en: 'Final Warning' },
  { value: 'SUSPENSION', label_th: 'พักงาน', label_en: 'Suspension' },
  { value: 'TERMINATION', label_th: 'เลิกจ้าง', label_en: 'Termination' },
];

export function WarningNoticeCreateForm({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offenseTypes, setOffenseTypes] = useState<OffenseType[]>([]);

  // Employee search states
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<WarningFormData>({
    employee_id: '',
    warning_type: 'VERBAL',
    offense_type_id: '',
    incident_date: new Date().toISOString().split('T')[0],
    incident_description: '',
    incident_location: '',
    penalty_description: '',
    suspension_days: 0,
    suspension_start_date: '',
    suspension_end_date: '',
    effective_date: new Date().toISOString().split('T')[0],
    attachments_urls: [],
    witnesses: [],
  });

  useEffect(() => {
    loadEmployees();
    loadOffenseTypes();
  }, []);

  // Filter employees based on search term
  useEffect(() => {
    if (employeeSearchTerm.trim() === '') {
      setFilteredEmployees(employees.slice(0, 20)); // Limit to first 20 for performance
    } else {
      const searchLower = employeeSearchTerm.toLowerCase();
      const filtered = employees.filter(emp =>
        emp.employee_code.toLowerCase().includes(searchLower) ||
        emp.name_th.toLowerCase().includes(searchLower) ||
        emp.name_en.toLowerCase().includes(searchLower)
      ).slice(0, 20); // Limit results for performance
      setFilteredEmployees(filtered);
    }
  }, [employeeSearchTerm, employees]);

  const loadEmployees = async () => {
    try {
      // Use existing employees endpoint with status=active filter
      const response = await api.get('/employees?status=active');

      if (response.data.success) {
        const employeeData = response.data.data || [];
        setEmployees(employeeData);
      } else {
        showToast(
          i18n.language === 'th' ? 'ไม่สามารถโหลดข้อมูลพนักงานได้' : 'Failed to load employees',
          'error'
        );
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || (i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน' : 'Error loading employees'),
        'error'
      );
    }
  };

  const loadOffenseTypes = async () => {
    try {
      const response = await api.get('/offense-types');

      if (response.data.success) {
        const offenseData = response.data.data || [];
        setOffenseTypes(offenseData);
      } else {
        showToast(
          i18n.language === 'th' ? 'ไม่สามารถโหลดประเภทความผิดได้' : 'Failed to load offense types',
          'error'
        );
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || (i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการโหลดประเภทความผิด' : 'Error loading offense types'),
        'error'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_id || !formData.offense_type_id) {
      showToast(
        i18n.language === 'th' ? 'กรุณาเลือกพนักงานและประเภทความผิด' : 'Please select employee and offense type',
        'warning'
      );
      return;
    }

    if (!formData.incident_description || !formData.penalty_description) {
      showToast(t('warning.pleaseFillRequired'), 'warning');
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
      };

      // Temporary detailed logging
      console.log('🚀 Submitting warning creation:', {
        warning_type: submitData.warning_type,
        employee_id: submitData.employee_id,
        offense_type_id: submitData.offense_type_id,
        has_descriptions: !!(submitData.incident_description && submitData.penalty_description),
        dates: {
          incident: submitData.incident_date,
          effective: submitData.effective_date,
          suspension_start: submitData.suspension_start_date,
          suspension_end: submitData.suspension_end_date,
        },
        suspension_days: submitData.suspension_days,
      });

      const response = await api.post('/warning-notice-create', submitData);

      if (response.data.success) {
        console.log('✅ Warning created successfully:', response.data);
        showToast(
          i18n.language === 'th'
            ? 'สร้างใบเตือนสำเร็จ'
            : 'Warning notice created successfully',
          'success'
        );
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      // Detailed error logging
      console.error('❌ Warning creation failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorMessage: error.response?.data?.message,
        errorData: error.response?.data,
        fullError: error,
      });

      const errorMessage = error.response?.data?.message || t('warning.createFailed');
      showToast(errorMessage, 'error');
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

  // Upload Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const files = Array.from(e.target.files);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        // Validation handled by uploadToSupabase (50MB limit, types)
        // Ensure bucket 'warning-evidence' exists (created by admin migration/verification)
        const url = await uploadToSupabase(file, 'warning-evidence');
        uploadedUrls.push(url);
      }

      setFormData(prev => ({
        ...prev,
        attachments_urls: [...prev.attachments_urls, ...uploadedUrls]
      }));

      showToast(
        i18n.language === 'th' ? 'อัปโหลดไฟล์สำเร็จ' : 'Files uploaded successfully',
        'success'
      );
    } catch (error: any) {
      console.error('Upload failed:', error);
      showToast(error.message || (i18n.language === 'th' ? 'อัปโหลดล้มเหลว' : 'Upload failed'), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input
      }
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      attachments_urls: prev.attachments_urls.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Helper to check if file is video
  const isVideoFile = (url: string) => /\.(mp4|webm|mov|quicktime)$/i.test(url);

  // Employee search handlers
  const handleEmployeeSearch = (value: string) => {
    setEmployeeSearchTerm(value);
    setShowEmployeeDropdown(true);
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeSearchTerm(`${employee.employee_code} - ${i18n.language === 'th' ? employee.name_th : employee.name_en}`);
    setFormData({ ...formData, employee_id: employee.id.toString() });
    setShowEmployeeDropdown(false);
  };

  const handleEmployeeInputFocus = () => {
    setShowEmployeeDropdown(true);
    if (searchInputRef.current) {
      searchInputRef.current.select();
    }
  };

  const handleEmployeeInputBlur = () => {
    // Delay hiding dropdown to allow clicking on options
    setTimeout(() => setShowEmployeeDropdown(false), 200);
  };

  const handleEmployeeClear = () => {
    setSelectedEmployee(null);
    setEmployeeSearchTerm('');
    setFormData({ ...formData, employee_id: '' });
    searchInputRef.current?.focus();
  };

  const isSuspension = formData.warning_type === 'SUSPENSION';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('warning.createWarningNotice')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('warning.employee')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={employeeSearchTerm}
                  onChange={(e) => handleEmployeeSearch(e.target.value)}
                  onFocus={handleEmployeeInputFocus}
                  onBlur={handleEmployeeInputBlur}
                  placeholder={i18n.language === 'th' ? 'ค้นหาพนักงานด้วยรหัสหรือชื่อ...' : 'Search employee by code or name...'}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                {employeeSearchTerm && (
                  <button
                    type="button"
                    onClick={handleEmployeeClear}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dropdown Results */}
              {showEmployeeDropdown && filteredEmployees.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleEmployeeSelect(emp)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {emp.employee_code}
                          </span>
                          <span className="mx-2 text-gray-500">-</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {i18n.language === 'th' ? emp.name_th : emp.name_en}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {i18n.language === 'th' && emp.name_en ? emp.name_en : ''}
                          {i18n.language === 'en' && emp.name_th ? emp.name_th : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results Message */}
              {showEmployeeDropdown && employeeSearchTerm && filteredEmployees.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3">
                  <p className="text-gray-500 dark:text-gray-400 text-center">
                    {i18n.language === 'th' ? 'ไม่พบพนักงานที่ตรงกับการค้นหา' : 'No employees found matching your search'}
                  </p>
                </div>
              )}
            </div>
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

          {/* Evidence Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {i18n.language === 'th' ? 'หลักฐานแนบ (รูปภาพ/วิดีโอ - สูงสุด 50MB)' : 'Evidence Attachments (Images/Videos - Max 50MB)'}
            </label>

            <div className="space-y-4">
              {/* File List */}
              {formData.attachments_urls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {formData.attachments_urls.map((url, index) => (
                    <div key={index} className="relative group border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
                      <div className="aspect-video flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden mb-2">
                        {isImageFile(url) ? (
                          <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                        ) : isVideoFile(url) ? (
                          <div className="text-gray-500 flex flex-col items-center">
                            <FileVideo className="w-8 h-8 mb-1" />
                            <span className="text-xs">Video</span>
                          </div>
                        ) : (
                          <Paperclip className="w-8 h-8 text-gray-400" />
                        )}
                      </div>

                      <div className="text-xs text-gray-500 truncate px-1">
                        {getFileNameFromUrl(url)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="evidence-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="evidence-upload"
                  className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">
                    {uploading
                      ? (i18n.language === 'th' ? 'กำลังอัปโหลด...' : 'Uploading...')
                      : (i18n.language === 'th' ? 'เพิ่มไฟล์หลักฐาน' : 'Add Evidence Files')}
                  </span>
                </label>
                <div className="text-xs text-gray-500">
                  {i18n.language === 'th'
                    ? 'รองรับไฟล์ JPG, PNG, MP4 (วิดีโอ)'
                    : 'Supports JPG, PNG, MP4 (Video)'}
                </div>
              </div>
            </div>
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
