/**
 * Cancellation Request Modal
 * 
 * Modal for employees to submit leave cancellation requests.
 * - Shows leave details
 * - Requires reason input
 * - Shows 24hr warning if applicable
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, Calendar, Clock, FileText } from 'lucide-react';
import { LeaveRequest } from '../../types/leave';
import { requestLeaveCancellation } from '../../api/leave';
import { useToast } from '../../hooks/useToast';

interface CancellationRequestModalProps {
    request: LeaveRequest;
    onClose: () => void;
    onSuccess: () => void;
}

export const CancellationRequestModal: React.FC<CancellationRequestModalProps> = ({
    request,
    onClose,
    onSuccess,
}) => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isApproved = request.status === 'approved';

    // Calculate hours until start (Thailand timezone)
    const getHoursUntilStart = () => {
        const thaiOffset = 7 * 60 * 60 * 1000;
        const thaiNow = new Date(Date.now() + thaiOffset);
        const startDate = new Date(request.start_date);
        startDate.setHours(0, 0, 0, 0);
        return (startDate.getTime() - thaiNow.getTime()) / (1000 * 60 * 60);
    };

    const hoursUntilStart = getHoursUntilStart();
    const canRequestCancellation = !isApproved || hoursUntilStart >= 24;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (reason.trim().length < 5) {
            setError(i18n.language === 'th'
                ? 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'
                : 'Please provide a reason (minimum 5 characters)');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await requestLeaveCancellation(request.id, reason);

            // Show success message
            if (result.requires_hr_approval) {
                showToast(i18n.language === 'th'
                    ? 'ส่งคำขอยกเลิกแล้ว รอ HR อนุมัติ'
                    : 'Cancellation request submitted. Waiting for HR approval.', 'success');
            } else {
                showToast(i18n.language === 'th'
                    ? 'ยกเลิกคำขอลาเรียบร้อยแล้ว'
                    : 'Leave request canceled successfully.', 'success');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to submit cancellation request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">
                        {i18n.language === 'th' ? 'ขอยกเลิกคำขอลา' : 'Request Cancellation'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Leave Details Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-blue-700">
                            <Calendar className="w-5 h-5" />
                            <span className="font-semibold">
                                {i18n.language === 'th'
                                    ? (request as any).leave_type_name_th || 'ลา'
                                    : (request as any).leave_type_name_en || 'Leave'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">
                                    {i18n.language === 'th' ? 'วันที่ลา' : 'Leave Period'}
                                </span>
                                <p className="font-medium text-gray-800">
                                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">
                                    {i18n.language === 'th' ? 'จำนวน' : 'Days'}
                                </span>
                                <p className="font-medium text-gray-800">
                                    {request.total_days} {i18n.language === 'th' ? 'วัน' : 'days'}
                                </p>
                            </div>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-500">
                                {i18n.language === 'th' ? 'สถานะ' : 'Status'}
                            </span>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${request.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {request.status === 'approved'
                                    ? (i18n.language === 'th' ? 'อนุมัติแล้ว' : 'Approved')
                                    : (i18n.language === 'th' ? 'รออนุมัติ' : 'Pending')}
                            </span>
                        </div>
                    </div>

                    {/* Warning for approved requests */}
                    {isApproved && (
                        <div className={`flex items-start gap-3 p-4 rounded-xl ${canRequestCancellation
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-red-50 border border-red-200'
                            }`}>
                            <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${canRequestCancellation ? 'text-amber-500' : 'text-red-500'
                                }`} />
                            <div className={`text-sm ${canRequestCancellation ? 'text-amber-700' : 'text-red-700'
                                }`}>
                                {canRequestCancellation ? (
                                    <>
                                        <p className="font-semibold mb-1">
                                            {i18n.language === 'th'
                                                ? 'คำขอยกเลิกจะต้องได้รับการอนุมัติจาก HR'
                                                : 'Cancellation request requires HR approval'}
                                        </p>
                                        <p>
                                            {i18n.language === 'th'
                                                ? 'หลังจากส่งคำขอ HR จะพิจารณาและแจ้งผลให้ทราบ'
                                                : 'After submitting, HR will review and notify you of the result.'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-semibold mb-1">
                                            {i18n.language === 'th'
                                                ? 'ไม่สามารถขอยกเลิกได้'
                                                : 'Cannot request cancellation'}
                                        </p>
                                        <p>
                                            {i18n.language === 'th'
                                                ? `ต้องขอยกเลิกล่วงหน้าอย่างน้อย 24 ชั่วโมงก่อนวันลา (เหลือ ${Math.max(0, Math.floor(hoursUntilStart))} ชั่วโมง)`
                                                : `Must request cancellation at least 24 hours before leave starts (${Math.max(0, Math.floor(hoursUntilStart))} hours remaining)`}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Reason Input */}
                    {canRequestCancellation && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <FileText className="w-4 h-4" />
                                    {i18n.language === 'th' ? 'เหตุผลในการขอยกเลิก' : 'Cancellation Reason'}
                                    <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={i18n.language === 'th'
                                        ? 'กรุณาระบุเหตุผลในการขอยกเลิก...'
                                        : 'Please provide a reason for cancellation...'}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                                    rows={4}
                                    required
                                    minLength={5}
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    {reason.length}/5 {i18n.language === 'th' ? 'ตัวอักษรขั้นต่ำ' : 'minimum characters'}
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                                    disabled={isSubmitting}
                                >
                                    {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:from-red-600 hover:to-rose-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSubmitting || reason.trim().length < 5}
                                >
                                    {isSubmitting
                                        ? (i18n.language === 'th' ? 'กำลังส่ง...' : 'Submitting...')
                                        : (i18n.language === 'th' ? 'ส่งคำขอยกเลิก' : 'Submit Cancellation')}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Close button if cannot cancel */}
                    {!canRequestCancellation && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                        >
                            {i18n.language === 'th' ? 'ปิด' : 'Close'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CancellationRequestModal;

