// src/pages/SettingsPage.tsx
import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings as SettingsIcon,
  Building2,
  Palette,
  Save,
  Upload,
  FileText,
  Calendar,
  Shield,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { updateSettings, Settings } from '../api/settings';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { DepartmentManagement } from '../components/settings/DepartmentManagement';
import { LeavePolicyPage } from '../components/settings/LeavePolicyPage';  // ✅ ใช้ชื่อ export จริง
import { CompanyHolidaysCalendar } from '../components/holidays/CompanyHolidaysCalendar';
import { PasswordSecuritySettings } from '../components/settings/PasswordSecuritySettings';
import { UserPreferences } from '../components/settings/UserPreferences';
import { WarningSystemSettings } from '../components/warning/WarningSystemSettings';
import { SignatureSettings } from '../components/settings/SignatureSettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { FiscalSettingsCard } from '../components/settings/FiscalSettingsCard';
import { ManufacturingLineManagement } from '../components/settings/ManufacturingLineManagement';
import { LineLeaderAssignment } from '../components/settings/LineLeaderAssignment';
import { AIBotTestSettings } from '../components/settings/AIBotTestSettings';
import { DevAnnouncementCard } from '../components/settings/DevAnnouncementCard';
import { User, PenTool, Bell } from 'lucide-react';
import * as Icons from 'lucide-react';
import { uploadCompanyLogo } from '../utils/supabaseUpload';
import { useDevice } from '../contexts/DeviceContext';

