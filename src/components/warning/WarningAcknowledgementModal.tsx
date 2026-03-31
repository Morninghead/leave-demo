import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, FileText, X, CheckCircle, XCircle, FileVideo, Paperclip, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import { isImageFile, getFileNameFromUrl, isVideoFile } from '../../utils/supabaseUpload';
import { useScrollTracker } from '../../hooks/useScrollTracker';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';

interface WarningNotice {
  id: number;
  notice_number: string;
  warning_type: string;
  incident_date: string;
  incident_description: string;
  incident_location?: string;
  penalty_description: string;
  suspension_days?: number;
  suspension_start_date?: string;
  suspension_end_date?: string;
  effective_date: string;
  expiry_date: string;
  attachments_urls?: string[];
  offense_name_th?: string;
  offense_name_en?: string;
  issuer_first_name_th?: string;
  issuer_last_name_th?: string;
}

interface WarningAcknowledgementModalProps {
  warning: WarningNotice | null;
  isOpen: boolean;
  onClose: () => void;
}

const WARNING_TYPE_LABELS = {
  VERBAL: { th: 'คำเตือนด้วยวาจา', en: 'Verbal Warning', color: 'yellow' },
  WRITTEN_1ST: { th: 'คำเตือนเป็นลายลักษณ์อักษรครั้งที่ 1', en: 'Written Warning 1st', color: 'orange' },
  WRITTEN_2ND: { th: 'คำเตือนเป็นลายลักษณ์อักษรครั้งที่ 2', en: 'Written Warning 2nd', color: 'orange' },
  FINAL_WARNING: { th: 'คำเตือนครั้งสุดท้าย', en: 'Final Written Warning', color: 'red' },
  SUSPENSION: { th: 'ภาคทัณฑ์/พักงาน', en: 'Suspension', color: 'red' },
  TERMINATION: { th: 'เลิกจ้าง', en: 'Termination', color: 'red' },
};

