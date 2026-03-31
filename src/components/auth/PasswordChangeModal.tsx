import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { X, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/auth';

interface PasswordRequirement {
  type: 'length' | 'uppercase' | 'lowercase' | 'numbers' | 'special';
  regex: RegExp;
  message: string;
  isValid: boolean;
}

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isForced?: boolean;
  isOwnPassword?: boolean;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
}

export function PasswordChangeModal({
  isOpen,
  onClose,
  isForced = false,
  isOwnPassword = true,
  targetEmployeeId,
  targetEmployeeName
}: PasswordChangeModalProps) {
  const { t, i18n } = useTranslation();
  const { completePasswordChange } = useAuth();

  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([]);
  const [passwordSettings, setPasswordSettings] = useState<any>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPasswordSettings();
      initializePasswordRequirements();
      setSuccess(false); // Reset success state when modal opens
      setErrors([]); // Clear any previous errors
    }
  }, [isOpen]);

  const loadPasswordSettings = async () => {
    try {
      const response = await api.get('/auth-password-settings');
      if (response.data.success) {
        setPasswordSettings(response.data.settings);
      }
    } catch (error) {
      logger.error('Error loading password settings:', error);
    }
  };

  const initializePasswordRequirements = () => {
    // Initialize with empty requirements - they will be populated when settings are loaded
    setPasswordRequirements([]);
  };

  useEffect(() => {
    if (passwordSettings) {
      validatePasswordRequirements();
    }
  }, [formData.new_password, passwordSettings]);

  const validatePasswordRequirements = () => {
    if (!passwordSettings) return;

    // Build requirements dynamically based on current settings
    const requirements: PasswordRequirement[] = [];

    // Always include length requirement
    const minLength = passwordSettings.minLength || 8;
    requirements.push({
      type: 'length',
      regex: new RegExp(`.{${minLength},}`),
      message: i18n.language === 'th'
        ? `อย่างน้อย ${minLength} ตัวอักษร`
        : `At least ${minLength} characters`,
      isValid: new RegExp(`.{${minLength},}`).test(formData.new_password)
    });

    // Include character requirements only if they are enabled in settings
    if (passwordSettings.requireUppercase) {
      requirements.push({
        type: 'uppercase',
        regex: /[A-Z]/,
        message: i18n.language === 'th' ? 'ตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว' : 'At least 1 uppercase letter',
        isValid: /[A-Z]/.test(formData.new_password)
      });
    }

    if (passwordSettings.requireLowercase) {
      requirements.push({
        type: 'lowercase',
        regex: /[a-z]/,
        message: i18n.language === 'th' ? 'ตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว' : 'At least 1 lowercase letter',
        isValid: /[a-z]/.test(formData.new_password)
      });
    }

    if (passwordSettings.requireNumbers) {
      requirements.push({
        type: 'numbers',
        regex: /[0-9]/,
        message: i18n.language === 'th' ? 'ตัวเลขอย่างน้อย 1 ตัว' : 'At least 1 number',
        isValid: /[0-9]/.test(formData.new_password)
      });
    }

    if (passwordSettings.requireSpecialChars) {
      requirements.push({
        type: 'special',
        regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        message: i18n.language === 'th' ? 'อักขระพิเศษอย่างน้อย 1 ตัว' : 'At least 1 special character',
        isValid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.new_password)
      });
    }

    setPasswordRequirements(requirements);
  };

  const allRequirementsMet = passwordRequirements.length === 0 || passwordRequirements.every(req => req.isValid);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = [];

    if (isOwnPassword && !formData.current_password) {
      newErrors.push(i18n.language === 'th' ? 'กรุณาระบุรหัสผ่านปัจจุบัน' : t("auth.currentPasswordRequired"));
    }

    if (!formData.new_password) {
      newErrors.push(i18n.language === 'th' ? 'กรุณาระบุรหัสผ่านใหม่' : t("auth.newPasswordRequired"));
    }

    if (formData.new_password !== formData.confirm_password) {
      newErrors.push(i18n.language === 'th' ? 'รหัสผ่านไม่ตรงกัน' : t("auth.passwordMismatch"));
    }

    if (!allRequirementsMet) {
      newErrors.push(i18n.language === 'th' ? 'รหัสผ่านไม่ตรงตามเกณฑ์' : t("auth.passwordTooWeak"));
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const requestData: any = {
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
        change_reason: isOwnPassword ? 'Self-initiated password change' : 'Admin-forced password change'
      };

      if (isOwnPassword) {
        requestData.current_password = formData.current_password;
      }

      if (!isOwnPassword && targetEmployeeId) {
        requestData.employee_id = targetEmployeeId;
      }

      const response = await api.post('/auth-change-password', requestData);

      if (response.data.success) {
        setSuccess(true);
        setErrors([]);

        if (isOwnPassword) {
          completePasswordChange();
        }

        // Reset form
        setFormData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });

        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error: any) {
      logger.error('Password change error:', error);

      // Handle different error response formats
      let newErrors: string[];

      try {
        if (error.response?.data) {
          const errorData = error.response.data;
          logger.log('Error data:', errorData);

          // Check if errors is an array of strings
          if (Array.isArray(errorData.errors)) {
            newErrors = errorData.errors.filter((err: any) => typeof err === 'string');
          }
          // Check if message is a string
          else if (typeof errorData.message === 'string') {
            newErrors = [errorData.message];
          }
          // Handle case where the entire response is stringified
          else if (typeof errorData.message === 'object') {
            // This happens when errorResponse is called with an object instead of a string
            if (errorData.message.errors && Array.isArray(errorData.message.errors)) {
              newErrors = errorData.message.errors.filter((err: any) => typeof err === 'string');
            } else if (errorData.message.message && typeof errorData.message.message === 'string') {
              newErrors = [errorData.message.message];
            } else {
              newErrors = [t("auth.operationFailed")];
            }
          }
          // Fallback: try to stringify any other format
          else {
            newErrors = [JSON.stringify(errorData).substring(0, 100)];
          }
        } else {
          // Network errors or other issues
          newErrors = [error.message || t("auth.operationFailed")];
        }
      } catch (parsingError) {
        logger.error('Error parsing error response:', parsingError);
        newErrors = [t("auth.operationFailed")];
      }

      // Ensure all errors are strings
      setErrors(newErrors.map(err => typeof err === 'string' ? err : JSON.stringify(err)));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isForced
              ? (i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password')
              : (isOwnPassword
                ? (i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password')
                : (i18n.language === 'th' ? `เปลี่ยนรหัสผ่าน: ${targetEmployeeName}` : `Change Password: ${targetEmployeeName}`)
              )
            }
          </h2>
          {!isForced && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Warning Message for Forced Change */}
        {isForced && (
          <div className="p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  {i18n.language === 'th' ? 'ต้องเปลี่ยนรหัสผ่าน' : 'Password Change Required'}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {i18n.language === 'th'
                    ? 'คุณต้องเปลี่ยนรหัสผ่านก่อนจึงจะสามารถใช้งานระบบได้'
                    : 'You must change your password before you can continue using the system.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Current Password */}
          {isOwnPassword && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'th' ? 'รหัสผ่านปัจจุบัน' : 'Current Password'}
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.current_password}
                  onChange={(e) => handleInputChange('current_password', e.target.value)}
                  placeholder={i18n.language === 'th' ? 'เลขบัตรประชาชน' : 'National ID'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {i18n.language === 'th' ? 'รหัสผ่านใหม่' : 'New Password'}
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={formData.new_password}
                onChange={(e) => handleInputChange('new_password', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {i18n.language === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm New Password'}
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={formData.confirm_password}
                onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          {passwordSettings && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'th' ? 'เกณฑ์รหัสผ่าน:' : 'Password Requirements:'}
              </p>
              <div className="space-y-2">
                {passwordRequirements.length > 0 ? (
                  passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {req.isValid ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                      )}
                      <span className={req.isValid ? 'text-green-700' : 'text-gray-600'}>
                        {req.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>
                      {i18n.language === 'th'
                        ? 'ไม่มีเกณฑ์พิเศษ (ต้องมีความยาวตามที่กำหนดเท่านั้น)'
                        : 'No special character requirements (only minimum length applies)'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-700 font-medium">
                  {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จ' : 'Password changed successfully'}
                </p>
              </div>
              <p className="text-sm text-green-600 mt-1">
                {i18n.language === 'th' ? 'กำลังปิดหน้าต่าง...' : 'Closing window...'}
              </p>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-red-700">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </p>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isForced && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading || success}
              >
                {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              disabled={isLoading || success || !allRequirementsMet}
            >
              {success
                ? (i18n.language === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จ' : 'Success!')
                : isLoading
                  ? (i18n.language === 'th' ? 'กำลังเปลี่ยน...' : 'Changing...')
                  : (i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
