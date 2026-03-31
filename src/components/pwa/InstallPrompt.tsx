import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const { t } = useTranslation();
    const { isMobile } = useDevice();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    useEffect(() => {
        // Only show on mobile devices
        if (!isMobile && !isIOS) return;

        const handler = (e: BeforeInstallPromptEvent) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowPrompt(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, [isMobile, isIOS]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            // Fallback for iOS explanation can be added here if needed
            return;
        }

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        // We've used the prompt, and can't use it again, discard it
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    if (!showPrompt) return null;

    return (
        <div className={`fixed ${isMobile ? 'bottom-24' : 'bottom-6'} left-4 right-4 z-50 bg-gray-900 border border-gray-700 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-4`}>
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                    <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">{t('pwa.install_app', 'Install App')}</h3>
                    <p className="text-xs text-gray-300">{t('pwa.add_to_home', 'Add to home screen')}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={handleInstallClick}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                    {t('pwa.install', 'Install')}
                </button>
                <button
                    onClick={() => setShowPrompt(false)}
                    className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Close install prompt"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>
        </div>
    );
}
