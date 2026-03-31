import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarX,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Users,
  Clock,
  MessageSquare,
  TrendingUp,
  X
} from 'lucide-react';
import { DateSuggestion } from '../../utils/dateSuggestions';
import { useToast } from '../../hooks/useToast';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestedDate: Date;
  conflictingRequests: Array<{
    id: string;
    employee_name: string;
    leave_type_name: string;
    status: string;
    conflict_date: string;
  }>;
  suggestions: DateSuggestion[];
  onResolveWithAlternative?: (suggestion: DateSuggestion, reason: string) => void;
  onContactTeamLeader?: () => void;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  requestedDate,
  conflictingRequests,
  suggestions,
  onContactTeamLeader
}: ConflictResolutionModalProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [selectedSuggestion, setSelectedSuggestion] = useState<DateSuggestion | null>(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectSuggestion = (suggestion: DateSuggestion) => {
    setSelectedSuggestion(suggestion);
  };

  const handleResolveWithAlternative = async () => {
    if (!selectedSuggestion) {
      showToast(t('common.selectAlternative') || t("leave.selectDateOptionFirst"), 'warning');
      return;
    }

    setIsProcessing(true);
    setResolutionReason(selectedSuggestion.reason);

    try {
      // Simulate API call to reschedule with alternative date
      await new Promise(resolve => setTimeout(resolve, 1000));

      showToast(
        t('leave.dateRescheduled') || t("leave.dateRescheduledSuccessfully"),
        'success',
        4000
      );

      onClose();
    } catch (error) {
      showToast(t('common.failedToReschedule') || t("leave.failedToReschedule"), 'error');
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
      setSelectedSuggestion(null);
    }
  };


  const handleCustomResolution = async () => {
    if (!resolutionReason.trim()) {
      showToast(t('leave.pleaseSpecifyReason') || t("leave.specifyResolutionReason"), 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate custom resolution workflow
      await new Promise(resolve => setTimeout(resolve, 1500));

      showToast(
        t('leave.conflictResolved') || t("leave.conflictResolvedSuccessfully"),
        'success',
        4000
      );

      onClose();
      setResolutionReason('');
    } catch (error) {
      showToast(t('leave.failedToResolve') || t("leave.failedToResolveConflict"), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'earlier_date':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'later_date':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'shorter_duration':
        return <TrendingUp className="w-5 h-5 text-blue-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {i18n.language === 'th'
                ? 'พบคานะควอมูลที่อยู่กัน'
                : 'Date Conflict Resolution'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Summary */}
        <div className="mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="shrink-0">
                <CalendarX className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-800">
                  {i18n.language === 'th' ? 'มีวันที่ซ้ำซ้อน' : 'Conflicts Found'}
                </h3>
                <p className="text-red-700">
                  {i18n.language === 'th'
                    ? `วันที่ ${formatDate(requestedDate)} มีข้อขัดแย้ง ${conflictingRequests.length} รายการลาที่ซ้ำซ้อน`
                    : `Your request for ${formatDate(requestedDate)} conflicts with ${conflictingRequests.length} existing requests`}
                </p>
              </div>
            </div>

            {/* Conflict Details List */}
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {conflictingRequests.map((conflict, index) => (
                <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <Users className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {conflict.employee_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {conflict.leave_type_name} - {i18n.language === 'th' ? 'อนุมัติแล้ว' : 'Leave'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(new Date(conflict.conflict_date))} ({conflict.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'})
                        </div>
                      </div>
                    </div>

                    <div className="ml-3 shrink-0">
                      <div className="text-sm text-orange-600 font-medium">
                        {i18n.language === 'th' ? 'ระยะ' : 'Duration'}: {(conflict as any).total_days || 1} {i18n.language === 'th' ? 'วัน' : 'day(s)'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Smart Suggestions */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {i18n.language === 'th' ? 'คำแนะแนะทาง' : 'Smart Suggestions'}
            </h3>
          </div>
          <p className="text-gray-600 text-center mb-4">
            {i18n.language === 'th'
              ? 'ระบบทางวันที่ซ้ำอนุมัติที่คุณมีคำขอลาแนะทางวันอื่นอยุ่วัน'
              : 'Alternative dates with better approval chances and fewer conflicts'}
          </p>

          {/* Suggestions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {suggestions.slice(0, 6).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSelectSuggestion(suggestion)}
                className={`p-4 border-2 rounded-lg transition-all duration-200 hover:border-blue-400 hover:shadow-md text-left ${selectedSuggestion?.date === suggestion.date ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                disabled={isProcessing}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mb-2">
                    {getSuggestionIcon((suggestion as any).type)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm mb-1">
                      {i18n.language === 'th'
                        ? `วันที่ ${formatDate(suggestion.date)}`
                        : `${formatDate(suggestion.date)} (${suggestion.score}/100)`
                      }
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      {suggestion.reason}
                    </div>
                  </div>
                  <div className="ml-auto shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-medium text-blue-600">
                        {suggestion.score}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Selected Suggestion Details */}
          {selectedSuggestion && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">
                {i18n.language === 'th' ? 'รายละเอียดทางเลือก' : 'Selected Alternative'}
              </h4>
              <div className="text-sm text-blue-800 mb-2">
                <div className="font-medium">{formatDate(selectedSuggestion.date)}</div>
                <div className="text-xs text-blue-600">{selectedSuggestion.reason}</div>
              </div>
              <div className="text-xs text-blue-600 mt-1 mb-3">
                <strong>{i18n.language === 'th' ? 'ประโยชน์:' : 'Benefits:'}</strong>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li>{(selectedSuggestion as any).type === 'earlier_date' ? 'Earlier date available' : 'Optimized scheduling'}</li>
                  <li>{i18n.language === 'th' ? 'โอกาสอนุมัติสูงขึ้น' : 'Better approval chances'}</li>
                  <li>{i18n.language === 'th' ? 'ลดความขัดแย้งน้อย' : 'Fewer team conflicts'} ({selectedSuggestion.score}%)</li>
                </ul>
              </div>
              <button
                onClick={handleResolveWithAlternative}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <>
                    <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{i18n.language === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>{i18n.language === 'th' ? 'ใช้วันที่นี้' : 'Use This Date'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Custom Resolution Options */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h4 className="font-semibold text-gray-900">
                {i18n.language === 'th' ? 'ตัวเลืออื่นทาง' : 'Custom Resolution'}
              </h4>
            </div>
            <div className="space-y-3">
              <textarea
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder={i18n.language === 'th' ? 'ระบุลาเหตุผลด...' : 'Describe how you want to resolve this conflict...'}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCustomResolution}
                  disabled={isProcessing || !resolutionReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{i18n.language === 'th' ? 'กำลังดำเนินการ...' : 'Resolving...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>{i18n.language === 'th' ? 'แก้ไขข้อขัดแย้ง' : 'Resolve Conflict'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onContactTeamLeader}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  <span>{i18n.language === 'th' ? 'ติดต่อผู้จัดการ' : 'Contact Team Leader'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {i18n.language === 'th' ? 'ปิด' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

