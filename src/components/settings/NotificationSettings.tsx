/**
 * Notification Settings Component
 *
 * Allows HR/Admin to configure notification settings for Email, LINE, and Telegram
 * Includes channel configuration management
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Bell,
    Mail,
    MessageSquare,
    Send,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Calendar,
    XCircle,
    Ban,
    AlertTriangle,
    Settings,
    Eye,
    EyeOff,
    Key,
    Hash
} from 'lucide-react';
import api from '../../api/auth';
import { useToast } from '../../hooks/useToast';

interface NotificationSettings {
    // Global enables
    email_enabled: boolean;
    line_enabled: boolean;
    telegram_enabled: boolean;

    // Leave Request Notifications
    leave_created_email: boolean;
    leave_created_line: boolean;
    leave_created_telegram: boolean;
    leave_approved_email: boolean;
    leave_approved_line: boolean;
    leave_approved_telegram: boolean;
    leave_rejected_email: boolean;
    leave_rejected_line: boolean;
    leave_rejected_telegram: boolean;
    leave_canceled_email: boolean;
    leave_canceled_line: boolean;
    leave_canceled_telegram: boolean;
    leave_voided_email: boolean;
    leave_voided_line: boolean;
    leave_voided_telegram: boolean;

    // Other Notifications
    warning_issued_email: boolean;
    warning_issued_line: boolean;
    warning_issued_telegram: boolean;
    low_balance_alert_email: boolean;
    low_balance_alert_line: boolean;
    low_balance_alert_telegram: boolean;
}

interface ChannelConfig {
    email: {
        provider: string;
        provider_configured: boolean;
        smtp_host: string;
        smtp_host_configured: boolean;
        smtp_port: number;
        smtp_user: string;
        smtp_user_configured: boolean;
        smtp_pass: string;
        smtp_pass_configured: boolean;
        sendgrid_api_key: string;
        sendgrid_api_key_configured: boolean;
        sender_email: string;
        sender_name: string;
        reply_to_email: string;
    };
    line: {
        channel_access_token: string;
        channel_access_token_configured: boolean;
        group_id: string;
        group_id_configured: boolean;
    };
    telegram: {
        bot_token: string;
        bot_token_configured: boolean;
        chat_id: string;
        chat_id_configured: boolean;
    };
}

const defaultSettings: NotificationSettings = {
    email_enabled: true,
    line_enabled: true,
    telegram_enabled: true,
    leave_created_email: true,
    leave_created_line: true,
    leave_created_telegram: true,
    leave_approved_email: true,
    leave_approved_line: true,
    leave_approved_telegram: true,
    leave_rejected_email: true,
    leave_rejected_line: true,
    leave_rejected_telegram: true,
    leave_canceled_email: false,
    leave_canceled_line: true,
    leave_canceled_telegram: true,
    leave_voided_email: true,
    leave_voided_line: true,
    leave_voided_telegram: true,
    warning_issued_email: true,
    warning_issued_line: false,
    warning_issued_telegram: false,
    low_balance_alert_email: true,
    low_balance_alert_line: false,
    low_balance_alert_telegram: false,
};

const defaultChannelConfig: ChannelConfig = {
    email: {
        provider: 'console',
        provider_configured: false,
        smtp_host: '',
        smtp_host_configured: false,
        smtp_port: 587,
        smtp_user: '',
        smtp_user_configured: false,
        smtp_pass: '',
        smtp_pass_configured: false,
        sendgrid_api_key: '',
        sendgrid_api_key_configured: false,
        sender_email: 'noreply@company.com',
        sender_name: 'HR Leave System',
        reply_to_email: 'hr@company.com',
    },
    line: {
        channel_access_token: '',
        channel_access_token_configured: false,
        group_id: '',
        group_id_configured: false,
    },
    telegram: {
        bot_token: '',
        bot_token_configured: false,
        chat_id: '',
        chat_id_configured: false,
    },
};


export function NotificationSettings() {
    const { i18n } = useTranslation();
    const { showToast } = useToast();
    const isThaiLanguage = i18n.language === 'th';

    const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
    const [channelConfig, setChannelConfig] = useState<ChannelConfig>(defaultChannelConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    // Config edit states - Email
    const [editEmailProvider, setEditEmailProvider] = useState('console');
    const [editSmtpHost, setEditSmtpHost] = useState('');
    const [editSmtpPort, setEditSmtpPort] = useState(587);
    const [editSmtpUser, setEditSmtpUser] = useState('');
    const [editSmtpPass, setEditSmtpPass] = useState('');
    const [editSendgridApiKey, setEditSendgridApiKey] = useState('');
    const [editSenderEmail, setEditSenderEmail] = useState('');
    const [editSenderName, setEditSenderName] = useState('');
    const [editReplyToEmail, setEditReplyToEmail] = useState('');
    const [showSmtpPass, setShowSmtpPass] = useState(false);
    const [showSendgridKey, setShowSendgridKey] = useState(false);

    // Config edit states - LINE
    const [editLineToken, setEditLineToken] = useState('');
    const [editLineGroupId, setEditLineGroupId] = useState('');
    const [showLineToken, setShowLineToken] = useState(false);

    // Config edit states - Telegram
    const [editTelegramToken, setEditTelegramToken] = useState('');
    const [editTelegramChatId, setEditTelegramChatId] = useState('');
    const [showTelegramToken, setShowTelegramToken] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchChannelConfig();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await api.get('/notification-settings');
            if (response.data.settings) {
                setSettings({ ...defaultSettings, ...response.data.settings });
            }
        } catch (error: any) {
            console.error('Failed to fetch notification settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchChannelConfig = async () => {
        try {
            const response = await api.get('/notification-channel-config');
            if (response.data.config) {
                setChannelConfig(response.data.config);
                // Set edit fields with current values
                // Email
                setEditEmailProvider(response.data.config.email?.provider || 'console');
                setEditSmtpHost(response.data.config.email?.smtp_host || '');
                setEditSmtpPort(response.data.config.email?.smtp_port || 587);
                setEditSmtpUser(response.data.config.email?.smtp_user || '');
                setEditSenderEmail(response.data.config.email?.sender_email || '');
                setEditSenderName(response.data.config.email?.sender_name || '');
                setEditReplyToEmail(response.data.config.email?.reply_to_email || '');
                // LINE
                setEditLineGroupId(response.data.config.line?.group_id || '');
                // Telegram
                setEditTelegramChatId(response.data.config.telegram?.chat_id || '');
            }
        } catch (error: any) {
            console.error('Failed to fetch channel config:', error);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.post('/notification-settings', { settings });
            showToast(
                isThaiLanguage ? 'บันทึกการตั้งค่าการแจ้งเตือนสำเร็จ' : 'Notification settings saved successfully',
                'success'
            );
        } catch (error: any) {
            console.error('Failed to save notification settings:', error);
            showToast(
                isThaiLanguage ? 'ไม่สามารถบันทึกการตั้งค่าได้' : 'Failed to save settings',
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleSaveChannelConfig = async () => {
        setSavingConfig(true);
        try {
            const configToSave = {
                email: {
                    provider: editEmailProvider,
                    smtp_host: editSmtpHost,
                    smtp_port: editSmtpPort,
                    smtp_user: editSmtpUser,
                    // Only send password if user entered a new one
                    smtp_pass: editSmtpPass || undefined,
                    sendgrid_api_key: editSendgridApiKey || undefined,
                    sender_email: editSenderEmail,
                    sender_name: editSenderName,
                    reply_to_email: editReplyToEmail,
                },
                line: {
                    // Only send token if user entered a new one
                    channel_access_token: editLineToken || undefined,
                    group_id: editLineGroupId,
                },
                telegram: {
                    bot_token: editTelegramToken || undefined,
                    chat_id: editTelegramChatId,
                },
            };

            const response = await api.post('/notification-channel-config', { config: configToSave });
            if (response.data.config) {
                setChannelConfig(response.data.config);
                // Clear sensitive token inputs after save
                setEditSmtpPass('');
                setEditSendgridApiKey('');
                setEditLineToken('');
                setEditTelegramToken('');
            }
            showToast(
                isThaiLanguage ? 'บันทึกการตั้งค่าช่องทางสำเร็จ' : 'Channel configuration saved successfully',
                'success'
            );
        } catch (error: any) {
            console.error('Failed to save channel config:', error);
            showToast(
                isThaiLanguage ? 'ไม่สามารถบันทึกการตั้งค่าช่องทางได้' : 'Failed to save channel configuration',
                'error'
            );
        } finally {
            setSavingConfig(false);
        }
    };

    const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const ToggleSwitch = ({ checked, onChange, disabled }: {
        checked: boolean;
        onChange: (value: boolean) => void;
        disabled?: boolean;
    }) => (
        <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => !disabled && onChange(e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
    );

    const NotificationRow = ({
        icon: Icon,
        label,
        emailKey,
        lineKey,
        telegramKey,
        iconColor = 'text-gray-600'
    }: {
        icon: React.ComponentType<any>;
        label: string;
        emailKey: keyof NotificationSettings;
        lineKey: keyof NotificationSettings;
        telegramKey: keyof NotificationSettings;
        iconColor?: string;
    }) => (
        <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${iconColor}`} />
                <span className="text-gray-700">{label}</span>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <ToggleSwitch
                        checked={settings[emailKey] as boolean}
                        onChange={(value) => updateSetting(emailKey, value)}
                        disabled={!settings.email_enabled}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                    <ToggleSwitch
                        checked={settings[lineKey] as boolean}
                        onChange={(value) => updateSetting(lineKey, value)}
                        disabled={!settings.line_enabled}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-400" />
                    <ToggleSwitch
                        checked={settings[telegramKey] as boolean}
                        onChange={(value) => updateSetting(telegramKey, value)}
                        disabled={!settings.telegram_enabled}
                    />
                </div>
            </div>
        </div>
    );

    const ConfigStatusBadge = ({ configured }: { configured: boolean }) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${configured
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
            }`}>
            {configured ? (
                <>
                    <CheckCircle2 className="w-3 h-3" />
                    {isThaiLanguage ? 'ตั้งค่าแล้ว' : 'Configured'}
                </>
            ) : (
                <>
                    <AlertCircle className="w-3 h-3" />
                    {isThaiLanguage ? 'ยังไม่ได้ตั้งค่า' : 'Not configured'}
                </>
            )}
        </span>
    );

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                <p className="text-gray-600 mt-4">{isThaiLanguage ? 'กำลังโหลด...' : 'Loading...'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bell className="w-8 h-8 text-blue-600" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {isThaiLanguage ? 'การตั้งค่าการแจ้งเตือน' : 'Notification Settings'}
                        </h2>
                        <p className="text-gray-600 text-sm">
                            {isThaiLanguage
                                ? 'เปิด/ปิดการแจ้งเตือนผ่าน Email, LINE และ Telegram'
                                : 'Enable/disable notifications via Email, LINE, and Telegram'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { fetchSettings(); fetchChannelConfig(); }}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {isThaiLanguage ? 'รีเฟรช' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Channel Configuration */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                            {isThaiLanguage ? 'ตั้งค่าช่องทางการแจ้งเตือน' : 'Channel Configuration'}
                        </h3>
                    </div>
                    <button
                        onClick={handleSaveChannelConfig}
                        disabled={savingConfig}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {savingConfig
                            ? (isThaiLanguage ? 'กำลังบันทึก...' : 'Saving...')
                            : (isThaiLanguage ? 'บันทึก Config' : 'Save Config')}
                    </button>
                </div>

                {/* Email Configuration */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-800">Email (SMTP / SendGrid)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Provider */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                {isThaiLanguage ? 'ผู้ให้บริการ' : 'Provider'}
                            </label>
                            <select
                                value={editEmailProvider}
                                onChange={(e) => setEditEmailProvider(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="console">Console (Development)</option>
                                <option value="smtp">SMTP</option>
                                <option value="sendgrid">SendGrid</option>
                            </select>
                        </div>

                        {/* Sender Email */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                {isThaiLanguage ? 'อีเมลผู้ส่ง' : 'Sender Email'}
                            </label>
                            <input
                                type="email"
                                value={editSenderEmail}
                                onChange={(e) => setEditSenderEmail(e.target.value)}
                                placeholder="noreply@company.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Sender Name */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                {isThaiLanguage ? 'ชื่อผู้ส่ง' : 'Sender Name'}
                            </label>
                            <input
                                type="text"
                                value={editSenderName}
                                onChange={(e) => setEditSenderName(e.target.value)}
                                placeholder="HR Leave System"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Reply-To Email */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                {isThaiLanguage ? 'อีเมลตอบกลับ' : 'Reply-To Email'}
                            </label>
                            <input
                                type="email"
                                value={editReplyToEmail}
                                onChange={(e) => setEditReplyToEmail(e.target.value)}
                                placeholder="hr@company.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Conditional SMTP Fields */}
                        {editEmailProvider === 'smtp' && (
                            <>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-700">SMTP Host</label>
                                        <ConfigStatusBadge configured={channelConfig.email?.smtp_host_configured} />
                                    </div>
                                    <input
                                        type="text"
                                        value={editSmtpHost}
                                        onChange={(e) => setEditSmtpHost(e.target.value)}
                                        placeholder="smtp.gmail.com"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">SMTP Port</label>
                                    <input
                                        type="number"
                                        value={editSmtpPort}
                                        onChange={(e) => setEditSmtpPort(parseInt(e.target.value) || 587)}
                                        placeholder="587"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-700">SMTP User</label>
                                        <ConfigStatusBadge configured={channelConfig.email?.smtp_user_configured} />
                                    </div>
                                    <input
                                        type="text"
                                        value={editSmtpUser}
                                        onChange={(e) => setEditSmtpUser(e.target.value)}
                                        placeholder="user@gmail.com"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                            <Key className="w-3 h-3" />
                                            SMTP Password
                                        </label>
                                        <ConfigStatusBadge configured={channelConfig.email?.smtp_pass_configured} />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showSmtpPass ? 'text' : 'password'}
                                            value={editSmtpPass}
                                            onChange={(e) => setEditSmtpPass(e.target.value)}
                                            placeholder={channelConfig.email?.smtp_pass || (isThaiLanguage ? 'กรอก Password ใหม่...' : 'Enter new password...')}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSmtpPass(!showSmtpPass)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {isThaiLanguage ? 'เว้นว่างเพื่อใช้ค่าปัจจุบัน' : 'Leave empty to keep current value'}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Conditional SendGrid Field */}
                        {editEmailProvider === 'sendgrid' && (
                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        <Key className="w-3 h-3" />
                                        SendGrid API Key
                                    </label>
                                    <ConfigStatusBadge configured={channelConfig.email?.sendgrid_api_key_configured} />
                                </div>
                                <div className="relative">
                                    <input
                                        type={showSendgridKey ? 'text' : 'password'}
                                        value={editSendgridApiKey}
                                        onChange={(e) => setEditSendgridApiKey(e.target.value)}
                                        placeholder={channelConfig.email?.sendgrid_api_key || (isThaiLanguage ? 'กรอก API Key ใหม่...' : 'Enter new API key...')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSendgridKey(!showSendgridKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showSendgridKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isThaiLanguage ? 'เว้นว่างเพื่อใช้ค่าปัจจุบัน' : 'Leave empty to keep current value'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LINE Configuration */}
                    <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-green-800">LINE</span>
                        </div>

                        <div className="space-y-4">
                            {/* Channel Access Token */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        <Key className="w-3 h-3" />
                                        Channel Access Token
                                    </label>
                                    <ConfigStatusBadge configured={channelConfig.line.channel_access_token_configured} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showLineToken ? 'text' : 'password'}
                                            value={editLineToken}
                                            onChange={(e) => setEditLineToken(e.target.value)}
                                            placeholder={channelConfig.line.channel_access_token || (isThaiLanguage ? 'กรอก Token ใหม่...' : 'Enter new token...')}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowLineToken(!showLineToken)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showLineToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isThaiLanguage ? 'เว้นว่างเพื่อใช้ค่าปัจจุบัน' : 'Leave empty to keep current value'}
                                </p>
                            </div>

                            {/* Group ID */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        Group ID
                                    </label>
                                    <ConfigStatusBadge configured={channelConfig.line.group_id_configured} />
                                </div>
                                <input
                                    type="text"
                                    value={editLineGroupId}
                                    onChange={(e) => setEditLineGroupId(e.target.value)}
                                    placeholder={isThaiLanguage ? 'กรอก Group ID...' : 'Enter Group ID...'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Telegram Configuration */}
                    <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Send className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-800">Telegram</span>
                        </div>

                        <div className="space-y-4">
                            {/* Bot Token */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        <Key className="w-3 h-3" />
                                        Bot Token
                                    </label>
                                    <ConfigStatusBadge configured={channelConfig.telegram.bot_token_configured} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showTelegramToken ? 'text' : 'password'}
                                            value={editTelegramToken}
                                            onChange={(e) => setEditTelegramToken(e.target.value)}
                                            placeholder={channelConfig.telegram.bot_token || (isThaiLanguage ? 'กรอก Token ใหม่...' : 'Enter new token...')}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowTelegramToken(!showTelegramToken)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isThaiLanguage ? 'เว้นว่างเพื่อใช้ค่าปัจจุบัน' : 'Leave empty to keep current value'}
                                </p>
                            </div>

                            {/* Chat ID */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        Chat ID
                                    </label>
                                    <ConfigStatusBadge configured={channelConfig.telegram.chat_id_configured} />
                                </div>
                                <input
                                    type="text"
                                    value={editTelegramChatId}
                                    onChange={(e) => setEditTelegramChatId(e.target.value)}
                                    placeholder={isThaiLanguage ? 'กรอก Chat ID...' : 'Enter Chat ID...'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Enable/Disable */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {isThaiLanguage ? 'เปิด/ปิด ช่องทางการแจ้งเตือน' : 'Enable/Disable Notification Channels'}
                    </h3>
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving
                            ? (isThaiLanguage ? 'กำลังบันทึก...' : 'Saving...')
                            : (isThaiLanguage ? 'บันทึกการตั้งค่า' : 'Save Settings')}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Email Toggle */}
                    <div className={`p-4 rounded-lg border-2 ${settings.email_enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.email_enabled ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                    <Mail className={`w-6 h-6 ${settings.email_enabled ? 'text-blue-600' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Email</p>
                                    <p className="text-sm text-gray-600">
                                        {isThaiLanguage ? 'การแจ้งเตือนผ่านอีเมล' : 'Email notifications'}
                                    </p>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={settings.email_enabled}
                                onChange={(value) => updateSetting('email_enabled', value)}
                            />
                        </div>
                        {!settings.email_enabled && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {isThaiLanguage ? 'การแจ้งเตือนอีเมลทั้งหมดถูกปิด' : 'All email notifications are disabled'}
                            </div>
                        )}
                    </div>

                    {/* LINE Toggle */}
                    <div className={`p-4 rounded-lg border-2 ${settings.line_enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.line_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                                    <MessageSquare className={`w-6 h-6 ${settings.line_enabled ? 'text-green-600' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">LINE</p>
                                    <p className="text-sm text-gray-600">
                                        {isThaiLanguage ? 'การแจ้งเตือนผ่าน LINE' : 'LINE group notifications'}
                                    </p>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={settings.line_enabled}
                                onChange={(value) => updateSetting('line_enabled', value)}
                            />
                        </div>
                        {!settings.line_enabled && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {isThaiLanguage ? 'การแจ้งเตือน LINE ทั้งหมดถูกปิด' : 'All LINE notifications are disabled'}
                            </div>
                        )}
                    </div>

                    {/* Telegram Toggle */}
                    <div className={`p-4 rounded-lg border-2 ${settings.telegram_enabled ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.telegram_enabled ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                    <Send className={`w-6 h-6 ${settings.telegram_enabled ? 'text-blue-500' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Telegram</p>
                                    <p className="text-sm text-gray-600">
                                        {isThaiLanguage ? 'การแจ้งเตือนผ่าน Telegram' : 'Telegram notifications'}
                                    </p>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={settings.telegram_enabled}
                                onChange={(value) => updateSetting('telegram_enabled', value)}
                            />
                        </div>
                        {!settings.telegram_enabled && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {isThaiLanguage ? 'การแจ้งเตือน Telegram ทั้งหมดถูกปิด' : 'All Telegram notifications are disabled'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Leave Request Notifications */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {isThaiLanguage ? 'การแจ้งเตือนการลา' : 'Leave Request Notifications'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    {isThaiLanguage
                        ? 'เลือกช่องทางการแจ้งเตือนสำหรับแต่ละ event'
                        : 'Select notification channels for each event'}
                </p>

                {/* Header */}
                <div className="flex items-center justify-end gap-6 pb-2 border-b border-gray-200 text-sm font-medium text-gray-600">
                    <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>Email</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4 text-green-500" />
                        <span>LINE</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Send className="w-4 h-4 text-blue-400" />
                        <span>Telegram</span>
                    </div>
                </div>

                <div className="mt-2">
                    <NotificationRow
                        icon={Calendar}
                        label={isThaiLanguage ? 'สร้างคำขอลาใหม่' : 'New leave request created'}
                        emailKey="leave_created_email"
                        lineKey="leave_created_line"
                        telegramKey="leave_created_telegram"
                        iconColor="text-blue-500"
                    />
                    <NotificationRow
                        icon={CheckCircle2}
                        label={isThaiLanguage ? 'อนุมัติคำขอลา' : 'Leave request approved'}
                        emailKey="leave_approved_email"
                        lineKey="leave_approved_line"
                        telegramKey="leave_approved_telegram"
                        iconColor="text-green-500"
                    />
                    <NotificationRow
                        icon={XCircle}
                        label={isThaiLanguage ? 'ไม่อนุมัติคำขอลา' : 'Leave request rejected'}
                        emailKey="leave_rejected_email"
                        lineKey="leave_rejected_line"
                        telegramKey="leave_rejected_telegram"
                        iconColor="text-red-500"
                    />
                    <NotificationRow
                        icon={Ban}
                        label={isThaiLanguage ? 'ยกเลิกคำขอลา (โดยพนักงาน)' : 'Leave request canceled (by employee)'}
                        emailKey="leave_canceled_email"
                        lineKey="leave_canceled_line"
                        telegramKey="leave_canceled_telegram"
                        iconColor="text-gray-500"
                    />
                    <NotificationRow
                        icon={AlertTriangle}
                        label={isThaiLanguage ? 'Void ใบลา (โดย HR)' : 'Leave request voided (by HR)'}
                        emailKey="leave_voided_email"
                        lineKey="leave_voided_line"
                        telegramKey="leave_voided_telegram"
                        iconColor="text-orange-500"
                    />
                </div>
            </div>

            {/* Other Notifications */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {isThaiLanguage ? 'การแจ้งเตือนอื่นๆ' : 'Other Notifications'}
                </h3>

                {/* Header */}
                <div className="flex items-center justify-end gap-6 pb-2 border-b border-gray-200 text-sm font-medium text-gray-600">
                    <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>Email</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4 text-green-500" />
                        <span>LINE</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Send className="w-4 h-4 text-blue-400" />
                        <span>Telegram</span>
                    </div>
                </div>

                <div className="mt-2">
                    <NotificationRow
                        icon={AlertCircle}
                        label={isThaiLanguage ? 'ออกใบเตือนพนักงาน' : 'Warning notice issued'}
                        emailKey="warning_issued_email"
                        lineKey="warning_issued_line"
                        telegramKey="warning_issued_telegram"
                        iconColor="text-red-500"
                    />
                    <NotificationRow
                        icon={AlertTriangle}
                        label={isThaiLanguage ? 'แจ้งเตือนวันลาเหลือน้อย' : 'Low leave balance alert'}
                        emailKey="low_balance_alert_email"
                        lineKey="low_balance_alert_line"
                        telegramKey="low_balance_alert_telegram"
                        iconColor="text-yellow-500"
                    />
                </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium">
                            {isThaiLanguage ? 'วิธีการขอ Config' : 'How to get configuration values'}
                        </p>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                            <li>
                                <strong>LINE:</strong> {isThaiLanguage
                                    ? 'สร้าง Messaging API Channel ที่ LINE Developers Console แล้วคัดลอก Channel Access Token และ Group ID'
                                    : 'Create Messaging API Channel at LINE Developers Console, copy Channel Access Token and Group ID'}
                            </li>
                            <li>
                                <strong>Telegram:</strong> {isThaiLanguage
                                    ? 'สร้าง Bot ที่ @BotFather แล้วคัดลอก Bot Token และหา Chat ID ด้วย @userinfobot'
                                    : 'Create Bot via @BotFather, copy Bot Token, get Chat ID via @userinfobot'}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
