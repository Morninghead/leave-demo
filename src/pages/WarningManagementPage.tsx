// src/pages/WarningManagementPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Calendar,
  User,
  Shield,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Search,
  PenTool,
  CheckCircle,
  Paperclip,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import api from '../api/auth';
import { WarningNoticeCreateForm } from '../components/warning/WarningNoticeCreateForm';
import { WarningNoticeEditForm } from '../components/warning/WarningNoticeEditForm';
import { WarningDetailModal } from '../components/warnings/WarningDetailModal';
import { ManagerWitnessForm } from '../components/warnings/ManagerWitnessForm';

interface Warning {
  id: number;
  notice_number: string;
  employee_name: string;
  employee_code: string;
  warning_type: string;
  offense_type_name_th: string;
  offense_type_name_en: string;
  incident_date: string;
  incident_description: string;
  penalty_description: string;
  effective_date: string;
  expiry_date: string;
  is_active: boolean;
  status: string;
  issued_by: number;
  issued_by_name: string;
  employee_id: number;
  offense_type_id: number;
  incident_location: string;
  suspension_days: number;
  suspension_start_date: string;
  suspension_end_date: string;
  created_at: string;
  attachments_urls?: string[];
  // Signature/Acknowledgement fields
  signature_data?: string;
  signature_timestamp?: string;
  signature_ip?: string;
  acknowledged_at?: string;
  refuse_reason?: string;
  signature_refused?: boolean;
}

const WARNING_TYPE_LABELS: Record<string, { th: string; en: string; color: string }> = {
  VERBAL: { th: 'วาจา', en: 'Verbal', color: 'bg-blue-100 text-blue-800' },
  WRITTEN_1ST: { th: 'ลายลักษณ์ 1', en: 'Written 1st', color: 'bg-yellow-100 text-yellow-800' },
  WRITTEN_2ND: { th: 'ลายลักษณ์ 2', en: 'Written 2nd', color: 'bg-orange-100 text-orange-800' },
  FINAL_WARNING: { th: 'สุดท้าย', en: 'Final', color: 'bg-red-100 text-red-800' },
  SUSPENSION: { th: 'พักงาน', en: 'Suspension', color: 'bg-purple-100 text-purple-800' },
  TERMINATION: { th: 'เลิกจ้าง', en: 'Termination', color: 'bg-gray-900 text-white' },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_ACKNOWLEDGMENT: 'bg-yellow-100 text-yellow-800', // No 'E' - matches DB
  PENDING_ACKNOWLEDGEMENT: 'bg-yellow-100 text-yellow-800', // With 'E' - legacy support
  ACTIVE: 'bg-green-100 text-green-800', // Legacy
  ACKNOWLEDGED: 'bg-green-100 text-green-800',
  REFUSED: 'bg-red-100 text-red-800', // Legacy
  SIGNATURE_REFUSED: 'bg-red-100 text-red-800',
  VOIDED: 'bg-gray-100 text-gray-600',
  APPEALED: 'bg-purple-100 text-purple-800', // Employee appealed
};

