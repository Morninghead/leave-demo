/**
 * Email Alert Settings Component
 *
 * Allows HR/Admin to configure email alert settings with enable/disable toggle
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Settings,
  Users,
  Clock,
  FileText
} from 'lucide-react';
import api from '../../api/auth';

interface EmailAlertSettings {
  email_alerts_enabled: boolean;
  low_balance_threshold: number;
  high_unused_threshold: number;
  expiring_leave_months: number;
  sender_email: string;
  sender_name: string;
  reply_to_email: string;
  alert_frequency: 'daily' | 'weekly' | 'monthly';
  alert_day_of_week: number;
  alert_day_of_month: number;
  send_to_employee: boolean;
  send_to_manager: boolean;
  send_to_hr: boolean;
  cc_emails: string[];
  email_subject_template: string;
  email_body_template_th: string;
  email_body_template_en: string;
}

export function EmailAlertSettings() {
  const { t } = useTranslation();

  const [settings, setSettings] = useState<EmailAlertSettings>({
    email_alerts_enabled: false,
    low_balance_threshold: 20,
    high_unused_threshold: 80,
    expiring_leave_months: 3,
    sender_email: 'noreply@company.com',
    sender_name: 'HR Leave System',
    reply_to_email: 'hr@company.com',
    alert_frequency: 'weekly',
    alert_day_of_week: 1,
    alert_day_of_month: 1,
    send_to_employee: true,
    send_to_manager: true,
    send_to_hr: true,
    cc_emails: [],
    email_subject_template: '[HR Alert] Leave Balance Notification',
    email_body_template_th: '',
    email_body_template_en: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ccEmailInput, setCcEmailInput] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/settings-email-alerts');
      if (response.data.settings) {
        setSettings(response.data.settings);
      }
    } catch (error: any) {
      console.error('Failed to fetch email alert settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.post('/settings-email-alerts', { settings });
      setMessage({ type: 'success', text: t('settings.savedSuccessfully') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to save email alert settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCcEmail = () => {
    if (ccEmailInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ccEmailInput)) {
      if (!settings.cc_emails.includes(ccEmailInput)) {
        setSettings({
          ...settings,
          cc_emails: [...settings.cc_emails, ccEmailInput]
        });
        setCcEmailInput('');
      }
    }
  };

  const handleRemoveCcEmail = (email: string) => {
    setSettings({
      ...settings,
      cc_emails: settings.cc_emails.filter(e => e !== email)
    });
  };

  const daysOfWeek = [
    { value: 0, label: t('calendar.sunday') },
    { value: 1, label: t('calendar.monday') },
    { value: 2, label: t('calendar.tuesday') },
    { value: 3, label: t('calendar.wednesday') },
    { value: 4, label: t('calendar.thursday') },
    { value: 5, label: t('calendar.friday') },
    { value: 6, label: t('calendar.saturday') },
  ];

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
            <Mail className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('settings.emailAlerts')}</h2>
              <p className="text-gray-600">{t('settings.emailAlertsDesc')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
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

      {/* Global Enable/Disable */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('settings.enableEmailAlerts')}</h3>
              <p className="text-sm text-gray-600">{t('settings.enableEmailAlertsDesc')}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.email_alerts_enabled}
              onChange={(e) => setSettings({ ...settings, email_alerts_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {!settings.email_alerts_enabled && (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{t('settings.emailAlertsDisabled')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Threshold Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          {t('settings.alertThresholds')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.lowBalanceThreshold')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={settings.low_balance_threshold}
                onChange={(e) => setSettings({ ...settings, low_balance_threshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-2 text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('settings.lowBalanceThresholdDesc')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.highUnusedThreshold')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={settings.high_unused_threshold}
                onChange={(e) => setSettings({ ...settings, high_unused_threshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-2 text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('settings.highUnusedThresholdDesc')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.expiringLeaveMonths')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="12"
                value={settings.expiring_leave_months}
                onChange={(e) => setSettings({ ...settings, expiring_leave_months: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-2 text-gray-500">{t('common.months')}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('settings.expiringLeaveMonthsDesc')}</p>
          </div>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          {t('settings.emailConfiguration')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.senderEmail')}
            </label>
            <input
              type="email"
              value={settings.sender_email}
              onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="noreply@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.senderName')}
            </label>
            <input
              type="text"
              value={settings.sender_name}
              onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="HR Leave System"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.replyToEmail')}
            </label>
            <input
              type="email"
              value={settings.reply_to_email}
              onChange={(e) => setSettings({ ...settings, reply_to_email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="hr@company.com"
            />
          </div>
        </div>
      </div>

      {/* Alert Frequency */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          {t('settings.alertFrequency')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.frequency')}
            </label>
            <select
              value={settings.alert_frequency}
              onChange={(e) => setSettings({ ...settings, alert_frequency: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">{t('settings.daily')}</option>
              <option value="weekly">{t('settings.weekly')}</option>
              <option value="monthly">{t('settings.monthly')}</option>
            </select>
          </div>

          {settings.alert_frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.dayOfWeek')}
              </label>
              <select
                value={settings.alert_day_of_week}
                onChange={(e) => setSettings({ ...settings, alert_day_of_week: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {daysOfWeek.map(day => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </div>
          )}

          {settings.alert_frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.dayOfMonth')}
              </label>
              <select
                value={settings.alert_day_of_month}
                onChange={(e) => setSettings({ ...settings, alert_day_of_month: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          {t('settings.recipients')}
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.send_to_employee}
              onChange={(e) => setSettings({ ...settings, send_to_employee: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('settings.sendToEmployee')}</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.send_to_manager}
              onChange={(e) => setSettings({ ...settings, send_to_manager: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('settings.sendToManager')}</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.send_to_hr}
              onChange={(e) => setSettings({ ...settings, send_to_hr: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('settings.sendToHR')}</span>
          </label>

          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.additionalCCRecipients')}
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={ccEmailInput}
                onChange={(e) => setCcEmailInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCcEmail()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
              <button
                onClick={handleAddCcEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('common.add')}
              </button>
            </div>
            {settings.cc_emails.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.cc_emails.map(email => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveCcEmail(email)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Template Customization */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          {t('settings.emailTemplates')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.emailSubjectTemplate')}
            </label>
            <input
              type="text"
              value={settings.email_subject_template}
              onChange={(e) => setSettings({ ...settings, email_subject_template: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="[HR Alert] Leave Balance Notification"
            />
          </div>

          <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
            <p className="text-sm text-blue-800">
              <strong>{t('settings.note')}:</strong> {t('settings.emailTemplateNote')}
            </p>
            <p className="text-xs text-blue-700 mt-2">
              {t('settings.emailTemplateNoteDetail')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
