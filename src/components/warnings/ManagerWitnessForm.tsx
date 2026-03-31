import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, AlertTriangle, X } from 'lucide-react';
import api from '../../api/auth';
import { useToast } from '../../hooks/useToast';

interface ManagerWitnessFormProps {
    warning: {
        id: number;
        notice_number: string;
        employee_name: string;
    };
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function ManagerWitnessForm({ warning, isOpen, onClose, onSuccess }: ManagerWitnessFormProps) {
    const { i18n } = useTranslation();
    const { showToast } = useToast();
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError(i18n.language === 'th' ? 'กรุณาระบุเหตุผล' : 'Reason is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await api.post('/warning-force-close', {
                warning_notice_id: warning.id,
                reason: reason.trim()
            });

            if (response.data.success) {
                showToast(
                    i18n.language === 'th' ? 'บันทึกการปฏิเสธและปิดงานเรียบร้อยแล้ว' : 'Refusal recorded and warning closed successfully',
                    'success'
                );
                onSuccess();
            }
        } catch (err: any) {
            console.error('Force close error:', err);
            const errorMessage = err.response?.data?.message ||
                (i18n.language === 'th' ? 'ไม่สามารถปิดงานได้' : 'Failed to force close warning');
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Shield className="w-6 h-6" />
                            {i18n.language === 'th' ? 'บันทึกการปฏิเสธ / ปิดงาน' : 'Record Refusal / Force Close'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="px-6 py-6 space-y-4">
                            {/* Warning Info */}
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-orange-800">
                                    <p className="font-semibold mb-1">
                                        {i18n.language === 'th' ? 'คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้' : 'Warning: This action cannot be undone'}
                                    </p>
                                    <p>
                                        {i18n.language === 'th'
                                            ? `คุณกำลังบันทึกว่าพนักงานปฏิเสธที่จะเซ็นใบเตือนเลขที่ ${warning.notice_number} หรือไม่สามารถเซ็นได้ตามกำหนด`
                                            : `You are recording that the employee refused to sign warning ${warning.notice_number} or failed to sign in time.`}
                                    </p>
                                </div>
                            </div>

                            {/* Reason Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {i18n.language === 'th' ? 'เหตุผล / บันทึกของพยาน *' : 'Reason / Witness Statement *'}
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                                    placeholder={
                                        i18n.language === 'th'
                                            ? 'ระบุเหตุผลที่ปิดงาน หรือบันทึกเหตุการณ์ที่พนักงานปฏิเสธการเซ็นชื่อ...'
                                            : 'Enter the reason for closing or describe the refusal event...'
                                    }
                                    required
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    {i18n.language === 'th'
                                        ? 'บันทึกนี้จะถูกเก็บเป็นหลักฐานในระบบและจะแสดงในสถานะ "ปฏิเสธการเซ็น" (Signature Refused)'
                                        : 'This statement will be recorded as evidence and the status will be set to "Signature Refused".'}
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                disabled={loading}
                            >
                                {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </button>
                            <button
                                type="submit"
                                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4" />
                                        {i18n.language === 'th' ? 'ยืนยันปิดงาน' : 'Force Close'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

