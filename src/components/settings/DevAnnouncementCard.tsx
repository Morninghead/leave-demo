import { useState } from 'react';
import { Send, Megaphone, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../hooks/useToast';
import api from '../../api/auth';

export function DevAnnouncementCard() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);
        try {
            await api.post('/dev-announce', { message });
            showToast('Announcement sent to Telegram', 'success');
            setMessage('');
        } catch (error: any) {
            console.error('Failed to send announcement:', error);
            showToast('Failed to send announcement', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Megaphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Developer Announcement</h3>
                        <p className="text-orange-50 text-sm">Send updates directly to Telegram channel</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Announcement Message (Markdown Supported)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                            placeholder="e.g., 🚀 New feature update: Leave Cancellation is now live!..."
                        />
                        <p className="text-xs text-gray-500 mt-2 text-right">
                            Target: Telegram Group (-1002667543508)
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSend}
                            disabled={loading || !message.trim()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Send Announcement
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
