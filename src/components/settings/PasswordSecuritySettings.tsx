import { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { Shield, Key, Clock, AlertTriangle, Play, Database } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';

interface PasswordSettings {
  forcePasswordChangeOnFirstLogin: boolean;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays: number;
}

export function PasswordSecuritySettings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast, showModal } = useToast();

  const [settings, setSettings] = useState<PasswordSettings>({
    forcePasswordChangeOnFirstLogin: false,
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    expiryDays: 90,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [migrationRunning, setMigrationRunning] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/auth-password-settings');
      logger.log('🔐 [SETTINGS] Raw response:', response);
      logger.log('🔐 [SETTINGS] Response data:', response.data);

      if (response.data.success && response.data.settings) {
        logger.log('🔐 [SETTINGS] Settings found:', response.data.settings);
        setSettings(response.data.settings);
      } else {
        logger.error('❌ Invalid response structure:', response.data);
        setErrors([response.data.message || 'Failed to load settings']);
      }
    } catch (error) {
      logger.error('Error loading password settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);

    try {
      // Validate settings
      const newErrors: string[] = [];

      if (settings.minLength < 4) {
        newErrors.push(i18n.language === 'th' ? 'ความยาวรหัสผ่านต้องอย่างน้อย 4 ตัวอักษร' : 'Minimum password length must be at least 4 characters');
      }

      if (settings.minLength > 50) {
        newErrors.push(i18n.language === 'th' ? 'ความยาวรหัสผ่านต้องไม่เกิน 50 ตัวอักษร' : 'Maximum password length is 50 characters');
      }

      if (settings.expiryDays < 0 || settings.expiryDays > 365) {
        newErrors.push(i18n.language === 'th' ? 'ระยะเวลาหมดอายุต้องอยู่ระหว่าง 0-365 วัน' : 'Password expiry must be between 0-365 days');
      }

      // Password requirements validation removed - allow all requirements to be disabled
      // This gives administrators flexibility to set minimal password policies

      if (newErrors.length > 0) {
        setErrors(newErrors);
        setSaving(false);
        return;
      }

      logger.log('🔐 [SETTINGS] Saving password settings:', settings);
      const response = await api.post('/auth-password-settings', settings);
      logger.log('🔐 [SETTINGS] Save response:', response);

      if (response.data.success) {
        logger.log('🔐 [SETTINGS] Settings saved successfully, updating local state with:', response.data.settings);
        showToast(i18n.language === 'th' ? 'บันทึกการตั้งค่าสำเร็จ' : 'Settings saved successfully', 'success');
        setSettings(response.data.settings);
      } else {
        logger.log('🔐 [SETTINGS] Save failed:', response.data);
        setErrors([response.data.message || 'Failed to save settings']);
      }
    } catch (error: any) {
      logger.error('Error saving password settings:', error);
      setErrors([error.response?.data?.message || error.message || 'Failed to save settings']);
    } finally {
      setSaving(false);
    }
  };

  const runMigration = async () => {
    const confirmed = await showModal('confirm', i18n.language === 'th' ? 'ยืนยันการรัน Migration' : 'Confirm Migration', {
      message: i18n.language === 'th'
        ? 'คุณต้องการรัน migration เพื่อเพิ่มฟีเจอร์ความปลอดภัยรหัสผ่านหรือไม่?'
        : 'Do you want to run the migration to add password security features?',
      confirmText: i18n.language === 'th' ? 'รัน Migration' : 'Run Migration',
      cancelText: t('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    setMigrationRunning(true);
    try {
      const response = await api.post('/admin-run-migration');
      if (response.data.success) {
        showToast(i18n.language === 'th' ? 'Migration สำเร็จ!' : 'Migration completed successfully!', 'success');
        // Reload settings to get default values
        await loadSettings();
      } else {
        showToast(response.data.message || (i18n.language === 'th' ? 'Migration ล้มเหลว' : 'Migration failed'), 'error');
      }
    } catch (error: any) {
      logger.error('Migration error:', error);
      showToast(i18n.language === 'th' ? 'Migration ล้มเหลว: ' + (error.response?.data?.message || error.message) : 'Migration failed: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setMigrationRunning(false);
    }
  };

  const initSettings = async () => {
    const confirmed = await showModal('confirm', i18n.language === 'th' ? 'ยืนยันการตั้งค่าเริ่มต้น' : 'Confirm Initialization', {
      message: i18n.language === 'th'
        ? 'คุณต้องการเริ่มต้นการตั้งค่าบริษัทหรือไม่?'
        : 'Do you want to initialize company settings?',
      confirmText: i18n.language === 'th' ? 'เริ่มต้นค่า' : 'Initialize',
      cancelText: t('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    setMigrationRunning(true);
    try {
      const response = await api.post('/admin-init-settings');
      if (response.data.success) {
        showToast(i18n.language === 'th' ? 'เริ่มต้นการตั้งค่าสำเร็จ!' : 'Settings initialized successfully!', 'success');
        // Reload settings to get default values
        await loadSettings();
      } else {
        showToast(response.data.message || (i18n.language === 'th' ? 'เริ่มต้นการตั้งค่าล้มเหลว' : 'Settings initialization failed'), 'error');
      }
    } catch (error: any) {
      logger.error('Settings initialization error:', error);
      showToast(i18n.language === 'th' ? 'เริ่มต้นการตั้งค่าล้มเหลว: ' + (error.response?.data?.message || error.message) : 'Settings initialization failed: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setMigrationRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Development Indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                {i18n.language === 'th' ? 'โหมดพัฒนา' : 'Development Mode'}
              </p>
              <p className="text-sm text-amber-700 mt-1">
                {i18n.language === 'th'
                  ? 'คุณกำลังอยู่ในโหมดพัฒนา การเปลี่ยนแปลงจะส่งผลต่อฐานข้อมูลจริง'
                  : 'You are in development mode. Changes will affect the real database.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-700">
              {error}
            </p>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            {i18n.language === 'th' ? 'การตั้งค่าความปลอดภัยรหัสผ่าน' : 'Password Security Settings'}
          </h2>
        </div>

        {/* Admin Buttons - Only for admins in development */}
        {user?.role === 'admin' && process.env.NODE_ENV === 'development' && (
          <div className="flex gap-2">
            <button
              onClick={initSettings}
              disabled={migrationRunning}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {migrationRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {i18n.language === 'th' ? 'กำลัง...' : 'Running...'}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  {i18n.language === 'th' ? 'เริ่มต้นค่า' : 'Init Settings'}
                </>
              )}
            </button>
            <button
              onClick={runMigration}
              disabled={migrationRunning}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
            >
              {migrationRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {i18n.language === 'th' ? 'กำลังรัน...' : 'Running...'}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <Play className="w-4 h-4" />
                  {i18n.language === 'th' ? 'รัน Migration' : 'Run Migration'}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* First Login Policy */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-gray-600" />
          {i18n.language === 'th' ? 'นโยบายการเข้าสู่ระบบครั้งแรก' : 'First Login Policy'}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                {i18n.language === 'th'
                  ? 'บังคับให้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก'
                  : 'Force password change on first login'
                }
              </label>
              <p className="text-sm text-gray-500 mt-1">
                {i18n.language === 'th'
                  ? 'พนักงานใหม่จะต้องเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก'
                  : 'New employees must change their password on first login'
                }
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.forcePasswordChangeOnFirstLogin}
                onChange={(e) => setSettings(prev => ({ ...prev, forcePasswordChangeOnFirstLogin: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Password Requirements */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {i18n.language === 'th' ? 'เกณฑ์รหัสผ่าน' : 'Password Requirements'}
        </h3>

        <div className="space-y-4">
          {/* Minimum Length */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {i18n.language === 'th' ? 'ความยาวขั้นต่ำ' : 'Minimum Length'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="4"
                max="50"
                value={settings.minLength}
                onChange={(e) => setSettings(prev => ({ ...prev, minLength: parseInt(e.target.value) || 8 }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600">
                {i18n.language === 'th' ? 'ตัวอักษร' : 'characters'}
              </span>
            </div>
          </div>

          {/* Character Requirements */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              {i18n.language === 'th' ? 'ต้องมีอักขระ' : 'Must contain'}
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireUppercase}
                  onChange={(e) => setSettings(prev => ({ ...prev, requireUppercase: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {i18n.language === 'th' ? 'ตัวอักษรพิมพ์ใหญ่ (A-Z)' : 'Uppercase letters (A-Z)'}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireLowercase}
                  onChange={(e) => setSettings(prev => ({ ...prev, requireLowercase: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {i18n.language === 'th' ? 'ตัวอักษรพิมพ์เล็ก (a-z)' : 'Lowercase letters (a-z)'}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireNumbers}
                  onChange={(e) => setSettings(prev => ({ ...prev, requireNumbers: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {i18n.language === 'th' ? 'ตัวเลข (0-9)' : 'Numbers (0-9)'}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireSpecialChars}
                  onChange={(e) => setSettings(prev => ({ ...prev, requireSpecialChars: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {i18n.language === 'th' ? 'อักขระพิเศษ (!@#$%^&* etc.)' : 'Special characters (!@#$%^&* etc.)'}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Password Expiry */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          {i18n.language === 'th' ? 'การหมดอายุรหัสผ่าน' : 'Password Expiry'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {i18n.language === 'th' ? 'ระยะเวลาหมดอายุ' : 'Password expires after'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="365"
                value={settings.expiryDays}
                onChange={(e) => setSettings(prev => ({ ...prev, expiryDays: parseInt(e.target.value) || 90 }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600">
                {i18n.language === 'th' ? 'วัน (0 = ไม่หมดอายุ)' : 'days (0 = never expires)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {i18n.language === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
            </>
          ) : (
            <>
              {i18n.language === 'th' ? 'บันทึกการตั้งค่า' : 'Save Settings'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}