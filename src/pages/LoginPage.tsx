import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { LanguageSwitcher } from '../components/language/LanguageSwitcher';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { User, CreditCard, X, Building2, MessageCircleMore } from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';
import { getLineLoginStatus, LineLoginStatus } from '../api/lineAuth';
import {
  beginLineLogin,
  cleanupLineLoginCallbackUrl,
  clearLineLoginPending,
  getLineIdToken,
  hasRecentLineLoginPending,
  isStandalonePwa,
  isLineLoginCallbackUrl,
} from '../utils/line-liff';

// Branding type from public API
interface PublicBranding {
  company_name_th: string;
  company_name_en: string;
  logo: {
    type: 'icon' | 'image';
    imagePath?: string;
    iconName?: string;
    backgroundColor?: string;
  } | null;
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { deviceType, isMobile, isTablet } = useDevice();

  const [formData, setFormData] = useState({
    code: '', // Unified input for both employee_code and scan_code
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [hasRememberedCode, setHasRememberedCode] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isLineLoading, setIsLineLoading] = useState(false);
  const [lineStatus, setLineStatus] = useState<LineLoginStatus>({
    enabled: false,
    ready: false,
    liffId: null,
    channelId: null,
  });
  const [lineStatusLoaded, setLineStatusLoaded] = useState(false);
  const isResumingLineLoginRef = useRef(false);

  // Branding state - fetched from public API (no auth required)
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  // Fetch branding from public API (no auth required)
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch('/.netlify/functions/branding-public');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.branding) {
            setBranding(data.branding);
          }
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
      }
    };
    fetchBranding();
  }, []);

  useEffect(() => {
    const fetchLineStatus = async () => {
      try {
        const status = await getLineLoginStatus();
        setLineStatus(status);
      } catch (error) {
        console.error('Failed to fetch LINE login status:', error);
      } finally {
        setLineStatusLoaded(true);
      }
    };

    fetchLineStatus();
  }, []);

  // Get logo URL from branding
  const logoUrl = branding?.logo?.type === 'image' ? branding.logo.imagePath : null;

  // Load remembered employee code on component mount
  useEffect(() => {
    try {
      // Clean up any test data that might interfere
      if (localStorage.getItem('rememberedEmployeeCode') === 'TEST_CODE_12345') {
        localStorage.removeItem('rememberedEmployeeCode');
      }

      const rememberedCode = localStorage.getItem('rememberedEmployeeCode');

      if (rememberedCode && rememberedCode.trim() !== '') {
        setFormData(prev => ({ ...prev, code: rememberedCode.trim() }));
        setRememberMe(true);
        setHasRememberedCode(true);
      }
    } catch (error) {
      console.error('Error loading remembered employee code:', error);
    }
  }, []);

  // Clear remembered employee code
  const clearRememberedCode = () => {
    try {
      localStorage.removeItem('rememberedEmployeeCode');
      setFormData(prev => ({ ...prev, code: '' }));
      setRememberMe(false);
      setHasRememberedCode(false);
    } catch (error) {
      console.error('Error clearing remembered employee code:', error);
    }
  };

  const resumeLineLogin = useCallback(async () => {
    if (!lineStatusLoaded || !lineStatus.ready || !lineStatus.liffId || isResumingLineLoginRef.current) {
      return;
    }

    const shouldResume = isLineLoginCallbackUrl() || hasRecentLineLoginPending();
    if (!shouldResume) {
      clearLineLoginPending();
      return;
    }

    isResumingLineLoginRef.current = true;
    setError('');
    setIsLineLoading(true);

    try {
      const idToken = await getLineIdToken(lineStatus.liffId);
      await login({ line_id_token: idToken });
      clearLineLoginPending();
      cleanupLineLoginCallbackUrl();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      clearLineLoginPending();
      cleanupLineLoginCallbackUrl();
      setError(err.message || 'LINE login failed');
    } finally {
      isResumingLineLoginRef.current = false;
      setIsLineLoading(false);
    }
  }, [lineStatusLoaded, lineStatus.ready, lineStatus.liffId, login, navigate]);

  useEffect(() => {
    if (!lineStatusLoaded || !lineStatus.ready || !lineStatus.liffId) {
      return;
    }

    void resumeLineLogin();

    const handleAppResume = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      void resumeLineLogin();
    };

    window.addEventListener('focus', handleAppResume);
    window.addEventListener('pageshow', handleAppResume);
    document.addEventListener('visibilitychange', handleAppResume);

    return () => {
      window.removeEventListener('focus', handleAppResume);
      window.removeEventListener('pageshow', handleAppResume);
      document.removeEventListener('visibilitychange', handleAppResume);
    };
  }, [lineStatusLoaded, lineStatus.ready, lineStatus.liffId, resumeLineLogin]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Let the backend determine if it's an employee code or scan code
      // Send both fields and let the auth function handle the logic
      await login({
        employee_code: formData.code,
        scan_code: formData.code,
        password: formData.password,
      });

      // Save remembered code if checkbox is checked and code is provided
      if (rememberMe && formData.code && formData.code.trim() !== '') {
        try {
          localStorage.setItem('rememberedEmployeeCode', formData.code.trim());
        } catch (error) {
          console.error('Error saving remembered employee code:', error);
        }
      } else if (!rememberMe) {
        // Clear remembered code if checkbox is unchecked
        clearRememberedCode();
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || t('auth.loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLineLogin = async () => {
    if (!lineStatus.ready || !lineStatus.liffId) {
      setError(
        i18n.language === 'th'
          ? 'LINE Login ยังไม่พร้อมใช้งานในขณะนี้'
          : 'LINE Login is not available right now'
      );
      return;
    }

    setError('');
    setIsLineLoading(true);

    try {
      const result = await beginLineLogin(lineStatus.liffId);

      if (result.redirected) {
        if (isStandalonePwa()) {
          window.setTimeout(() => {
            setIsLineLoading(false);
          }, 1500);
        }
        return;
      }

      if (!result.idToken) {
        throw new Error('LINE identity token is invalid or expired');
      }

      await login({ line_id_token: result.idToken });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'LINE login failed');
      clearLineLoginPending();
      setIsLineLoading(false);
    }
  };

  const isFormBusy = isLoading;
  const isLineBusy = isLoading || isLineLoading;
  const lineButtonLabel = i18n.language === 'th' ? 'LINE Login' : 'LINE Login';
  const isStandaloneMode = isStandalonePwa();
  const lineHintText = (() => {
    if (!lineStatusLoaded) {
      return i18n.language === 'th'
        ? 'กำลังตรวจสอบการเชื่อมต่อ LINE'
        : 'Checking LINE login availability';
    }

    if (!lineStatus.enabled) {
      return i18n.language === 'th'
        ? 'LINE Login ถูกปิดอยู่ในขณะนี้'
        : 'LINE Login is currently disabled';
    }

    if (!lineStatus.ready) {
      return lineStatus.message ||
        (i18n.language === 'th'
          ? 'LINE Login ยังตั้งค่าไม่ครบ'
          : 'LINE Login is not configured yet');
    }

    if (deviceType === 'desktop') {
      return i18n.language === 'th'
        ? 'สำหรับคอมพิวเตอร์ ระบบจะพาไปยืนยันตัวตนกับ LINE ในเบราว์เซอร์'
        : 'Desktop browsers will continue to LINE for authentication';
    }

    return i18n.language === 'th'
      ? 'รองรับมือถือ แท็บเล็ต และ PWA ที่ติดตั้งไว้'
      : 'Works on mobile, tablet, and installed PWA';
  })();
  const lineResumeText = isStandaloneMode
    ? (
        i18n.language === 'th'
          ? 'หลังยืนยันตัวตนใน LINE แล้ว ให้กลับมาที่แอปนี้ ระบบจะเข้าสู่ระบบให้อัตโนมัติ'
          : 'After confirming in LINE, return to this app and we will sign you in automatically'
      )
    : (
        i18n.language === 'th'
          ? 'หากระบบพาไปหน้า LINE กรุณายืนยันตัวตนให้เสร็จ แล้วระบบจะพากลับมาเอง'
          : 'If LINE opens, finish authentication there and the app will continue automatically'
      );


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className={`w-full ${isMobile ? 'max-w-full' : isTablet ? 'max-w-lg' : 'max-w-md'}`}>
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        {/* Login Card */}
        <div className={`bg-white rounded-2xl shadow-xl ${isMobile ? 'p-8' : 'p-10'}`}>
          {/* Header */}
          <div className="text-center mb-10">
            {/* Company Logo */}
            <div className="flex items-center justify-center mb-6">
              {logoUrl && !logoError ? (
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  className="w-32 h-32 object-contain"
                  onError={() => {
                    console.warn('Failed to load company logo from URL');
                    setLogoError(true);
                  }}
                />
              ) : (
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('auth.login')}
            </h1>
          </div>


          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Code Input */}
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
                  inputMode="numeric"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value });
                    if (hasRememberedCode && e.target.value !== localStorage.getItem('rememberedEmployeeCode')) {
                      setRememberMe(false);
                      setHasRememberedCode(false);
                    }
                  }}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={i18n.language === 'th' ? 'กรอกรหัส ERP หรือ รหัสเครื่องสแกนนิ้วมือ' : 'Enter ERP code or fingerprint scanner code'}
                  required
                  disabled={isFormBusy}
                />
                {hasRememberedCode && (
                  <button
                    type="button"
                    onClick={clearRememberedCode}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    title={i18n.language === 'th' ? 'ลบรหัสที่จดจำ' : 'Clear'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {i18n.language === 'th'
                  ? 'ใช้ได้ทั้งรหัส ERP และรหัสจากเครื่องสแกนนิ้วมือ'
                  : 'You can sign in with either your ERP code or fingerprint scanner code.'}
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'th' ? 'รหัสผ่าน' : 'Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={i18n.language === 'th' ? 'รหัสผ่าน' : 'Password'}
                  required
                  disabled={isFormBusy}
                />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isFormBusy}
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                {i18n.language === 'th' ? 'จดจำรหัสที่ใช้เข้าสู่ระบบ' : 'Remember login code'}
              </label>
            </div>

            {/* Forgot Password Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                disabled={isFormBusy}
              >
                {i18n.language === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot Password?'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isFormBusy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('common.loading')}
                </>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="text-sm text-gray-400">{i18n.language === 'th' ? 'หรือ' : 'or'}</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <button
            type="button"
            onClick={handleLineLogin}
            disabled={isLineBusy || !lineStatus.ready}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#06c755] text-white font-medium rounded-lg hover:bg-[#05ad4a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#06c755] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLineLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {t('common.loading')}
              </>
            ) : (
              <>
                <MessageCircleMore className="h-5 w-5" />
                {lineButtonLabel}
              </>
            )}
          </button>

          <p className="mt-3 text-center text-sm text-gray-500">{lineHintText}</p>
          {isLineLoading && (
            <p className="mt-2 text-center text-sm text-[#06c755]">{lineResumeText}</p>
          )}
        </div>

        {/* Forgot Password Modal */}
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          © 2025 {i18n.language === 'th'
            ? (branding?.company_name_th || 'SSTH')
            : (branding?.company_name_en || 'SSTH')}
        </div>
      </div>
    </div>
  );
}
