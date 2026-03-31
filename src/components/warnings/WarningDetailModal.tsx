import { useTranslation } from 'react-i18next';
import {
    X,
    Calendar,
    User,
    FileText,
    AlertTriangle,
    MapPin,
    Clock,
    CheckCircle,
    PenTool,
    Shield,
    Info,
    Paperclip,
    FileVideo,
    ExternalLink
} from 'lucide-react';
import { isImageFile, getFileNameFromUrl, isVideoFile } from '@/utils/supabaseUpload';

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
    status: string;
    issued_by_name: string;
    issuer_signature?: string;
    created_at: string;
    is_active: boolean;
    refuse_reason?: string;
    effective_date: string;
    expiry_date?: string;
    offense_type_id: number;
    incident_location?: string;
    suspension_days?: number;
    suspension_start_date?: string;
    suspension_end_date?: string;
    signature_data?: string;
    signature_timestamp?: string;
    signature_ip?: string;
    acknowledged_at?: string;
    attachments_urls?: string[];
}

interface WarningDetailModalProps {
    warning: Warning;
    onClose: () => void;
}

const WARNING_TYPE_LABELS: Record<string, { th: string; en: string; color: string }> = {
    VERBAL: { th: 'วาจา', en: 'Verbal', color: 'bg-blue-100 text-blue-800' },
    WRITTEN_1ST: { th: 'ลายลักษณ์ 1', en: 'Written 1st', color: 'bg-yellow-100 text-yellow-800' },
    WRITTEN_2ND: { th: 'ลายลักษณ์ 2', en: 'Written 2nd', color: 'bg-orange-100 text-orange-800' },
    FINAL_WARNING: { th: 'สุดท้าย', en: 'Final', color: 'bg-red-100 text-red-800' },
    SUSPENSION: { th: 'พักงาน', en: 'Suspension', color: 'bg-purple-100 text-purple-800' },
    TERMINATION: { th: 'เลิกจ้าง', en: 'Termination', color: 'bg-gray-900 text-white' },
};

