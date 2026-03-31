// src/components/warnings/ManagerWarningPopup.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    X, Users, Calendar, MapPin, Scale,
    CheckSquare, Square, PenTool, FileVideo, Paperclip,
    ExternalLink, UserCheck, Building, ChevronRight, AlertCircle, ShieldCheck
} from 'lucide-react';
import api from '@/api/auth';
import { useToast } from '@/contexts/ToastContext';
import { SignatureModal } from './SignatureModal';
import { isImageFile, getFileNameFromUrl, isVideoFile } from '@/utils/supabaseUpload';
import '@/styles/scrollbar.css';

import { ManagerPendingWarning } from '@/hooks/useManagerWarningCheck';

interface ManagerWarningPopupProps {
    warning: ManagerPendingWarning;
    pendingCount: number;
    onClose: () => void;
    onAcknowledged: () => void;
    onSkipToNext?: () => void;
}

const WARNING_TYPE_LABELS = {
    VERBAL: { th: 'ตักเตือนด้วยวาจา', en: 'Verbal Warning', color: 'yellow' },
    WRITTEN_1ST: { th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 1', en: 'Written Warning (1st)', color: 'orange' },
    WRITTEN_2ND: { th: 'ตักเตือนเป็นลายลักษณ์อักษร ครั้งที่ 2', en: 'Written Warning (2nd)', color: 'red' },
    FINAL_WARNING: { th: 'ตักเตือนครั้งสุดท้าย', en: 'Final Warning', color: 'red' },
    SUSPENSION: { th: 'พักงาน', en: 'Suspension', color: 'purple' },
    TERMINATION: { th: 'เลิกจ้าง', en: 'Termination', color: 'black' },
};

export function ManagerWarningPopup({
    warning,
    pendingCount,
    onClose,
    onAcknowledged,
    onSkipToNext
}: ManagerWarningPopupProps) {
    const { i18n } = useTranslation();
    const { showToast } = useToast();
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [timeSpent, setTimeSpent] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [acknowledgementConfirm, setAcknowledgementConfirm] = useState(false);
    const [isSignatureModalOpen, setSignatureModalOpen] = useState(false);
    const [comment, setComment] = useState('');
    const contentRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<number>(Date.now());

    const warningTypeLabel = WARNING_TYPE_LABELS[warning.warning_type as keyof typeof WARNING_TYPE_LABELS];

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Check if content is scrollable
    useEffect(() => {
        const checkScrollable = () => {
            if (!contentRef.current) return;
            const { scrollHeight, clientHeight } = contentRef.current;
            if (scrollHeight <= clientHeight + 10) {
                setHasScrolledToBottom(true);
            }
        };

        checkScrollable();
        const timeout = setTimeout(checkScrollable, 500);
        return () => clearTimeout(timeout);
    }, []);

    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const clampedScrollTop = Math.max(0, Math.min(scrollTop, scrollHeight - clientHeight));
        const scrollPercentage = ((clampedScrollTop + clientHeight) / scrollHeight) * 100;
        if (scrollPercentage >= 90 && !hasScrolledToBottom) {
            setHasScrolledToBottom(true);
        }
    };

    const handleAcknowledge = async () => {
        if (!hasScrolledToBottom) {
            showToast(
                i18n.language === 'th'
                    ? 'กรุณาอ่านเนื้อหาจนจบก่อนรับทราบ'
                    : 'Please read the entire content before acknowledging',
                'warning'
            );
            return;
        }

        if (!acknowledgementConfirm) {
            showToast(
                i18n.language === 'th'
                    ? 'กรุณายืนยันการรับทราบก่อนดำเนินการ'
                    : 'Please confirm acknowledgement before proceeding',
                'warning'
            );
            return;
        }

        setIsProcessing(true);
        try {
            const response = await api.post('/warning-manager-acknowledge', {
                warning_notice_id: warning.id,
                signature_data: signatureData,
                comment: comment || null,
            });

            if (response.data.success) {
                showToast(
                    i18n.language === 'th'
                        ? 'รับทราบใบเตือนของพนักงานเรียบร้อยแล้ว'
                        : 'Employee warning acknowledged successfully',
                    'success'
                );
                onAcknowledged();
                onClose();
            } else {
                showToast(
                    response.data.message ||
                    (i18n.language === 'th' ? 'ไม่สามารถรับทราบได้' : 'Failed to acknowledge'),
                    'error'
                );
            }
        } catch (error: any) {
            console.error('Manager acknowledge error:', error);
            showToast(
                error.response?.data?.message ||
                (i18n.language === 'th' ? 'ไม่สามารถรับทราบได้' : 'Failed to acknowledge'),
                'error'
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Get employee name
    const employeeName = i18n.language === 'th'
        ? `${warning.employee_first_name_th || ''} ${warning.employee_last_name_th || ''}`
        : `${warning.employee_first_name_en || ''} ${warning.employee_last_name_en || ''}`;

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border-2 border-indigo-500 overflow-hidden">
                {/* Header - Indigo theme for Manager */}
                <div className="px-6 py-4 border-b border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/30">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-800 rounded-lg shadow-sm">
                                <ShieldCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-300" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {i18n.language === 'th' ? 'รับทราบใบเตือน (มุมมองหัวหน้า)' : 'Manager Acknowledgement'}
                                    </h2>
                                    {pendingCount > 1 && (
                                        <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-sm">
                                            {pendingCount} {i18n.language === 'th' ? 'รายการรอ' : 'Pending'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200">
                                        MANAGER REVIEW
                                    </span>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {i18n.language === 'th' ? 'เลขที่' : 'Ref'}: {warning.notice_number}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="p-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Manager Notice Banner */}
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border-b border-indigo-100 dark:border-indigo-800/50">
                    <div className="flex items-start gap-3">
                        <Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                                {i18n.language === 'th' ? 'ตรวจสอบใบเตือนพนักงานในสังกัด' : 'Subordinate Warning Review'}
                            </p>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                                {i18n.language === 'th'
                                    ? 'ในฐานะหัวหน้าแผนก กรุณาตรวจสอบและรับทราบใบเตือนของพนักงานในทีมของคุณ'
                                    : 'As a department manager, please review and acknowledge this warning issued to your team member.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Employee Info Card */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {employeeName}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {warning.employee_code} • {i18n.language === 'th' ? warning.employee_position_th : warning.employee_position_en}
                            </p>
                        </div>
                        <div className={`ml-auto px-3 py-1 rounded-full text-sm font-medium 
              ${warningTypeLabel.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                warningTypeLabel.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                                    warningTypeLabel.color === 'red' ? 'bg-red-100 text-red-800' :
                                        warningTypeLabel.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                                            'bg-gray-100 text-gray-800'}`}>
                            {i18n.language === 'th' ? warningTypeLabel.th : warningTypeLabel.en}
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div
                    ref={contentRef}
                    onScroll={handleScroll}
                    className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6 enhanced-scrollbar scrollbar-container"
                >
                    {/* Incident Details */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            {i18n.language === 'th' ? 'รายละเอียดเหตุการณ์' : 'Incident Details'}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400">
                                    {i18n.language === 'th' ? 'วันที่เกิดเหตุ' : 'Incident Date'}
                                </label>
                                <p className="text-gray-900 dark:text-white">{formatDate(warning.incident_date)}</p>
                            </div>

                            {warning.incident_location && (
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        {i18n.language === 'th' ? 'สถานที่' : 'Location'}
                                    </label>
                                    <p className="text-gray-900 dark:text-white">{warning.incident_location}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400">
                                {i18n.language === 'th' ? 'ประเภทความผิด' : 'Offense Type'}
                            </label>
                            <p className="text-gray-900 dark:text-white">
                                {i18n.language === 'th' ? warning.offense_name_th : warning.offense_name_en}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400">
                                {i18n.language === 'th' ? 'รายละเอียดเหตุการณ์' : 'Incident Description'}
                            </label>
                            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                                {warning.incident_description}
                            </p>
                        </div>
                    </div>

                    {/* Evidence Attachments */}
                    {warning.attachments_urls && warning.attachments_urls.length > 0 && (
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                                <Paperclip className="w-5 h-5" />
                                {i18n.language === 'th' ? 'หลักฐานแนบ' : 'Evidence Attachments'}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {warning.attachments_urls.map((url: string, index: number) => (
                                    <a
                                        key={index}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow block"
                                    >
                                        <div className="aspect-video flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden mb-2 relative">
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
                    <div className="space-y-4 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                            <Scale className="w-5 h-5" />
                            {i18n.language === 'th' ? 'บทลงโทษ' : 'Penalty'}
                        </h3>
                        <p className="text-red-900 dark:text-red-100 whitespace-pre-wrap">
                            {warning.penalty_description}
                        </p>

                        {warning.suspension_days > 0 && (
                            <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded">
                                <p className="text-red-900 dark:text-red-100">
                                    <strong>{i18n.language === 'th' ? 'พักงาน:' : 'Suspension:'}</strong>{' '}
                                    {warning.suspension_days} {i18n.language === 'th' ? 'วัน' : 'days'}
                                    {warning.suspension_start_date && (
                                        <>
                                            {' '}({formatDate(warning.suspension_start_date)} - {formatDate(warning.suspension_end_date)})
                                        </>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Witnesses */}
                    {warning.witnesses && warning.witnesses.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                {i18n.language === 'th' ? 'พยาน' : 'Witnesses'}
                            </h3>
                            {warning.witnesses.map((witness: any, index: number) => (
                                <div key={index} className="border border-gray-200 dark:border-gray-700 p-3 rounded">
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {witness.witness_name} {witness.witness_position && `(${witness.witness_position})`}
                                    </p>
                                    {witness.statement && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {witness.statement}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Issuer Info */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <p>
                            {i18n.language === 'th' ? 'ออกโดย:' : 'Issued by:'}{' '}
                            {i18n.language === 'th'
                                ? `${warning.issuer_first_name_th} ${warning.issuer_last_name_th}`
                                : `${warning.issuer_first_name_en} ${warning.issuer_last_name_en}`}
                            {(warning.issuer_position_th || warning.issuer_position_en) && (
                                <> ({i18n.language === 'th' ? warning.issuer_position_th : warning.issuer_position_en})</>
                            )}
                        </p>
                        <p>
                            {i18n.language === 'th' ? 'วันที่ออกใบเตือน:' : 'Issue Date:'} {formatDate(warning.created_at)}
                        </p>
                        <p>
                            {i18n.language === 'th' ? 'สถานะพนักงาน:' : 'Employee Status:'}{' '}
                            <span className={
                                warning.status === 'ACTIVE' ? 'text-green-600 font-medium' :
                                    warning.status === 'REFUSED' ? 'text-orange-600 font-medium' :
                                        'text-yellow-600 font-medium'
                            }>
                                {warning.status === 'ACTIVE'
                                    ? (i18n.language === 'th' ? 'รับทราบแล้ว' : 'Acknowledged')
                                    : warning.status === 'REFUSED'
                                        ? (i18n.language === 'th' ? 'ปฏิเสธเซ็น' : 'Refused to Sign')
                                        : (i18n.language === 'th' ? 'รอพนักงานรับทราบ' : 'Pending Employee Acknowledgement')}
                            </span>
                        </p>
                    </div>

                    {/* Scroll Indicator */}
                    {!hasScrolledToBottom && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center gap-2 sticky bottom-0 z-10 border-t border-blue-200 dark:border-blue-800">
                            <AlertCircle className="w-5 h-5 text-blue-600 animate-bounce" />
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                                {i18n.language === 'th'
                                    ? '↓ กรุณาเลื่อนอ่านเนื้อหาจนจบก่อนรับทราบ'
                                    : '↓ Please scroll to read the entire content before acknowledging'}
                            </p>
                        </div>
                    )}

                    {/* Manager Acknowledgement Section */}
                    {hasScrolledToBottom && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <PenTool className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {i18n.language === 'th' ? 'ลงลายเซ็นรับทราบ (ไม่บังคับ)' : 'Acknowledgement Signature (Optional)'}
                                </h3>
                            </div>

                            {/* Optional Signature */}
                            <div
                                onClick={() => !isProcessing && setSignatureModalOpen(true)}
                                className={`
                  relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all group
                  ${signatureData
                                        ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
                                    }
                  ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                            >
                                {signatureData ? (
                                    <>
                                        <img src={signatureData} alt="Signature" className="h-20 object-contain" />
                                        <div className="absolute top-2 right-2 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                                            <CheckSquare className="w-3 h-3" />
                                            {i18n.language === 'th' ? 'เซ็นแล้ว' : 'Signed'}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <PenTool className="w-6 h-6 text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-500">
                                            {i18n.language === 'th' ? 'คลิกเพื่อลงลายเซ็น (ไม่บังคับ)' : 'Click to sign (optional)'}
                                        </p>
                                    </>
                                )}
                            </div>

                            <SignatureModal
                                isOpen={isSignatureModalOpen}
                                onClose={() => setSignatureModalOpen(false)}
                                onConfirm={(data) => {
                                    setSignatureData(data);
                                    setSignatureModalOpen(false);
                                }}
                                initialData={signatureData}
                            />

                            {/* Optional Comment */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {i18n.language === 'th' ? 'ความคิดเห็น (ไม่บังคับ)' : 'Comment (Optional)'}
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    placeholder={i18n.language === 'th' ? 'หมายเหตุหรือความคิดเห็นเพิ่มเติม...' : 'Additional notes or comments...'}
                                    disabled={isProcessing}
                                />
                            </div>

                            {/* Confirmation Checkbox */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setAcknowledgementConfirm(!acknowledgementConfirm)}
                                    disabled={isProcessing}
                                    className="flex items-start gap-3 w-full text-left disabled:opacity-50"
                                >
                                    {acknowledgementConfirm ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                                            {i18n.language === 'th'
                                                ? 'ข้าพเจ้ารับทราบว่าพนักงานในแผนกได้รับใบเตือนนี้แล้ว'
                                                : 'I acknowledge that an employee in my department has received this warning'}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            {i18n.language === 'th'
                                                ? 'การรับทราบนี้จะถูกบันทึกและแจ้งไปยัง HR'
                                                : 'This acknowledgement will be recorded and HR will be notified'}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            {i18n.language === 'th' ? 'เวลาที่อ่าน:' : 'Reading time:'} {Math.floor(timeSpent / 60)}:
                            {(timeSpent % 60).toString().padStart(2, '0')}
                        </div>

                        <div className="flex gap-3">
                            {pendingCount > 1 && onSkipToNext && (
                                <button
                                    onClick={onSkipToNext}
                                    disabled={isProcessing}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {i18n.language === 'th' ? 'ข้าม' : 'Skip'}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                disabled={isProcessing}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                                {i18n.language === 'th' ? 'ปิด' : 'Close'}
                            </button>
                            <button
                                onClick={handleAcknowledge}
                                disabled={!hasScrolledToBottom || !acknowledgementConfirm || isProcessing}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <UserCheck className="w-4 h-4" />
                                {i18n.language === 'th' ? 'รับทราบ' : 'Acknowledge'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}