// Format date as DD/MM/YYYY
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export function WarningManagementPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [filteredWarnings, setFilteredWarnings] = useState<Warning[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWarning, setEditingWarning] = useState<Warning | null>(null);
  const [viewingWarning, setViewingWarning] = useState<Warning | null>(null);
  const [witnessingWarning, setWitnessingWarning] = useState<Warning | null>(null);
  const [activeTab, setActiveTab] = useState('all'); // all, pending, acknowledged, voided

  const loadWarnings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/warning-notice-list');

      if (response.data.success) {
        setWarnings(response.data.data || []);
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || t('warning.loadFailed'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  const applyFilters = useCallback(() => {
    let filtered = [...warnings];

    // Search filter - includes notice number, employee name, employee code, employee ID, offense type
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.notice_number.toLowerCase().includes(term) ||
          w.employee_name.toLowerCase().includes(term) ||
          (w.employee_code && w.employee_code.toLowerCase().includes(term)) ||
          String(w.employee_id).includes(term) ||
          (i18n.language === 'th'
            ? w.offense_type_name_th.toLowerCase().includes(term)
            : w.offense_type_name_en.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((w) => w.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((w) => w.warning_type === typeFilter);
    }

    // Tab filter
    if (activeTab === 'pending') {
      // Support both spellings of PENDING_ACKNOWLEDGMENT (with and without 'E')
      filtered = filtered.filter((w) =>
        w.status === 'PENDING_ACKNOWLEDGMENT' || w.status === 'PENDING_ACKNOWLEDGEMENT'
      );
    } else if (activeTab === 'acknowledged') {
      // ACTIVE = acknowledged in the database
      filtered = filtered.filter((w) => w.status === 'ACTIVE' || w.status === 'ACKNOWLEDGED');
    } else if (activeTab === 'refused') {
      // Warnings that employee refused to sign
      filtered = filtered.filter((w) => w.status === 'REFUSED' || w.status === 'SIGNATURE_REFUSED');
    } else if (activeTab === 'voided') {
      filtered = filtered.filter((w) => w.status === 'VOIDED');
    }

    setFilteredWarnings(filtered);
  }, [warnings, searchTerm, statusFilter, typeFilter, activeTab, i18n.language]);

  useEffect(() => {
    loadWarnings();
  }, [loadWarnings]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleDelete = async (warning: Warning) => {
    // Step 1: Get void reason from user (REQUIRED for legal/audit purposes)
    const voidReason = await new Promise<string | null>((resolve) => {
      // Create modal content safely using React createElement instead of innerHTML
      const modalContent = document.createElement('div');
      const spaceDiv = document.createElement('div');
      spaceDiv.className = 'space-y-4';

      // Warning message paragraph
      const warningP = document.createElement('p');
      warningP.className = 'text-sm text-gray-600 dark:text-gray-400';
      warningP.textContent = i18n.language === 'th'
        ? '⚠️ การยกเลิกใบเตือนต้องระบุเหตุผลเพื่อเป็นหลักฐานทางกฎหมาย'
        : '⚠️ Voiding a warning requires a reason for legal and audit purposes';

      // Form container
      const formDiv = document.createElement('div');

      // Label
      const label = document.createElement('label');
      label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
      label.textContent = i18n.language === 'th' ? 'เหตุผลในการยกเลิก *' : 'Void Reason *';

      // Textarea
      const textarea = document.createElement('textarea');
      textarea.id = 'void-reason-input';
      textarea.className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white min-h-[100px]';
      textarea.placeholder = i18n.language === 'th'
        ? 'กรุณาระบุเหตุผลที่ชัดเจน (อย่างน้อย 10 ตัวอักษร)'
        : 'Please provide a clear reason (minimum 10 characters)';

      // Helper text
      const helperP = document.createElement('p');
      helperP.className = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
      helperP.textContent = i18n.language === 'th'
        ? 'เหตุผลนี้จะถูกบันทึกในระบบ audit และไม่สามารถแก้ไขได้ในภายหลัง'
        : 'This reason will be recorded in the audit log and cannot be modified later';

      formDiv.appendChild(label);
      formDiv.appendChild(textarea);
      formDiv.appendChild(helperP);

      spaceDiv.appendChild(warningP);
      spaceDiv.appendChild(formDiv);

      modalContent.appendChild(spaceDiv);

      showModal(
        'confirm',
        i18n.language === 'th' ? 'ยกเลิกใบเตือน' : 'Void Warning',
        {
          message: '',
          customContent: modalContent,
          confirmText: i18n.language === 'th' ? 'ยืนยันการยกเลิก' : 'Confirm Void',
          cancelText: i18n.language === 'th' ? 'ยกเลิก' : 'Cancel',
          onConfirm: () => {
            const input = document.getElementById('void-reason-input') as HTMLTextAreaElement;
            const value = input?.value?.trim() || '';

            if (!value) {
              showToast(
                i18n.language === 'th' ? 'กรุณาระบุเหตุผลในการยกเลิก' : 'Please provide a void reason',
                'error'
              );
              resolve(null);
              return;
            }

            if (value.length < 10) {
              showToast(
                i18n.language === 'th'
                  ? 'เหตุผลต้องมีความยาวอย่างน้อย 10 ตัวอักษร'
                  : 'Reason must be at least 10 characters long',
                'error'
              );
              resolve(null);
              return;
            }

            resolve(value);
          },
          onCancel: () => resolve(null),
        }
      );
    });

    if (!voidReason) return;

    // Step 2: Confirm the void action
    const confirmed = await new Promise<boolean>((resolve) => {
      showModal(
        'confirm',
        i18n.language === 'th' ? 'ยืนยันการยกเลิกใบเตือน' : 'Confirm Void Warning',
        {
          message:
            i18n.language === 'th'
              ? `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบเตือน ${warning.notice_number}?\n\nเหตุผล: ${voidReason}`
              : `Are you sure you want to void warning ${warning.notice_number}?\n\nReason: ${voidReason}`,
          confirmText: i18n.language === 'th' ? 'ยืนยัน' : 'Confirm',
          cancelText: i18n.language === 'th' ? 'ยกเลิก' : 'Cancel',
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        }
      );
    });

    if (!confirmed) return;

    try {
      // Debug: Check if warning ID exists
      if (!warning.id) {
        showToast(
          i18n.language === 'th' ? 'ไม่พบรหัสใบเตือน' : 'Warning ID not found',
          'error'
        );
        console.error('Warning object missing ID:', warning);
        return;
      }

      console.log('Voiding warning with ID:', warning.id, 'Reason:', voidReason);

      // Send DELETE request with reason in body
      const response = await api.delete(
        `/warning-notice-delete?warning_id=${warning.id}`,
        {
          data: {
            reason: voidReason
          }
        }
      );

      if (response.data.success) {
        showToast(
          i18n.language === 'th' ? 'ยกเลิกใบเตือนสำเร็จ' : 'Warning voided successfully',
          'success'
        );
        loadWarnings();
      }
    } catch (error: any) {
      console.error('Void warning error:', error);
      console.error('Error response:', error.response?.data);
      showToast(
        error.response?.data?.message ||
        (i18n.language === 'th' ? 'ไม่สามารถยกเลิกใบเตือนได้' : 'Failed to void warning'),
        'error'
      );
    }
  };

  // Managers can only VIEW, not edit/delete
  // Only HR and Admin can edit/delete
  const isHROrAdmin = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'dev';

  const canEdit = (_warning: Warning) => {
    // Only HR and Admin can edit warnings
    return isHROrAdmin;
  };

  const canDelete = (_warning: Warning) => {
    // Only HR and Admin can void/delete warnings
    // Managers can only view
    return isHROrAdmin;
  };

  const canForceClose = (warning: Warning) => {
    // HR, Admin, or the Issuer can force close pending warnings
    const userId = user?.id; // Fixed: user?.id is string, warning.issued_by might be number
    const isIssuer = userId && String(warning.issued_by) === String(userId);
    return (isHROrAdmin || isIssuer) && (warning.status === 'PENDING_ACKNOWLEDGMENT' || warning.status === 'PENDING_ACKNOWLEDGEMENT');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <span className="text-gray-600">{t('common.loading')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header - Vibrant Gradient */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="w-8 h-8" />
                {i18n.language === 'th' ? 'จัดการใบเตือน' : 'Warning Management'}
              </h1>
              <p className="text-blue-100 mt-2">
                {i18n.language === 'th'
                  ? 'จัดการใบเตือนทั้งหมดในระบบ'
                  : 'Manage all warnings in the system'}
              </p>
            </div>
            {/* Only HR and Admin can create warnings */}
            {isHROrAdmin && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition-all shadow-lg font-semibold"
              >
                <Plus className="w-5 h-5" />
                {i18n.language === 'th' ? 'สร้างใบเตือน' : 'Create Warning'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === 'all'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {i18n.language === 'th' ? 'ทั้งหมด' : 'All Warnings'}
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {i18n.language === 'th' ? 'รอรับทราบ' : 'Pending'}
                <span className="ml-2 px-2.5 py-1 text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full font-semibold">
                  {warnings.filter(w => w.status === 'PENDING_ACKNOWLEDGMENT' || w.status === 'PENDING_ACKNOWLEDGEMENT').length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('acknowledged')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === 'acknowledged'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged'}
                <span className="ml-2 px-2.5 py-1 text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full font-semibold">
                  {warnings.filter(w => w.status === 'ACTIVE' || w.status === 'ACKNOWLEDGED').length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('refused')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === 'refused'
                  ? 'border-red-500 text-red-600 bg-red-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {i18n.language === 'th' ? 'ปฏิเสธเซ็น' : 'Refused'}
                <span className="ml-2 px-2.5 py-1 text-xs bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-full font-semibold">
                  {warnings.filter(w => w.status === 'REFUSED' || w.status === 'SIGNATURE_REFUSED').length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('voided')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === 'voided'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {i18n.language === 'th' ? 'ยกเลิก' : 'Voided'}
                <span className="ml-2 px-2.5 py-1 text-xs bg-gray-500 text-white rounded-full font-semibold">
                  {warnings.filter(w => w.status === 'VOIDED').length}
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  i18n.language === 'th'
                    ? 'ค้นหาเลขที่, พนักงาน, ประเภทความผิด...'
                    : 'Search number, employee, offense type...'
                }
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="all">{i18n.language === 'th' ? 'สถานะทั้งหมด' : 'All Status'}</option>
                <option value="DRAFT">{i18n.language === 'th' ? 'ฉบับร่าง' : 'Draft'}</option>
                <option value="PENDING_ACKNOWLEDGEMENT">
                  {i18n.language === 'th' ? 'รอรับทราบ' : 'Pending Acknowledgement'}
                </option>
                <option value="ACKNOWLEDGED">{i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged'}</option>
                <option value="REFUSED">{i18n.language === 'th' ? 'ปฏิเสธ' : 'Refused'}</option>
                <option value="VOIDED">{i18n.language === 'th' ? 'ยกเลิก' : 'Voided'}</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="all">{i18n.language === 'th' ? 'ประเภททั้งหมด' : 'All Types'}</option>
                <option value="VERBAL">{WARNING_TYPE_LABELS.VERBAL[i18n.language === 'th' ? 'th' : 'en']}</option>
                <option value="WRITTEN_1ST">
                  {WARNING_TYPE_LABELS.WRITTEN_1ST[i18n.language === 'th' ? 'th' : 'en']}
                </option>
                <option value="WRITTEN_2ND">
                  {WARNING_TYPE_LABELS.WRITTEN_2ND[i18n.language === 'th' ? 'th' : 'en']}
                </option>
                <option value="FINAL_WARNING">
                  {WARNING_TYPE_LABELS.FINAL_WARNING[i18n.language === 'th' ? 'th' : 'en']}
                </option>
                <option value="SUSPENSION">
                  {WARNING_TYPE_LABELS.SUSPENSION[i18n.language === 'th' ? 'th' : 'en']}
                </option>
                <option value="TERMINATION">
                  {WARNING_TYPE_LABELS.TERMINATION[i18n.language === 'th' ? 'th' : 'en']}
                </option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {i18n.language === 'th'
                ? `แสดง ${filteredWarnings.length} จาก ${warnings.length} รายการ`
                : `Showing ${filteredWarnings.length} of ${warnings.length} warnings`}
            </p>
            <button
              onClick={loadWarnings}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {i18n.language === 'th' ? 'รีเฟรช' : 'Refresh'}
            </button>
          </div>
        </div>


        {/* Warnings List */}
        {filteredWarnings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {i18n.language === 'th' ? 'ไม่พบข้อมูลใบเตือน' : 'No warnings found'}
            </h3>
            <p className="text-gray-500">
              {i18n.language === 'th'
                ? 'ลองปรับการค้นหาหรือเปลี่ยนตัวกรอง'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWarnings.map((warning) => (
              <div
                key={warning.id}
                onClick={() => setViewingWarning(warning)}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all overflow-hidden cursor-pointer"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">
                          {warning.notice_number}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${WARNING_TYPE_LABELS[warning.warning_type]?.color}`}>
                          {WARNING_TYPE_LABELS[warning.warning_type]?.[i18n.language === 'th' ? 'th' : 'en']}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[warning.status]}`}>
                          {warning.status === 'ACTIVE' || warning.status === 'ACKNOWLEDGED' ? (i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged') :
                            warning.status === 'PENDING_ACKNOWLEDGMENT' ? (i18n.language === 'th' ? 'รอรับทราบ' : 'Pending') :
                              warning.status === 'SIGNATURE_REFUSED' || warning.status === 'REFUSED' ? (i18n.language === 'th' ? 'ปฏิเสธเซ็น' : 'Refused') :
                                warning.status}
                        </span>
                        {!warning.is_active && warning.status !== 'VOIDED' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            {i18n.language === 'th' ? 'หมดอายุ' : 'Inactive'}
                          </span>
                        )}
                        {/* Signature status badge - only show if signature exists (new system) */}
                        {warning.status === 'ACTIVE' && warning.signature_data && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <PenTool className="w-3 h-3" />
                            {i18n.language === 'th' ? 'เซ็นชื่อแล้ว' : 'Signed'}
                          </span>
                        )}
                        {/* Attachments indicator */}
                        {warning.attachments_urls && warning.attachments_urls.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Paperclip className="w-3 h-3" />
                            {warning.attachments_urls.length}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        <User className="inline w-4 h-4 mr-1" />
                        {warning.employee_name} • {i18n.language === 'th' ? warning.offense_type_name_th : warning.offense_type_name_en}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {/* Force Close Button */}
                      {canForceClose(warning) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setWitnessingWarning(warning);
                          }}
                          className="p-2.5 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                          title={i18n.language === 'th' ? 'บันทึกการปฏิเสธ / ปิดงาน' : 'Force Close / Record Refusal'}
                        >
                          <Shield className="w-5 h-5" />
                        </button>
                      )}

                      {canEdit(warning) && warning.status !== 'VOIDED' && (
                        <button
                          onClick={() => setEditingWarning(warning)}
                          className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title={i18n.language === 'th' ? 'แก้ไข' : 'Edit'}
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      {canDelete(warning) && warning.status !== 'VOIDED' && (
                        <button
                          onClick={() => handleDelete(warning)}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title={i18n.language === 'th' ? 'ยกเลิกใบเตือน' : 'Void Warning'}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-500">
                          {i18n.language === 'th' ? 'วันที่เกิดเหตุ' : 'Incident Date'}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(warning.incident_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-500">
                          {i18n.language === 'th' ? 'วันที่มีผล' : 'Effective Date'}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(warning.effective_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-500">
                          {i18n.language === 'th' ? 'ออกโดย' : 'Issued By'}
                        </p>
                        <p className="font-semibold text-gray-900">{warning.issued_by_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Incident Description */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {i18n.language === 'th' ? 'รายละเอียดเหตุการณ์' : 'Incident Description'}
                    </p>
                    <p className="text-sm text-gray-800 line-clamp-2">
                      {warning.incident_description}
                    </p>
                  </div>

                  {/* Signature Display - Only show for acknowledged warnings */}
                  {warning.status === 'ACKNOWLEDGED' && (
                    <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <PenTool className="w-4 h-4 text-green-600" />
                          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                            {i18n.language === 'th' ? 'ลายเซ็นพนักงาน' : 'Employee Signature'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          <span>{i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged'}</span>
                        </div>
                      </div>

                      {warning.signature_data ? (
                        <div className="bg-white rounded-lg p-3 border border-green-100">
                          {warning.signature_data.startsWith('http') || warning.signature_data.startsWith('data:image') ? (
                            <img
                              src={warning.signature_data}
                              alt="Employee Signature"
                              className="max-h-24 mx-auto object-contain"
                            />
                          ) : (
                            <p className="text-center text-lg font-signature text-gray-800 italic">
                              {warning.signature_data}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic text-center">
                          {i18n.language === 'th' ? 'ไม่มีลายเซ็น' : 'No signature available'}
                        </p>
                      )}

                      {warning.signature_timestamp && (
                        <p className="text-xs text-green-600 mt-2 text-center">
                          {i18n.language === 'th' ? 'ลงนามเมื่อ: ' : 'Signed at: '}
                          {new Date(warning.signature_timestamp).toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-US')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Form Modal */}
        {showCreateForm && (
          <WarningNoticeCreateForm
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              loadWarnings();
            }}
          />
        )}

        {/* Edit Form Modal */}
        {editingWarning && (
          <WarningNoticeEditForm
            warning={editingWarning}
            onClose={() => setEditingWarning(null)}
            onSuccess={() => {
              setEditingWarning(null);
              loadWarnings();
            }}
          />
        )}

        {/* View Detail Modal */}
        {viewingWarning && (
          <WarningDetailModal
            warning={viewingWarning}
            onClose={() => setViewingWarning(null)}
          />
        )}

        {/* Manager Witness / Force Close Form */}
        {witnessingWarning && (
          <ManagerWitnessForm
            warning={witnessingWarning}
            isOpen={true}
            onClose={() => setWitnessingWarning(null)}
            onSuccess={() => {
              setWitnessingWarning(null);
              loadWarnings();
            }}
          />
        )}
      </div>
    </div>
  );
}