type SettingsTab = 'company' | 'branding' | 'departments' | 'lines' | 'line-assignments' | 'leave-policy' | 'holidays' | 'fiscal-year' | 'password-security' | 'user-preferences' | 'warning-system' | 'signature' | 'notifications' | 'ai-bot';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { showToast, showModal } = useToast();
  const { user } = useAuth();
  const { deviceType, isMobile, isTablet } = useDevice();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');

  const { settings: loadedSettings, loading, error, refetch } = useSettings();

  const [settings, setSettings] = useState<Settings>({
    id: '',
    company_name_th: '',
    company_name_en: '',
    working_days_per_week: 5,
    branding_settings: {
      logo: {
        type: 'icon',
        iconName: 'Calendar',
        backgroundColor: '#2563eb',
        width: 64,
        height: 64,
        iconSize: 48,
        rounded: 'lg',
        imagePath: '',
      },
      primaryColor: '#2563eb',
    },
    require_1_year_tenure_for_vacation: false,
    created_at: '',
    updated_at: '',
  });

  useEffect(() => {
    if (loadedSettings) {
      setSettings(loadedSettings);
    }
  }, [loadedSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      logger.log('💾 Saving settings:', settings);
      const result = await updateSettings(settings);
      logger.log('✅ Save successful:', result);
      showToast(t('message.saveSuccess') || 'Settings saved successfully!', 'success');
      refetch(); // Refetch settings to update cache

      // Delay reload to allow user to see success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      logger.error('❌ Save failed:', error);
      logger.error('Error details:', error.response?.data);

      // Better error message
      const errorMsg = error.message || 'Failed to save settings';
      showModal('error', t('message.saveFailed') || 'Failed to Save Settings', {
        message: errorMsg,
        details: [
          '- You have HR or Admin permissions',
          '- All required fields are filled',
          '- Check browser console for details'
        ],
        confirmText: 'OK'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast(t('message.invalidFileType') || 'Please upload an image file', 'warning');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast(t('message.fileTooLarge') || 'File size must be less than 2MB', 'warning');
      return;
    }

    setUploading(true);
    try {
      logger.log('📤 Uploading logo to Supabase...');

      // Upload to Supabase Storage (replaces existing logo with same filename)
      const publicUrl = await uploadCompanyLogo(file);

      logger.log('✅ Logo uploaded:', publicUrl);

      if (!settings.branding_settings) return;

      // Create updated settings object
      const updatedSettings: Settings = {
        ...settings,
        branding_settings: {
          ...settings.branding_settings,
          logo: {
            ...settings.branding_settings.logo,
            type: 'image', // Explicit literal
            imagePath: publicUrl,
          },
        },
      };

      // Update local state
      setSettings(updatedSettings);

      logger.log('💾 Auto-saving logo URL to database...');

      // Automatically save to database
      await updateSettings(updatedSettings);

      logger.log('✅ Logo URL saved to database');

      showToast(t('message.uploadSuccess') || 'Logo uploaded and saved successfully! Page will reload...', 'success');

      // Refetch and reload
      refetch();
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      logger.error('❌ Logo upload error:', error);

      // Check for RLS policy error
      if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
        showModal('error', 'Storage Permission Error', {
          message: 'Please check Supabase bucket policies.',
          details: ['Error: ' + error.message],
          confirmText: 'OK'
        });
      } else {
        showToast('Failed to upload logo: ' + (error.message || 'Unknown error'), 'error');
      }
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  const menuItems = [
    { id: 'company', label: t('settings.tabs.company'), icon: Building2 },
    { id: 'branding', label: t('settings.tabs.branding'), icon: Palette },
    { id: 'departments', label: t('settings.tabs.departments'), icon: SettingsIcon },
    { id: 'lines', label: i18n.language === 'th' ? 'ไลน์การผลิต' : 'Production Lines', icon: Icons.Factory },
    { id: 'line-assignments', label: i18n.language === 'th' ? 'กำหนดหัวหน้าไลน์' : 'Line Assignments', icon: Icons.UserCheck },
    { id: 'leave-policy', label: t('settings.tabs.leavePolicy'), icon: FileText },
    { id: 'holidays', label: t('settings.tabs.holidays'), icon: Calendar },
    { id: 'fiscal-year', label: i18n.language === 'th' ? 'ปีการทำงาน (Fiscal)' : 'Fiscal Year', icon: Calendar },
    { id: 'password-security', label: i18n.language === 'th' ? 'ความปลอดภัยรหัสผ่าน' : 'Password Security', icon: Shield },
    { id: 'user-preferences', label: i18n.language === 'th' ? 'การตั้งค่าผู้ใช้' : 'User Preferences', icon: User },
    { id: 'signature', label: i18n.language === 'th' ? 'ลายเซ็น' : 'E-Signature', icon: PenTool },
    { id: 'notifications', label: i18n.language === 'th' ? 'การแจ้งเตือน' : 'Notifications', icon: Bell },
    { id: 'warning-system', label: i18n.language === 'th' ? 'ระบบใบเตือน' : 'Warning System', icon: AlertCircle },
    // AI Bot tab - DEV only (will be filtered below)
    { id: 'ai-bot', label: i18n.language === 'th' ? 'AI Bot (ทดสอบ)' : 'AI Bot (Test)', icon: Icons.Bot, devOnly: true },
  ].filter(item => !item.devOnly || user?.employee_code === '999999999');

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? 'p-4' : isTablet ? 'p-5' : 'p-6'}`}>
      <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
        <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>
          {t('settings.title')}
        </h1>
        <p className="text-gray-600 mt-1">{t('settings.description')}</p>
      </div>

      <div className={isMobile ? 'space-y-4' : 'flex gap-6'}>
        {/* Mobile: Dropdown Menu */}
        {isMobile ? (
          <div className="bg-white rounded-lg shadow-sm border p-3">
            <div className="relative">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as SettingsTab)}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
              >
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
            </div>
          </div>
        ) : (
          /* Desktop/Tablet: Sidebar Menu */
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as SettingsTab)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1">
          <div className={`bg-white rounded-lg shadow-sm border ${isMobile ? 'p-4' : 'p-6'}`}>
            {/* Company Info Tab */}
            {activeTab === 'company' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">ข้อมูลบริษัท</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.companyNameTh')}
                    </label>
                    <input
                      type="text"
                      value={settings.company_name_th}
                      onChange={(e) => setSettings({ ...settings, company_name_th: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.companyNameEn')}
                    </label>
                    <input
                      type="text"
                      value={settings.company_name_en}
                      onChange={(e) => setSettings({ ...settings, company_name_en: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.workDaysPerWeek')}
                    </label>
                    <select
                      value={settings.working_days_per_week}
                      onChange={(e) => setSettings({ ...settings, working_days_per_week: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={5}>{t('settings.days.5')}</option>
                      <option value={6}>{t('settings.days.6')}</option>
                      <option value={7}>{t('settings.days.7')}</option>
                    </select>
                  </div>

                  {/* Require 1 Year Tenure for Vacation */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {i18n.language === 'th' ? 'ลาพักร้อนต้องทำงานครบ 1 ปี' : 'Require 1 Year Tenure for Vacation Leave'}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {i18n.language === 'th'
                          ? 'พนักงานที่มีอายุงานน้อยกว่า 1 ปีจะไม่สามารถลาพักร้อนได้'
                          : 'Employees with less than 1 year of tenure cannot request vacation/annual leave.'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.require_1_year_tenure_for_vacation || false}
                        onChange={(e) => setSettings({ ...settings, require_1_year_tenure_for_vacation: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              </div>
            )}

            {/* Branding Tab */}
            {activeTab === 'branding' && settings.branding_settings && (
              <div>
                <h2 className="text-xl font-semibold mb-6">โลโก้และสี</h2>

                {/* Preview */}
                <div className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-dashed">
                  <p className="text-sm font-medium text-gray-700 mb-4">
                    ตัวอย่างโลโก้ (Logo Preview):
                    <span className="ml-2 text-blue-600">
                      {settings.branding_settings.logo.type === 'icon' ? '(Using Icon)' : '(Using Image)'}
                    </span>
                  </p>
                  <div className="flex items-center gap-3">
                    {settings.branding_settings.logo.type === 'icon' && settings.branding_settings.logo.iconName ? (
                      <div
                        className="flex items-center justify-center rounded-lg"
                        style={{
                          width: '64px',
                          height: '64px',
                          backgroundColor: settings.branding_settings.logo.backgroundColor,
                        }}
                      >
                        {React.createElement(
                          Icons[settings.branding_settings.logo.iconName as keyof typeof Icons] as any,
                          {
                            className: 'text-white',
                            size: 48,
                          }
                        )}
                      </div>
                    ) : settings.branding_settings.logo.type === 'image' && settings.branding_settings.logo.imagePath ? (
                      <img
                        src={settings.branding_settings.logo.imagePath}
                        alt="Logo"
                        width={64}
                        height={64}
                        className="rounded-lg object-contain border-2 border-gray-200"
                        onError={(e) => {
                          logger.error('Failed to load logo:', settings.branding_settings.logo.imagePath);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : settings.branding_settings.logo.type === 'image' && !settings.branding_settings.logo.imagePath ? (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                        <Icons.Upload className="w-6 h-6 text-gray-400" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Icons.Calendar className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div>
                      <span className="text-xl font-bold text-gray-900 block">
                        {settings.company_name_th}
                      </span>
                      <span className="text-xs text-gray-500">
                        {settings.branding_settings.logo.type === 'image' && !settings.branding_settings.logo.imagePath
                          ? '⚠️ No image uploaded yet'
                          : 'This is how it appears in navbar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logo Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ประเภทโลโก้
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        checked={settings.branding_settings.logo.type === 'icon'}
                        onChange={() => setSettings({
                          ...settings,
                          branding_settings: {
                            ...settings.branding_settings,
                            logo: { ...settings.branding_settings.logo, type: 'icon' }
                          }
                        })}
                        className="mr-2"
                      />
                      ใช้ไอคอน
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        checked={settings.branding_settings.logo.type === 'image'}
                        onChange={() => setSettings({
                          ...settings,
                          branding_settings: {
                            ...settings.branding_settings,
                            logo: { ...settings.branding_settings.logo, type: 'image' }
                          }
                        })}
                        className="mr-2"
                      />
                      ใช้รูปภาพ
                    </label>
                  </div>
                </div>

                {/* Icon Selection */}
                {settings.branding_settings.logo.type === 'icon' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      เลือกไอคอน
                    </label>
                    <select
                      value={settings.branding_settings.logo.iconName}
                      onChange={(e) => setSettings({
                        ...settings,
                        branding_settings: {
                          ...settings.branding_settings,
                          logo: { ...settings.branding_settings.logo, iconName: e.target.value }
                        }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Calendar">Calendar - ปฏิทิน</option>
                      <option value="Building2">Building2 - อาคาร</option>
                      <option value="Briefcase">Briefcase - กระเป๋า</option>
                      <option value="Home">Home - บ้าน</option>
                      <option value="Shield">Shield - โล่</option>
                      <option value="Clock">Clock - นาฬิกา</option>
                      <option value="Users">Users - ผู้ใช้</option>
                    </select>
                  </div>
                )}

                {/* Image Upload */}
                {settings.branding_settings.logo.type === 'image' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      อัปโหลดโลโก้ (Upload Logo)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                      disabled={uploading}
                    />
                    <div className="flex items-center gap-4 mb-4">
                      <label
                        htmlFor="logo-upload"
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
                          }`}
                      >
                        <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                        {uploading ? 'กำลังอัปโหลด... (Uploading...)' : 'เลือกไฟล์ (Select File)'}
                      </label>

                      {/* Thumbnail Preview */}
                      {settings.branding_settings.logo.imagePath ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <img
                            src={settings.branding_settings.logo.imagePath}
                            alt="Logo preview"
                            className="w-12 h-12 object-contain rounded border border-gray-200 bg-white"
                            onError={(e) => {
                              logger.error('Failed to load thumbnail:', settings.branding_settings.logo.imagePath);
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect fill="%23ddd" width="48" height="48"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="text-sm">
                            <p className="text-green-700 font-medium">✓ Image logo active</p>
                            <p className="text-green-600 text-xs truncate max-w-xs">
                              {settings.branding_settings.logo.imagePath.split('/').pop()}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="w-12 h-12 rounded border-2 border-dashed border-yellow-400 flex items-center justify-center bg-white">
                            <Icons.AlertCircle className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div className="text-sm">
                            <p className="text-yellow-700 font-medium">⚠ No image uploaded</p>
                            <p className="text-yellow-600 text-xs">Upload or paste URL above</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alternative: Paste Logo URL */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        หรือวาง URL โลโก้ (Or paste logo URL from Supabase)
                      </label>
                      <input
                        type="text"
                        placeholder="https://xxx.supabase.co/storage/v1/object/public/company-logos/..."
                        value={settings.branding_settings.logo.imagePath || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          branding_settings: {
                            ...settings.branding_settings,
                            logo: {
                              ...settings.branding_settings.logo,
                              imagePath: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        💡 Tip: Get URL from Supabase Dashboard → Storage → company-logos → Click file → Copy URL
                      </p>
                    </div>
                  </div>
                )}

                {/* Background Color */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    สีพื้นหลังโลโก้
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={settings.branding_settings.logo.backgroundColor}
                      onChange={(e) => setSettings({
                        ...settings,
                        branding_settings: {
                          ...settings.branding_settings,
                          logo: { ...settings.branding_settings.logo, backgroundColor: e.target.value }
                        }
                      })}
                      className="w-20 h-12 border rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.branding_settings.logo.backgroundColor}
                      onChange={(e) => setSettings({
                        ...settings,
                        branding_settings: {
                          ...settings.branding_settings,
                          logo: { ...settings.branding_settings.logo, backgroundColor: e.target.value }
                        }
                      })}
                      className="flex-1 px-4 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </div>
            )}

            {/* Departments Tab */}
            {activeTab === 'departments' && (
              <DepartmentManagement />
            )}

            {/* Production Lines Tab */}
            {activeTab === 'lines' && (
              <ManufacturingLineManagement />
            )}

            {/* Leave Policy Tab */}
            {activeTab === 'leave-policy' && (
              <LeavePolicyPage />
            )}

            {/* Holidays Tab */}
            {activeTab === 'holidays' && (
              <CompanyHolidaysCalendar />
            )}

            {/* Fiscal Year Settings Tab */}
            {activeTab === 'fiscal-year' && (
              <FiscalSettingsCard />
            )}

            {/* Password Security Tab */}
            {activeTab === 'password-security' && (
              <PasswordSecuritySettings />
            )}

            {/* User Preferences Tab */}
            {activeTab === 'user-preferences' && (
              <UserPreferences />
            )}

            {/* Warning System Tab */}
            {activeTab === 'warning-system' && (
              <WarningSystemSettings />
            )}

            {/* Signature Settings Tab */}
            {activeTab === 'signature' && (
              <SignatureSettings />
            )}

            {/* Notification Settings Tab */}
            {activeTab === 'notifications' && (
              <NotificationSettings />
            )}

            {/* AI Bot Test Settings Tab (DEV Only) */}
            {activeTab === 'ai-bot' && (
              <div className="space-y-6">
                <AIBotTestSettings />
                <DevAnnouncementCard />
              </div>
            )}

            {/* Line Assignments Tab */}
            {activeTab === 'line-assignments' && (
              <LineLeaderAssignment />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

