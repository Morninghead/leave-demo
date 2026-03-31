import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Save, RefreshCw, Shield } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';

interface WarningSettings {
  system_enabled: boolean;
  appeal_deadline_days: number;
  warning_expiry_months: number;
  require_signature: boolean;
  allow_signature_refusal: boolean;
  min_scroll_percentage: number;
  auto_send_email: boolean;
  email_provider: string;
}

export function WarningSystemSettings() {
  const { t } = useTranslation();
  const { showToast, showModal } = useToast();
  const [settings, setSettings] = useState<WarningSettings>({
    system_enabled: true,
    appeal_deadline_days: 15,
    warning_expiry_months: 12,
    require_signature: true,
    allow_signature_refusal: true,
    min_scroll_percentage: 100,
    auto_send_email: false,
    email_provider: 'console',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/settings-warning-system');
      if (response.data.success) {
        setSettings(response.data.settings);
      }
    } catch (error: any) {
      console.error('Load settings error:', error);
      showToast(error.response?.data?.message || t('warning.settingsFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.put('/settings-warning-system', {
        settings,
      });

      if (response.data.success) {
        showToast(t('warning.settingsSaved'), 'success');
      }
    } catch (error: any) {
      console.error('Save settings error:', error);
      showToast(error.response?.data?.message || t('warning.settingsFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMigration = async () => {
    const confirmed = await showModal('confirm', 'Confirm Database Migration', {
      message: 'Run database schema migration? This will merge language fields and verify tables.',
      confirmText: 'Run Migration',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await api.post('/verify-warning-system');
      if (response.data.success) {
        showToast('Migration completed successfully', 'success');
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      showToast(error.response?.data?.message || 'Migration failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('warning.warningSettings')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('warning.settingsDescription')}
        </p>
      </div>

      {/* Settings Form */}
      <div className="p-6 space-y-6">
        {/* System Enable/Disable */}
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {t('warning.systemEnabled')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {settings.system_enabled
                ? t('warning.enableSystem')
                : t('warning.disableSystem')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.system_enabled}
              onChange={(e) =>
                setSettings({ ...settings, system_enabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Appeal Deadline Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('warning.appealDeadlineDays')}
          </label>
          <input
            type="number"
            min="7"
            max="30"
            value={settings.appeal_deadline_days}
            onChange={(e) =>
              setSettings({
                ...settings,
                appeal_deadline_days: parseInt(e.target.value, 10) || 15,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            7-30 days
          </p>
        </div>

        {/* Warning Expiry Months */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('warning.warningExpiryMonths')}
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={settings.warning_expiry_months}
            onChange={(e) =>
              setSettings({
                ...settings,
                warning_expiry_months: parseInt(e.target.value, 10) || 12,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            1-60 months
          </p>
        </div>

        {/* Minimum Scroll Percentage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('warning.minScrollPercentage')}
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={settings.min_scroll_percentage}
            onChange={(e) =>
              setSettings({
                ...settings,
                min_scroll_percentage: parseInt(e.target.value, 10) || 100,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            0-100%
          </p>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.require_signature}
              onChange={(e) =>
                setSettings({ ...settings, require_signature: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
              {t('warning.requireSignature')}
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.allow_signature_refusal}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  allow_signature_refusal: e.target.checked,
                })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
              {t('warning.allowSignatureRefusal')}
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.auto_send_email}
              onChange={(e) =>
                setSettings({ ...settings, auto_send_email: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
              {t('warning.autoSendEmail')}
            </span>
          </label>
        </div>

        {/* Email Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('warning.emailProvider')}
          </label>
          <select
            value={settings.email_provider}
            onChange={(e) =>
              setSettings({ ...settings, email_provider: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="console">Console (Development)</option>
            <option value="sendgrid">SendGrid</option>
            <option value="ses">AWS SES</option>
            <option value="smtp">SMTP</option>
          </select>
        </div>

        {/* Warning Note */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">Important:</p>
              <p className="mt-1">
                Changes to these settings will affect all future warning notices. Existing warnings will retain their original settings.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={loadSettings}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 inline-block mr-2" />
            {t('common.cancel')}
          </button>
          <button
            onClick={handleMigration}
            disabled={saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Migrate DB
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

