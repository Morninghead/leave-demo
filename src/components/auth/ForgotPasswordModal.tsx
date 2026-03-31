import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X, KeyRound, CreditCard, User, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../api/auth';
import { logger } from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const { loginWithPasswordReset } = useAuth();

    const [formData, setFormData] = useState({
        employee_code: '',
        national_id: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Format national ID with dashes (X-XXXX-XXXXX-XX-X)
    const formatNationalId = (value: string): string => {
        const digits = value.replace(/\D/g, '').slice(0, 13);
        if (digits.length <= 1) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 1)}-${digits.slice(1)}`;
        if (digits.length <= 10) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5)}`;
        if (digits.length <= 12) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10)}`;
        return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
    };

    const handleInputChange = (field: string, value: string) => {
        if (field === 'national_id') {
            value = formatNationalId(value);
        }
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate inputs
        if (!formData.employee_code.trim()) {
            setError(i18n.language === 'th' ? 'กรุณาระบุรหัส ERP หรือ รหัสเครื่องสแกนนิ้วมือ' : 'Please enter ERP code or fingerprint scanner code');
            return;
        }

        const cleanNationalId = formData.national_id.replace(/\D/g, '');
        if (cleanNationalId.length !== 13) {
            setError(i18n.language === 'th' ? 'เลขบัตรประชาชนต้อง 13 หลัก' : 'National ID must be 13 digits');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.post('/auth-verify-reset', {
                employee_code: formData.employee_code.trim(),
                national_id: cleanNationalId
            });

            if (response.data.success) {
                logger.log('✅ Password reset verification successful');

                const { user, token } = response.data;

                // ✅ FIX: Use AuthContext to set user/token with requiresPasswordChange = true
                // This keeps the state in memory so the PasswordChangeModal will appear
                loginWithPasswordReset(user, token);

                // Close the modal
                onClose();

                // Navigate to dashboard (without page reload to preserve memory state)
                navigate('/dashboard');
            }
        } catch (err: any) {
            logger.error('Password reset verification failed:', err);

            let errorMessage = i18n.language === 'th'
                ? 'การยืนยันตัวตนล้มเหลว กรุณาลองใหม่'
                : 'Verification failed. Please try again.';

            if (err.response?.data?.message) {
                const msg = err.response.data.message;
                if (msg.includes('Invalid employee code or national ID')) {
                    errorMessage = i18n.language === 'th'
                        ? 'รหัส ERP, รหัสเครื่องสแกนนิ้วมือ หรือเลขบัตรประชาชนไม่ถูกต้อง'
                        : 'Invalid ERP code, fingerprint scanner code, or national ID';
                } else if (msg.includes('Too many attempts')) {
                    errorMessage = i18n.language === 'th'
                        ? 'มีการพยายามมากเกินไป กรุณารอสักครู่'
                        : 'Too many attempts. Please try again later.';
                } else if (msg.includes('13 digits')) {
                    errorMessage = i18n.language === 'th'
                        ? 'เลขบัตรประชาชนต้อง 13 หลัก'
                        : 'National ID must be 13 digits';
                }
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ employee_code: '', national_id: '' });
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <KeyRound className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {i18n.language === 'th' ? 'รีเซ็ตรหัสผ่าน' : 'Reset Password'}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Instructions */}
                <div className="px-6 pt-4">
                    <p className="text-sm text-gray-600">
                        {i18n.language === 'th'
                            ? 'กรอกรหัส ERP หรือ รหัสเครื่องสแกนนิ้วมือ และเลขบัตรประชาชนเพื่อยืนยันตัวตน จากนั้นคุณจะสามารถตั้งรหัสผ่านใหม่ได้'
                            : 'Enter your ERP code or fingerprint scanner code and national ID to verify your identity. You will then be able to set a new password.'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Employee Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'รหัส ERP หรือ รหัสเครื่องสแกนนิ้วมือ' : 'ERP Code or Fingerprint Scanner Code'}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={formData.employee_code}
                                onChange={(e) => handleInputChange('employee_code', e.target.value.toUpperCase())}
                                placeholder={i18n.language === 'th' ? 'กรอกรหัส ERP หรือ รหัสเครื่องสแกนนิ้วมือ' : 'Enter ERP code or fingerprint scanner code'}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                disabled={isLoading}
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {/* National ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'เลขบัตรประชาชน' : 'National ID'}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CreditCard className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={formData.national_id}
                                onChange={(e) => handleInputChange('national_id', e.target.value)}
                                placeholder="X-XXXX-XXXXX-XX-X"
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono tracking-wider"
                                disabled={isLoading}
                                autoComplete="off"
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            {i18n.language === 'th' ? 'เลขบัตรประชาชน 13 หลัก' : '13-digit national ID'}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {i18n.language === 'th' ? 'กำลังตรวจสอบ...' : 'Verifying...'}
                            </>
                        ) : (
                            <>
                                <KeyRound className="w-5 h-5" />
                                {i18n.language === 'th' ? 'ยืนยันตัวตน' : 'Verify Identity'}
                            </>
                        )}
                    </button>

                    {/* Cancel Button */}
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="w-full py-3 px-4 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                </form>
            </div>
        </div>
    );
}


