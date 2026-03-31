// src/pages/WarningHistoryPage.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FileText, Calendar, User, Shield, RefreshCw, CheckCircle, XCircle, Clock, Settings, Paperclip, FileVideo, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import api from '../api/auth';
import { isImageFile, getFileNameFromUrl, isVideoFile } from '@/utils/supabaseUpload';

interface Warning {
  id: number;
  notice_number: string;
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
  issued_by_name: string;
  acknowledgement_status: string;
  attachments_urls?: string[];
}

const WARNING_TYPE_LABELS: Record<string, { th: string; en: string }> = {
  VERBAL: { th: 'ตักเตือนด้วยวาจา', en: 'Verbal Warning' },
  WRITTEN_1ST: { th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 1', en: 'Written Warning 1st' },
  WRITTEN_2ND: { th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 2', en: 'Written Warning 2nd' },
  FINAL_WARNING: { th: 'ตักเตือนครั้งสุดท้าย', en: 'Final Warning' },
  SUSPENSION: { th: 'พักงาน', en: 'Suspension' },
  TERMINATION: { th: 'เลิกจ้าง', en: 'Termination' },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_ACKNOWLEDGEMENT: 'bg-yellow-100 text-yellow-800',
  ACKNOWLEDGED: 'bg-green-100 text-green-800',
  REFUSED: 'bg-red-100 text-red-800',
  VOIDED: 'bg-gray-100 text-gray-600',
};

export function WarningHistoryPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'acknowledged'>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);

  // Check if user is HR or Admin
  const isHROrAdmin = user?.role === 'hr' || user?.role === 'admin';

  useEffect(() => {
    loadWarnings();
  }, []);

  const loadWarnings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await api.get('/warning-report', {
        params: { employee_id: user.id },
      });

      if (response.data.success) {
        const allWarnings = [
          ...(response.data.active_warnings || []),
          ...(response.data.inactive_warnings || []),
        ];
        setWarnings(allWarnings);
      }
    } catch (error: any) {
      console.error('Failed to load warnings:', error);
      showToast(
        error.response?.data?.message || t('warning.loadFailed'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Count warnings for each tab
  const allCount = warnings.length;
  const pendingCount = warnings.filter((w) => w.status === 'PENDING_ACKNOWLEDGMENT' || w.status === 'PENDING_ACKNOWLEDGEMENT').length;
  const acknowledgedCount = warnings.filter((w) => w.status === 'ACTIVE' || w.status === 'ACKNOWLEDGED').length;

  // Filter warnings based on active tab
  const filteredWarnings = warnings.filter((w) => {
    switch (activeTab) {
      case 'pending':
        return w.status === 'PENDING_ACKNOWLEDGMENT' || w.status === 'PENDING_ACKNOWLEDGEMENT';
      case 'acknowledged':
        return w.status === 'ACTIVE' || w.status === 'ACKNOWLEDGED';
      case 'all':
      default:
        return true;
    }
  });

  const handleViewDetails = (warning: Warning) => {
    setSelectedWarning(warning);
    setShowDetailModal(true);
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
                {t('warning.myWarningHistory')}
              </h1>
              <p className="text-blue-100 mt-2">
                {i18n.language === 'th'
                  ? 'ประวัติการรับใบเตือนทั้งหมดของคุณ'
                  : 'Your complete warning history'}
              </p>
            </div>

            {/* Management Button for HR/Admin */}
            {isHROrAdmin && (
              <button
                onClick={() => navigate('/warnings/management')}
                className="flex items-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition-all shadow-lg font-semibold"
              >
                <Settings className="w-5 h-5" />
                {i18n.language === 'th' ? 'จัดการใบเตือน' : 'Manage Warnings'}
              </button>
            )}
          </div>
        </div>

        {/* Statistics - Gradient Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">
                  {i18n.language === 'th' ? 'ใบเตือนทั้งหมด' : 'Total Warnings'}
                </p>
                <p className="text-4xl font-bold">{allCount}</p>
              </div>
              <FileText className="w-12 h-12 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-100 mb-1">
                  {i18n.language === 'th' ? 'รอการรับทราบ' : 'Pending'}
                </p>
                <p className="text-4xl font-bold">{pendingCount}</p>
              </div>
              <Clock className="w-12 h-12 opacity-30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">
                  {i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged'}
                </p>
                <p className="text-4xl font-bold">{acknowledgedCount}</p>
              </div>
              <CheckCircle className="w-12 h-12 opacity-30" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              {i18n.language === 'th' ? 'ทั้งหมด' : 'All'} ({allCount})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'pending'
                ? 'border-b-2 border-orange-500 text-orange-600 bg-orange-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              {i18n.language === 'th' ? 'รอรับทราบ' : 'Pending'} ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('acknowledged')}
              className={`px-6 py-4 font-medium transition-colors ${activeTab === 'acknowledged'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              {i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged'} ({acknowledgedCount})
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
                ? 'คุณยังไม่มีประวัติใบเตือน'
                : 'You have no warning history'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWarnings.map((warning) => (
              <div
                key={warning.id}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all cursor-pointer overflow-hidden"
                onClick={() => handleViewDetails(warning)}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">
                          {warning.notice_number}
                        </h3>
                        {/* Active/Inactive Badge - High Contrast */}
                        <span
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${warning.is_active
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                            }`}
                        >
                          {warning.is_active
                            ? i18n.language === 'th' ? 'ใช้งานอยู่' : 'ACTIVE'
                            : i18n.language === 'th' ? 'หมดอายุ' : 'INACTIVE'}
                        </span>
                        {/* Status Badge - High Contrast */}
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${warning.status === 'PENDING_ACKNOWLEDGEMENT' || warning.status === 'PENDING_ACKNOWLEDGMENT'
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                          : warning.status === 'ACKNOWLEDGED' || warning.status === 'ACTIVE'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                            : warning.status === 'REFUSED'
                              ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                          {warning.status === 'PENDING_ACKNOWLEDGEMENT' || warning.status === 'PENDING_ACKNOWLEDGMENT'
                            ? (i18n.language === 'th' ? 'รอรับทราบ' : 'PENDING')
                            : warning.status === 'ACKNOWLEDGED' || warning.status === 'ACTIVE'
                              ? (i18n.language === 'th' ? 'รับทราบแล้ว' : 'ACKNOWLEDGED')
                              : warning.status === 'REFUSED'
                                ? (i18n.language === 'th' ? 'ปฏิเสธ' : 'REFUSED')
                                : warning.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {i18n.language === 'th'
                          ? WARNING_TYPE_LABELS[warning.warning_type]?.th
                          : WARNING_TYPE_LABELS[warning.warning_type]?.en}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {warning.attachments_urls && warning.attachments_urls.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          <Paperclip className="w-4 h-4" />
                          <span>{warning.attachments_urls.length}</span>
                        </div>
                      )}
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                  </div>

                  {/* Basic Info - Modern Card Style */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-500">
                          {i18n.language === 'th' ? 'วันที่' : 'Date'}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {new Date(warning.incident_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US')}
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

                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-500">
                          {i18n.language === 'th' ? 'ประเภทความผิด' : 'Offense Type'}
                        </p>
                        <p className="font-semibold text-gray-900 truncate">
                          {i18n.language === 'th'
                            ? warning.offense_type_name_th
                            : warning.offense_type_name_en}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                    {warning.status === 'PENDING_ACKNOWLEDGEMENT' && (
                      <button
                        onClick={() => navigate(`/warning/${warning.id}`)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {i18n.language === 'th' ? 'รับทราบ' : 'Acknowledge'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warning Detail Modal */}
        {showDetailModal && selectedWarning && (
          <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {i18n.language === 'th' ? 'รายละเอียดใบเตือน' : 'Warning Details'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedWarning.notice_number}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Warning Type */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                    {i18n.language === 'th' ? 'ประเภทใบเตือน' : 'Warning Type'}
                  </p>
                  <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                    {i18n.language === 'th'
                      ? WARNING_TYPE_LABELS[selectedWarning.warning_type]?.th
                      : WARNING_TYPE_LABELS[selectedWarning.warning_type]?.en}
                  </p>
                </div>

                {/* Incident Details */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {i18n.language === 'th' ? 'รายละเอียดเหตุการณ์' : 'Incident Details'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        {i18n.language === 'th' ? 'วันที่เกิดเหตุ' : 'Incident Date'}
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(selectedWarning.incident_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        {i18n.language === 'th' ? 'ประเภทความผิด' : 'Offense Type'}
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {i18n.language === 'th'
                          ? selectedWarning.offense_type_name_th
                          : selectedWarning.offense_type_name_en}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      {i18n.language === 'th' ? 'รายละเอียดเหตุการณ์' : 'Incident Description'}
                    </label>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                      {selectedWarning.incident_description}
                    </p>
                  </div>
                </div>

                {/* Evidence Attachments */}
                {selectedWarning.attachments_urls && selectedWarning.attachments_urls.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Paperclip className="w-5 h-5" />
                      {i18n.language === 'th' ? 'หลักฐานแนบ' : 'Evidence Attachments'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {selectedWarning.attachments_urls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow block"
                        >
                          <div className="aspect-video flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden mb-2 relative">
                            {isImageFile(url) ? (
                              <img src={url} alt="Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            ) : isVideoFile(url) ? (
                              <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                <FileVideo className="w-8 h-8 mb-1" />
                                <span className="text-[10px] uppercase font-semibold">Video</span>
                              </div>
                            ) : (
                              <Paperclip className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            )}

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ExternalLink className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{getFileNameFromUrl(url)}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Penalty */}
                <div>
                  <h4 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">
                    {i18n.language === 'th' ? 'บทลงโทษ' : 'Penalty'}
                  </h4>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-900 dark:text-red-100 whitespace-pre-wrap">
                      {selectedWarning.penalty_description}
                    </p>
                  </div>
                </div>

                {/* Issuer Info */}
                <div className="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p>
                    {i18n.language === 'th' ? 'ออกโดย:' : 'Issued By:'} {selectedWarning.issued_by_name}
                  </p>
                  <p>
                    {i18n.language === 'th' ? 'วันที่ออกใบเตือน:' : 'Issue Date:'}{' '}
                    {new Date(selectedWarning.effective_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US')}
                  </p>
                  {selectedWarning.expiry_date && (
                    <p>
                      {i18n.language === 'th' ? 'วันหมดอายุ:' : 'Expiry Date:'}{' '}
                      {new Date(selectedWarning.expiry_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US')}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {i18n.language === 'th' ? 'ปิด' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

