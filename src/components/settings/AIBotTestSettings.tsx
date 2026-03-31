/**
 * AI Bot Test Settings (DEV Only)
 * 
 * Settings component for testing AI Bot with separate bot token and chat ID
 * Visible only to DEV user (999999999)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Save, TestTube, Send, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';

interface AIBotConfig {
    test_bot_token: string;
    test_chat_id: string;
    gemini_api_key: string;
    webhook_url: string;
    production_enabled: boolean;
    gemini_model: string;
}

const GEMINI_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (ล่าสุด)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-pro', name: 'Gemini Pro' },
];

export function AIBotTestSettings() {
    const { i18n } = useTranslation();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [config, setConfig] = useState<AIBotConfig>({
        test_bot_token: '',
        test_chat_id: '',
        gemini_api_key: '',
        webhook_url: '',
        production_enabled: false,
        gemini_model: 'gemini-3-flash-preview',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

    const isThai = i18n.language === 'th';

    const loadConfig = async () => {
        try {
            const response = await api.get('/ai-bot-config');
            if (response.data.config) {
                setConfig(response.data.config);
            }
        } catch (error) {
            console.error('Failed to load AI bot config:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load current config
    useEffect(() => {
        if (user?.employee_code === '999999999') {
            loadConfig();
        } else {
            setLoading(false);
        }
    }, [user?.employee_code]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/ai-bot-config', { config });
            showToast(isThai ? 'บันทึกการตั้งค่าสำเร็จ' : 'Settings saved successfully', 'success');
        } catch (error) {
            showToast(isThai ? 'บันทึกล้มเหลว' : 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!config.test_bot_token || !config.test_chat_id) {
            showToast(isThai ? 'กรุณาใส่ Bot Token และ Chat ID' : 'Please enter Bot Token and Chat ID', 'warning');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            // Send test message directly to Telegram
            const message = `🤖 AI Bot Test Message\n\n✅ ${isThai ? 'การเชื่อมต่อสำเร็จ!' : 'Connection successful!'}\n⏰ ${new Date().toLocaleString()}`;

            const response = await fetch(`https://api.telegram.org/bot${config.test_bot_token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.test_chat_id,
                    text: message,
                    parse_mode: 'HTML',
                }),
            });

            const data = await response.json();

            if (data.ok) {
                setTestResult('success');
                showToast(isThai ? 'ส่งข้อความทดสอบสำเร็จ!' : 'Test message sent!', 'success');
            } else {
                setTestResult('error');
                showToast(`Error: ${data.description}`, 'error');
            }
        } catch (error: any) {
            setTestResult('error');
            showToast(error.message, 'error');
        } finally {
            setTesting(false);
        }
    };

    const handleSetWebhook = async () => {
        if (!config.test_bot_token || !config.webhook_url) {
            showToast(isThai ? 'กรุณาใส่ Bot Token และ Webhook URL' : 'Please enter Bot Token and Webhook URL', 'warning');
            return;
        }

        try {
            const response = await fetch(`https://api.telegram.org/bot${config.test_bot_token}/setWebhook?url=${encodeURIComponent(config.webhook_url)}`, {
                method: 'GET',
            });

            const data = await response.json();

            if (data.ok) {
                showToast(isThai ? 'ตั้งค่า Webhook สำเร็จ!' : 'Webhook set successfully!', 'success');
            } else {
                showToast(`Error: ${data.description}`, 'error');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    // Only show for DEV user
    if (user?.employee_code !== '999999999') {
        return null;
    }

    if (loading) {
        return (
            <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {isThai ? 'ตั้งค่า AI Bot สำหรับทดสอบ' : 'AI Bot Test Settings'}
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full flex items-center gap-1">
                            <TestTube className="w-3 h-3" />
                            DEV ONLY
                        </span>
                    </h2>
                    <p className="text-sm text-gray-500">
                        {isThai ? 'ตั้งค่า Telegram Bot สำหรับทดสอบ AI HR Assistant แยกจาก Production' : 'Configure test Telegram Bot for AI HR Assistant (separate from production)'}
                    </p>
                </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-medium">{isThai ? 'หมายเหตุ' : 'Note'}</p>
                    <p>{isThai
                        ? 'การตั้งค่านี้แยกจาก Notification Bot ปกติ ใช้สำหรับทดสอบ AI เท่านั้น'
                        : 'These settings are separate from regular Notification Bot. For AI testing only.'}</p>
                </div>
            </div>

            {/* Test Bot Token */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isThai ? 'Test Bot Token' : 'Test Bot Token'}
                </label>
                <input
                    type="password"
                    value={config.test_bot_token}
                    onChange={(e) => setConfig({ ...config, test_bot_token: e.target.value })}
                    placeholder="123456789:ABCDEF..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                    {isThai ? 'สร้าง Bot ใหม่จาก @BotFather สำหรับทดสอบ' : 'Create a new bot from @BotFather for testing'}
                </p>
            </div>

            {/* Test Chat ID */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isThai ? 'Test Chat ID / Group ID' : 'Test Chat ID / Group ID'}
                </label>
                <input
                    type="text"
                    value={config.test_chat_id}
                    onChange={(e) => setConfig({ ...config, test_chat_id: e.target.value })}
                    placeholder="-1001234567890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                    {isThai ? 'Group chat ID สำหรับทดสอบ (ใช้ @userinfobot เพื่อดู ID)' : 'Test group chat ID (use @userinfobot to get ID)'}
                </p>
            </div>

            {/* Gemini API Key */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gemini API Key
                </label>
                <input
                    type="password"
                    value={config.gemini_api_key}
                    onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline flex items-center gap-1"
                    >
                        {isThai ? 'รับ API Key จาก Google AI Studio' : 'Get API Key from Google AI Studio'}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </p>
            </div>

            {/* Gemini Model Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isThai ? 'เลือก AI Model' : 'Select AI Model'}
                </label>
                <select
                    value={config.gemini_model}
                    onChange={(e) => setConfig({ ...config, gemini_model: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white"
                >
                    {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.name}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                    {isThai ? 'เลือก Gemini model ที่ต้องการใช้ (แนะนำ Gemini 3 Flash Preview)' : 'Select Gemini model to use (Gemini 3 Flash Preview recommended)'}
                </p>
            </div>

            {/* Webhook URL */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={config.webhook_url}
                        onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                        placeholder="https://your-site.netlify.app/.netlify/functions/telegram-bot"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    />
                    <button
                        onClick={handleSetWebhook}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                        Set Webhook
                    </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                    {isThai ? 'URL ของ Netlify Function ที่รับ message จาก Telegram' : 'Netlify Function URL to receive Telegram messages'}
                </p>
            </div>

            {/* Production Mode Toggle */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                            🚀 {isThai ? 'เปิดใช้งานจริง (Production Mode)' : 'Enable Production Mode'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {isThai
                                ? 'เมื่อเปิด Bot จะตอบข้อความจากทุก Group (รวมถึง Group จริง)'
                                : 'When enabled, Bot will respond to all groups (including production group)'}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.production_enabled}
                            onChange={(e) => setConfig({ ...config, production_enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </div>
                {config.production_enabled && (
                    <div className="mt-3 p-2 bg-green-100 rounded text-sm text-green-800 font-medium">
                        ⚠️ {isThai ? 'Bot จะตอบข้อความจากทุก Group!' : 'Bot will respond to ALL groups!'}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                    <Save className="w-4 h-4" />
                    {saving ? (isThai ? 'กำลังบันทึก...' : 'Saving...') : (isThai ? 'บันทึก' : 'Save')}
                </button>

                <button
                    onClick={handleTest}
                    disabled={testing || !config.test_bot_token || !config.test_chat_id}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                    <Send className="w-4 h-4" />
                    {testing ? (isThai ? 'กำลังทดสอบ...' : 'Testing...') : (isThai ? 'ทดสอบส่งข้อความ' : 'Test Send Message')}
                </button>

                {testResult && (
                    <div className={`flex items-center gap-2 ${testResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult === 'success' ? (
                            <CheckCircle2 className="w-5 h-5" />
                        ) : (
                            <XCircle className="w-5 h-5" />
                        )}
                        <span className="text-sm font-medium">
                            {testResult === 'success'
                                ? (isThai ? 'สำเร็จ!' : 'Success!')
                                : (isThai ? 'ล้มเหลว' : 'Failed')}
                        </span>
                    </div>
                )}
            </div>

            {/* Usage Instructions */}
            <div className="bg-gray-50 rounded-lg p-4 mt-6">
                <h3 className="font-medium text-gray-900 mb-3">
                    {isThai ? '📋 วิธีใช้งาน' : '📋 How to Use'}
                </h3>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>{isThai ? 'สร้าง Bot ใหม่จาก @BotFather' : 'Create new bot from @BotFather'}</li>
                    <li>{isThai ? 'สร้าง Group Chat สำหรับทดสอบ และเพิ่ม Bot เข้าไป' : 'Create test group chat and add the bot'}</li>
                    <li>{isThai ? 'ใส่ Bot Token และ Chat ID ด้านบน' : 'Enter Bot Token and Chat ID above'}</li>
                    <li>{isThai ? 'กด Set Webhook เพื่อเชื่อมต่อกับระบบ' : 'Click Set Webhook to connect to system'}</li>
                    <li>{isThai ? 'ส่งข้อความใน Group เพื่อทดสอบ เช่น "ยอดลาของ สมชาย"' : 'Send message in group to test, e.g. "Leave balance of Somchai"'}</li>
                </ol>
            </div>
        </div>
    );
}