const STATUS_CONFIG: Record<string, { th: string; en: string; color: string; icon: any }> = {
    DRAFT: { th: 'แบบร่าง', en: 'Draft', color: 'bg-gray-100 text-gray-800', icon: FileText },
    PENDING_ACKNOWLEDGMENT: { th: 'รอรับทราบ', en: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    PENDING_ACKNOWLEDGEMENT: { th: 'รอรับทราบ', en: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    ACTIVE: { th: 'รับทราบแล้ว', en: 'Acknowledged', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    ACKNOWLEDGED: { th: 'รับทราบแล้ว', en: 'Acknowledged', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    REFUSED: { th: 'ปฏิเสธ', en: 'Refused', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    APPEALED: { th: 'อุทธรณ์', en: 'Appealed', color: 'bg-purple-100 text-purple-800', icon: FileText },
    VOIDED: { th: 'ยกเลิก', en: 'Voided', color: 'bg-gray-100 text-gray-600', icon: X },
};

export function WarningDetailModal({ warning, onClose }: WarningDetailModalProps) {
    const { i18n } = useTranslation();
    const isThaiLang = i18n.language === 'th';

    const warningType = WARNING_TYPE_LABELS[warning.warning_type] || {
        th: warning.warning_type,
        en: warning.warning_type,
        color: 'bg-gray-100 text-gray-800'
    };

    const statusConfig = STATUS_CONFIG[warning.status] || STATUS_CONFIG.DRAFT;
    const StatusIcon = statusConfig.icon;

    const formatDate = (dateString: string): string => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return dateString;
        }
    };

    const formatDateTime = (dateString: string): string => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleString(isThaiLang ? 'th-TH' : 'en-US');
        } catch {
            return dateString;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{warning.notice_number}</h2>
                                <p className="text-blue-100 text-sm">
                                    {isThaiLang ? 'รายละเอียดใบเตือน' : 'Warning Notice Details'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Status and Warning Type badges */}
                    <div className="flex gap-2 mt-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${warningType.color}`}>
                            <AlertTriangle className="w-4 h-4" />
                            {isThaiLang ? warningType.th : warningType.en}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${statusConfig.color}`}>
                            <StatusIcon className="w-4 h-4" />
                            {isThaiLang ? statusConfig.th : statusConfig.en}
                        </span>
                        {!warning.is_active && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-200 text-gray-600">
                                {isThaiLang ? 'หมดอายุ' : 'Expired'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Employee Info */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {isThaiLang ? 'ข้อมูลพนักงาน' : 'Employee Information'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">{isThaiLang ? 'รหัสพนักงาน' : 'Employee Code'}</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{warning.employee_code}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{isThaiLang ? 'ชื่อ-นามสกุล' : 'Name'}</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{warning.employee_name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Incident Details */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            {isThaiLang ? 'รายละเอียดเหตุการณ์' : 'Incident Details'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">{isThaiLang ? 'วันที่เกิดเหตุ' : 'Incident Date'}</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">{formatDate(warning.incident_date)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">{isThaiLang ? 'ประเภทความผิด' : 'Offense Type'}</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {isThaiLang ? warning.offense_type_name_th : warning.offense_type_name_en}
                                    </p>
                                </div>
                            </div>
                            {warning.incident_location && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <MapPin className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">{isThaiLang ? 'สถานที่' : 'Location'}</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{warning.incident_location}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <User className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">{isThaiLang ? 'ออกโดย' : 'Issued By'}</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">{warning.issued_by_name}</p>
                                    {warning.issuer_signature && (
                                        <div className="mt-2 text-center">
                                            <img
                                                src={warning.issuer_signature}
                                                alt="Issuer Signature"
                                                className="max-h-12 object-contain"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                            <p className="text-sm text-gray-500 mb-2">{isThaiLang ? 'รายละเอียดเหตุการณ์' : 'Incident Description'}</p>
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {warning.incident_description || '-'}
                            </p>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                            <p className="text-sm text-gray-500 mb-2">{isThaiLang ? 'บทลงโทษ' : 'Penalty Description'}</p>
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {warning.penalty_description || '-'}
                            </p>
                        </div>
                    </div>

                    {/* Attachments Section */}
                    {warning.attachments_urls && warning.attachments_urls.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                                <Paperclip className="w-4 h-4" />
                                {isThaiLang ? 'หลักฐานแนบ' : 'Evidence Attachments'}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {warning.attachments_urls.map((url: string, index: number) => (
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

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                            <p className="text-sm text-gray-500">{isThaiLang ? 'วันที่มีผล' : 'Effective Date'}</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{formatDate(warning.effective_date)}</p>
                        </div>
                        {warning.expiry_date && (
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                <p className="text-sm text-gray-500">{isThaiLang ? 'วันหมดอายุ' : 'Expiry Date'}</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{formatDate(warning.expiry_date)}</p>
                            </div>
                        )}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                            <p className="text-sm text-gray-500">{isThaiLang ? 'วันที่สร้าง' : 'Created Date'}</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{formatDate(warning.created_at)}</p>
                        </div>
                    </div>

                    {/* Suspension Info (if applicable) */}
                    {warning.warning_type === 'SUSPENSION' && warning.suspension_days && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {isThaiLang ? 'ข้อมูลการพักงาน' : 'Suspension Information'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-purple-600">{isThaiLang ? 'จำนวนวันพักงาน' : 'Suspension Days'}</p>
                                    <p className="font-bold text-purple-900 dark:text-purple-100 text-xl">{warning.suspension_days} {isThaiLang ? 'วัน' : 'days'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-purple-600">{isThaiLang ? 'วันเริ่มพักงาน' : 'Start Date'}</p>
                                    <p className="font-semibold text-purple-900 dark:text-purple-100">{warning.suspension_start_date || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-purple-600">{isThaiLang ? 'วันสิ้นสุดพักงาน' : 'End Date'}</p>
                                    <p className="font-semibold text-purple-900 dark:text-purple-100">{warning.suspension_end_date || '-'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Acknowledgement/Signature Section */}
                    {(warning.status === 'ACTIVE' || warning.status === 'ACKNOWLEDGED') && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 uppercase mb-3 flex items-center gap-2">
                                <PenTool className="w-4 h-4" />
                                {isThaiLang ? 'การรับทราบและลายเซ็น' : 'Acknowledgement & Signature'}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-green-600">{isThaiLang ? 'วันเวลาที่รับทราบ' : 'Acknowledged At'}</p>
                                    <p className="font-semibold text-green-900 dark:text-green-100">
                                        {warning.acknowledged_at ? formatDateTime(warning.acknowledged_at) : '-'}
                                    </p>
                                </div>
                                {warning.signature_ip && (
                                    <div>
                                        <p className="text-sm text-green-600">{isThaiLang ? 'IP Address' : 'IP Address'}</p>
                                        <p className="font-semibold text-green-900 dark:text-green-100">{warning.signature_ip}</p>
                                    </div>
                                )}
                            </div>

                            {/* Signature Display */}
                            <div className="border-t border-green-200 dark:border-green-700 pt-4">
                                <p className="text-sm text-green-600 mb-2">{isThaiLang ? 'ลายเซ็นพนักงาน' : 'Employee Signature'}</p>
                                {warning.signature_data ? (
                                    <div className="bg-white rounded-lg p-4 border border-green-200">
                                        {warning.signature_data.startsWith('data:image') || warning.signature_data.startsWith('http') ? (
                                            <img
                                                src={warning.signature_data}
                                                alt="Signature"
                                                className="max-h-32 mx-auto object-contain"
                                            />
                                        ) : (
                                            <p className="text-center text-lg font-signature italic text-gray-800">
                                                {warning.signature_data}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4 bg-white rounded-lg border border-green-200">
                                        {isThaiLang ? 'ไม่มีข้อมูลลายเซ็น' : 'No signature data available'}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Refusal Section */}
                    {(warning.status === 'REFUSED' || warning.status === 'SIGNATURE_REFUSED') && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300 uppercase mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {isThaiLang ? 'ข้อมูลการปฏิเสธการเซ็น' : 'Refusal Information'}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-red-600">{isThaiLang ? 'วันเวลาที่ทำรายการ' : 'Refused At'}</p>
                                    <p className="font-semibold text-red-900 dark:text-red-100">
                                        {/* Fallback to acknowledged_at if refused_at is not available, as API might map it there or updated_at */}
                                        {warning.acknowledged_at ? formatDateTime(warning.acknowledged_at) : formatDateTime(warning.created_at)}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700">
                                <p className="text-sm text-red-600 mb-1">{isThaiLang ? 'เหตุผลการปฏิเสธ' : 'Reason for Refusal'}</p>
                                <p className="text-gray-900 dark:text-white whitespace-pre-wrap font-medium">
                                    {warning.refuse_reason || (isThaiLang ? 'ไม่ได้ระบุเหตุผล' : 'No reason provided')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Pending Acknowledgement Message */}
                    {(warning.status === 'PENDING_ACKNOWLEDGMENT' || warning.status === 'PENDING_ACKNOWLEDGEMENT') && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center">
                            <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                            <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                                {isThaiLang ? 'รอพนักงานรับทราบ' : 'Waiting for employee acknowledgement'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 rounded-b-2xl border-t border-gray-200 dark:border-gray-600">
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-medium transition-colors"
                    >
                        {isThaiLang ? 'ปิด' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
}