export function WarningAcknowledgementModal({ warning, isOpen, onClose }: WarningAcknowledgementModalProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [actionMode, setActionMode] = useState<'acknowledge' | 'refuse' | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState('');
  const [employeeComment, setEmployeeComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const {
    scrollPercentage,
    isScrollComplete,
    timeSpentSeconds,
    containerRef,
    resetTracking,
  } = useScrollTracker({
    threshold: 100,
    debounceMs: 200,
  });

  useEffect(() => {
    if (isOpen && warning) {
      resetTracking();
      setActionMode(null);
      setSignatureData(null);
      setRefuseReason('');
      setEmployeeComment('');
      setAcceptTerms(false);
      setIsSubmitting(false);
    }
  }, [isOpen, warning, resetTracking]);

  if (!isOpen || !warning) return null;

  const warningTypeInfo = WARNING_TYPE_LABELS[warning.warning_type as keyof typeof WARNING_TYPE_LABELS] || WARNING_TYPE_LABELS.VERBAL;
  const lang = i18n.language;

  const handleAcknowledge = async () => {
    if (!isScrollComplete) {
      showToast(t('warning.mustReadCompletely'), 'warning');
      return;
    }

    if (!acceptTerms) {
      showToast(t('warning.mustAcceptTerms'), 'warning');
      return;
    }

    if (!signatureData) {
      showToast(t('warning.signatureRequired'), 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/warning-acknowledge', {
        warning_notice_id: warning.id,
        action_type: 'ACKNOWLEDGED',
        scroll_completed: isScrollComplete,
        scroll_percentage: scrollPercentage,
        time_spent_seconds: timeSpentSeconds,
        signature_data: signatureData,
        employee_comment: employeeComment || null,
      });

      if (response.data.success) {
        showToast(t('warning.acknowledgedSuccess'), 'success');
        onClose();
      } else {
        showToast(response.data.message || t('warning.acknowledgeFailed'), 'error');
      }
    } catch (error: any) {
      console.error('Acknowledge error:', error);
      showToast(error.response?.data?.message || t('warning.acknowledgeFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefuse = async () => {
    if (!refuseReason) {
      showToast(t('warning.refuseReasonRequired'), 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/warning-acknowledge', {
        warning_notice_id: warning.id,
        action_type: 'REFUSED',
        scroll_completed: isScrollComplete,
        scroll_percentage: scrollPercentage,
        time_spent_seconds: timeSpentSeconds,
        refuse_reason: refuseReason,
        employee_comment: employeeComment || null,
      });

      if (response.data.success) {
        showToast(t('warning.refusedSuccess'), 'success');
        onClose();
      } else {
        showToast(response.data.message || t('warning.refuseFailed'), 'error');
      }
    } catch (error: any) {
      console.error('Refuse error:', error);
      showToast(error.response?.data?.message || t('warning.refuseFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-${warningTypeInfo.color}-50 dark:bg-${warningTypeInfo.color}-900/20`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-8 h-8 text-${warningTypeInfo.color}-600`} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {lang === 'th' ? warningTypeInfo.th : warningTypeInfo.en}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t('warning.noticeNumber')}: {warning.notice_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{timeSpentSeconds}s</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>{scrollPercentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all duration-300 ${isScrollComplete ? 'bg-green-500' : 'bg-blue-500'
              }`}
            style={{ width: `${scrollPercentage}%` }}
          />
        </div>

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar"
        >
          {/* Warning Content */}
          <div className="prose dark:prose-invert max-w-none">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t('warning.incidentDate')}
                </label>
                <p className="text-base text-gray-900 dark:text-white">
                  {new Date(warning.incident_date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                </p>
              </div>
              {warning.incident_location && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('warning.location')}
                  </label>
                  <p className="text-base text-gray-900 dark:text-white">{warning.incident_location}</p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('warning.incidentDescription')}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {warning.incident_description}
                </p>
              </div>
            </div>

            {/* Evidence Attachments */}
            {warning.attachments_urls && warning.attachments_urls.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {lang === 'th' ? 'หลักฐานแนบ' : 'Evidence Attachments'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {warning.attachments_urls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 hover:shadow-md transition-shadow block"
                    >
                      <div className="aspect-video flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden mb-2 relative">
                        {isImageFile(url) ? (
                          <img src={url} alt="Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        ) : /\.(mp4|webm|mov|quicktime)$/i.test(url) ? (
                          <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                            <FileVideo className="w-8 h-8 mb-1" />
                            <span className="text-[10px] uppercase font-semibold">Video</span>
                          </div>
                        ) : (
                          <Paperclip className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        )}

                        {/* Overlay Icon */}
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

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('warning.penalty')}
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {warning.penalty_description}
                </p>
                {warning.suspension_days && warning.suspension_days > 0 && (
                  <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
                    <p className="font-medium text-red-700 dark:text-red-300">
                      {t('warning.suspensionPeriod')}: {warning.suspension_days} {t('warning.days')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {warning.suspension_start_date} - {warning.suspension_end_date}
                    </p>
                  </div>
                )}
              </div>
            </div>



            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('warning.yourComment')} ({t('common.optional')})
              </label>
              <textarea
                value={employeeComment}
                onChange={(e) => setEmployeeComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder={t('warning.commentPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
          {!actionMode && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ {t('warning.mustScrollToEnd')} ({scrollPercentage}%)
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setActionMode('acknowledge')}
                  disabled={!isScrollComplete}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {t('warning.acknowledge')}
                </button>
                <button
                  onClick={() => setActionMode('refuse')}
                  disabled={!isScrollComplete}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  {t('warning.refuseToSign')}
                </button>
              </div>
            </div>
          )}

          {actionMode === 'acknowledge' && (
            <div className="space-y-4">
              <SignatureCanvas
                value={signatureData}
                onChange={setSignatureData}
                required
              />
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('warning.acceptTermsText')}
                </span>
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setActionMode(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleAcknowledge}
                  disabled={isSubmitting || !signatureData || !acceptTerms}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting ? t('common.submitting') : t('warning.confirmAcknowledge')}
                </button>
              </div>
            </div>
          )}

          {actionMode === 'refuse' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('warning.refuseReason')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setActionMode(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleRefuse}
                  disabled={isSubmitting || !refuseReason}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting ? t('common.submitting') : t('warning.confirmRefuse')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}
