import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, X, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface UserPreferenceData {
  rememberedEmployeeCode: string | null;
  language: string;
}

export function UserPreferences() {
  const { t, i18n } = useTranslation();
  const { showModal } = useToast();

  const [preferences, setPreferences] = useState<UserPreferenceData>({
    rememberedEmployeeCode: null,
    language: i18n.language
  });

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const loadPreferences = () => {
    try {
      const rememberedCode = localStorage.getItem('rememberedEmployeeCode');
      const currentLanguage = localStorage.getItem('language') || 'th';

      setPreferences({
        rememberedEmployeeCode: rememberedCode,
        language: currentLanguage
      });
    } catch (error) {
      console.error('Error loading preferences:', error);
      showMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const clearRememberedCode = () => {
    try {
      localStorage.removeItem('rememberedEmployeeCode');
      setPreferences(prev => ({ ...prev, rememberedEmployeeCode: null }));
      showMessage('ลบรหัสพนักงานที่จดจำเรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('Error clearing remembered code:', error);
      showMessage('เกิดข้อผิดพลาดในการลบรหัส', 'error');
    }
  };

  const clearAllData = async () => {
    const confirmed = await showModal('confirm', i18n.language === 'th' ? 'ยืนยันการลบข้อมูล' : 'Confirm Clear Data', {
      message: i18n.language === 'th'
        ? 'คุณแน่ใจว่าจะลบข้อมูลทั้งหมดหรือไม่? รหัสพนักงานที่จดจำ และการตั้งค่าอื่นๆ จะถูกลบทั้งหมด'
        : 'Are you sure you want to clear all data? This will remove remembered employee codes and other preferences.',
      confirmText: i18n.language === 'th' ? 'ลบข้อมูล' : 'Clear Data',
      cancelText: t('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    try {
      // Clear specific application data
      localStorage.removeItem('rememberedEmployeeCode');
      localStorage.removeItem('language');

      setPreferences({
        rememberedEmployeeCode: null,
        language: 'th'
      });

      showMessage('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('Error clearing all data:', error);
      showMessage('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <User className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">
          {i18n.language === 'th' ? 'การตั้งค่าผู้ใช้' : 'User Preferences'}
        </h2>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`p-4 rounded-lg border ${messageType === 'success'
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-5 h-5 ${messageType === 'success' ? 'text-green-600' : 'text-red-600'
              }`} />
            <p className={`text-sm ${messageType === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
              {message}
            </p>
          </div>
        </div>
      )}

      {/* Current Preferences */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {i18n.language === 'th' ? 'ข้อมูลที่จัดเก็บ' : 'Stored Information'}
        </h3>

        <div className="space-y-4">
          {/* Remembered Employee Code */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">
                {i18n.language === 'th' ? 'รหัสพนักงานที่จดจำ' : 'Remembered Employee Code'}
              </p>
              <p className="text-sm text-gray-600">
                {preferences.rememberedEmployeeCode ? (
                  <>
                    {i18n.language === 'th' ? 'จดจำอยู่: ' : 'Currently remembered: '}
                    <span className="font-mono font-semibold text-blue-600">
                      {preferences.rememberedEmployeeCode}
                    </span>
                  </>
                ) : (
                  i18n.language === 'th' ? 'ไม่มีรหัสพนักงานที่จดจำ' : 'No remembered employee code'
                )}
              </p>
            </div>
            {preferences.rememberedEmployeeCode && (
              <button
                onClick={clearRememberedCode}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
              >
                <X className="w-4 h-4" />
                {i18n.language === 'th' ? 'ลบ' : 'Clear'}
              </button>
            )}
          </div>

          {/* Language Preference */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">
                {i18n.language === 'th' ? 'ภาษาที่ใช้' : 'Language Preference'}
              </p>
              <p className="text-sm text-gray-600">
                {i18n.language === 'th' ? 'ภาษาปัจจุบัน: ' : 'Current language: '}
                <span className="font-semibold">
                  {preferences.language === 'th' ? 'ไทย' : 'English'}
                </span>
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {i18n.language === 'th' ? 'จัดการผ่านหน้าหลัก' : 'Managed via main page'}
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {i18n.language === 'th' ? 'การจัดการข้อมูล' : 'Data Management'}
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  {i18n.language === 'th' ? 'ข้อมูลที่เก็บไว้' : 'About Stored Data'}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {i18n.language === 'th'
                    ? 'ระบบจัดเก็บเฉพาะข้อมูลที่จำเป็นสำคัญเพื่อความสะดวก เช่น รหัสพนักงานและการตั้งค่าภาษา ข้อมูลเหล่านี้จัดเก็บในเบราว์เซอร์ของคุณเท่านั้น'
                    : 'The system only stores essential data for convenience, such as your employee code and language preferences. This data is stored only in your browser.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={clearAllData}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
              {i18n.language === 'th' ? 'ลบข้อมูลทั้งหมด' : 'Clear All Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">
              {i18n.language === 'th' ? 'ข้อมูลส่วนตัวและความปลอดภัย' : 'Privacy & Security'}
            </p>
            <p className="text-sm text-blue-700 mt-1">
              {i18n.language === 'th'
                ? 'รหัสผ่านของคุณไม่มีว่าจัดเก็บไว้ในระบบ ระบบจะจำเฉพาะรหัสพนักงานเพื่อความสะดวกในการเข้าสู่ระบบ คุณสามารถลบข้อมูลที่จดจำได้ตลอดเวลา'
                : 'Your password is never stored in the system. Only your employee code is remembered for login convenience. You can clear remembered data at any time.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
