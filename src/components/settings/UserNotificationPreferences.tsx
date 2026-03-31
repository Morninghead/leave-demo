/**
 * User Notification Preferences Component
 *
 * Allows individual employees to opt-out of email notifications
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BellOff,
  Mail,
  CheckCircle2,
  AlertCircle,
  Save
} from 'lucide-react';
import api from '../../api/auth';

interface UserPreferences {
  email_notifications_enabled: boolean;
  email_leave_balance_alerts: boolean;
  email_leave_approval_updates: boolean;
  email_shift_swap_updates: boolean;
  preferred_language: 'th' | 'en';
}

export function UserNotificationPreferences() {
  const { t, i18n } = useTranslation();

  const [preferences, setPreferences] = useState<UserPreferences>({
    email_notifications_enabled: true,
    email_leave_balance_alerts: true,
    email_leave_approval_updates: true,
    email_shift_swap_updates: true,
    preferred_language: 'th',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const response = await api.get('/user-preferences');
      if (response.data.preferences) {
        setPreferences(response.data.preferences);
      }
    } catch (error) {
      console.error('Failed to fetch user preferences:', error);
      setMessage({ type: 'error', text: t('settings.failedToLoadPreferences') });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.post('/user-preferences', { preferences });
      setMessage({ type: 'success', text: t('settings.preferencesSavedSuccessfully') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setMessage({ type: 'error', text: t('settings.failedToSavePreferences') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-600 mt-4">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {preferences.email_notifications_enabled ? (
              <Bell className="w-8 h-8 text-blue-600" />
            ) : (
              <BellOff className="w-8 h-8 text-gray-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t('settings.notificationPreferences')}
              </h2>
              <p className="text-gray-600">{t('settings.notificationPreferencesDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}
      </div>

      {/* Master Email Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('settings.emailNotifications')}
              </h3>
              <p className="text-sm text-gray-600">{t('settings.emailNotificationsDesc')}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.email_notifications_enabled}
              onChange={(e) => setPreferences({
                ...preferences,
                email_notifications_enabled: e.target.checked
              })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {!preferences.email_notifications_enabled && (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <div className="flex items-center gap-2 text-yellow-800">
              <BellOff className="w-5 h-5" />
              <span className="font-medium">{t('settings.emailNotificationsDisabledWarning')}</span>
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              {t('settings.emailNotificationsDisabledWarningDesc')}
            </p>
          </div>
        )}
      </div>

      {/* Specific Email Preferences */}
      {preferences.email_notifications_enabled && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('settings.emailTypes')}
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            {t('settings.emailTypesDesc')}
          </p>

          <div className="space-y-4">
            {/* Leave Balance Alerts */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="leave-balance-alerts"
                checked={preferences.email_leave_balance_alerts}
                onChange={(e) => setPreferences({
                  ...preferences,
                  email_leave_balance_alerts: e.target.checked
                })}
                className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="leave-balance-alerts" className="font-medium text-gray-900 cursor-pointer">
                  {t('settings.leaveBalanceAlerts')}
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  {t('settings.leaveBalanceAlertsDesc')}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  {t('settings.exampleFrequency')}: {t('settings.weekly')}
                </div>
              </div>
            </div>

            {/* Leave Approval Updates */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="leave-approval-updates"
                checked={preferences.email_leave_approval_updates}
                onChange={(e) => setPreferences({
                  ...preferences,
                  email_leave_approval_updates: e.target.checked
                })}
                className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="leave-approval-updates" className="font-medium text-gray-900 cursor-pointer">
                  {t('settings.leaveApprovalUpdates')}
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  {t('settings.leaveApprovalUpdatesDesc')}
                </p>
                <div className="mt-2 text-xs text-blue-600 font-medium">
                  {t('settings.recommendedOn')}
                </div>
              </div>
            </div>

            {/* Shift Swap Updates */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="shift-swap-updates"
                checked={preferences.email_shift_swap_updates}
                onChange={(e) => setPreferences({
                  ...preferences,
                  email_shift_swap_updates: e.target.checked
                })}
                className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="shift-swap-updates" className="font-medium text-gray-900 cursor-pointer">
                  {t('settings.shiftSwapUpdates')}
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  {t('settings.shiftSwapUpdatesDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Language Preference */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('settings.languagePreference')}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('settings.languagePreferenceDesc')}
        </p>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="language"
              value="th"
              checked={preferences.preferred_language === 'th'}
              onChange={(e) => setPreferences({
                ...preferences,
                preferred_language: e.target.value as 'th'
              })}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-700">ไทย (Thai)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="language"
              value="en"
              checked={preferences.preferred_language === 'en'}
              onChange={(e) => setPreferences({
                ...preferences,
                preferred_language: e.target.value as 'en'
              })}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-700">English</span>
          </label>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">{t('settings.privacyNote')}</h4>
            <p className="text-sm text-blue-800 mt-1">
              {t('settings.privacyNoteDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
