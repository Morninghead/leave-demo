import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, Check, X, AlertCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface EmailSettings {
  email_alert_enabled: boolean;
  email_alert_sender_email: string;
  email_alert_sender_name: string;
  email_alert_reply_to_email: string;
}

export function EmailNotificationSettings() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<EmailSettings>({
    email_alert_enabled: false,
    email_alert_sender_email: 'noreply@company.com',
    email_alert_sender_name: 'SSTH Leave System',
    email_alert_reply_to_email: 'hr@company.com',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/.netlify/functions/settings-email-alerts');
      const data = await response.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load email settings:', error);
      showToast('Failed to load email settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/.netlify/functions/settings-email-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      const data = await response.json();

      if (data.success) {
        showToast('Email settings saved successfully', 'success');
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }

    try {
      setTestingEmail(true);
      const response = await fetch('/.netlify/functions/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      });

      const data = await response.json();

      if (data.success) {
        showToast(`Test email sent to ${testEmail}`, 'success');
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to send test email', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Mail className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Email Notification Settings
          </h3>
          <p className="text-sm text-gray-600">
            Configure email notifications for leave requests and approvals
          </p>
        </div>
      </div>

      {/* Configuration Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-800 mb-1">
              SMTP Configuration Required
            </p>
            <p className="text-yellow-700">
              Email notifications require SMTP server configuration in environment variables.
              Contact your system administrator to set up EMAIL_PROVIDER, SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Enable Email Notifications</h4>
            <p className="text-sm text-gray-600 mt-1">
              Send email alerts for leave requests, approvals, and rejections
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, email_alert_enabled: !settings.email_alert_enabled })}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.email_alert_enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                settings.email_alert_enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h4 className="font-semibold text-gray-900">Email Configuration</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sender Email Address
          </label>
          <input
            type="email"
            value={settings.email_alert_sender_email}
            onChange={(e) => setSettings({ ...settings, email_alert_sender_email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="noreply@company.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email address that will appear as the sender
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sender Name
          </label>
          <input
            type="text"
            value={settings.email_alert_sender_name}
            onChange={(e) => setSettings({ ...settings, email_alert_sender_name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="SSTH Leave System"
          />
          <p className="text-xs text-gray-500 mt-1">
            Display name for email sender
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reply-To Email Address
          </label>
          <input
            type="email"
            value={settings.email_alert_reply_to_email}
            onChange={(e) => setSettings({ ...settings, email_alert_reply_to_email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="hr@company.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email address for replies (usually HR department)
          </p>
        </div>
      </div>

      {/* Test Email */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h4 className="font-semibold text-gray-900">Test Email Notification</h4>
        <p className="text-sm text-gray-600">
          Send a test email to verify your configuration is working correctly
        </p>

        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter email address to test"
          />
          <button
            onClick={handleTestEmail}
            disabled={testingEmail || !testEmail}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {testingEmail ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={loadSettings}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Email Types Reference */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-3">Email Notifications Sent</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Request Submitted:</strong> Sent to employee when they submit a leave request</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Pending Approval:</strong> Sent to approvers when a request needs their approval</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Request Approved:</strong> Sent to employee when their request is fully approved</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Request Rejected:</strong> Sent to employee when their request is rejected</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Shift Swap Requests:</strong> Sent to approvers for shift swap notifications</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
