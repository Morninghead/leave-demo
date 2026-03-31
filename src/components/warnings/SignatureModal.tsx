import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Check, PenTool, RotateCcw, Smartphone, Trash2 } from 'lucide-react';
import { SignatureCanvas } from '../warning/SignatureCanvas';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (signatureData: string) => void;
    initialData: string | null;
}

export function SignatureModal({ isOpen, onClose, onConfirm, initialData }: SignatureModalProps) {
    const { t } = useTranslation();
    const signatureRef = useRef<string | null>(initialData);
    const [isMobile, setIsMobile] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);
    const [orientationLocked, setOrientationLocked] = useState(false);
    const [hasSignature, setHasSignature] = useState(!!initialData);
    const [clearTrigger, setClearTrigger] = useState(0);

    // Detect mobile and orientation
    useEffect(() => {
        const checkDevice = () => {
            const mobile = window.innerWidth < 768 || 'ontouchstart' in window;
            const portrait = window.innerHeight > window.innerWidth;
            setIsMobile(mobile);
            setIsPortrait(portrait);
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);
        window.addEventListener('orientationchange', checkDevice);
        return () => {
            window.removeEventListener('resize', checkDevice);
            window.removeEventListener('orientationchange', checkDevice);
        };
    }, []);

    // Try to lock orientation to landscape when modal opens on mobile
    useEffect(() => {
        if (!isOpen) return;

        const lockOrientation = async () => {
            try {
                // Try Screen Orientation API
                if (screen.orientation && 'lock' in screen.orientation) {
                    await (screen.orientation as any).lock('landscape');
                    setOrientationLocked(true);
                }
            } catch (e) {
                // Orientation lock not supported or denied
                console.log('Orientation lock not available');
            }
        };

        if (isMobile && isPortrait) {
            lockOrientation();
        }

        return () => {
            // Unlock orientation when modal closes
            if (orientationLocked && screen.orientation && 'unlock' in screen.orientation) {
                try {
                    (screen.orientation as any).unlock();
                } catch (e) {
                    // Ignore unlock errors
                }
            }
            setOrientationLocked(false);
        };
    }, [isOpen, isMobile, isPortrait, orientationLocked]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (signatureRef.current) {
            onConfirm(signatureRef.current);
            onClose();
        } else {
            // This shouldn't happen if hasSignature is true, but log for debugging
            console.warn('handleSave called but signatureRef.current is null. hasSignature:', hasSignature);
        }
    };

    const handleSignatureChange = (data: string | null) => {
        signatureRef.current = data;
        setHasSignature(!!data);
    };

    const handleClear = () => {
        signatureRef.current = null;
        setHasSignature(false);
        setClearTrigger(prev => prev + 1);
    };

    // Show rotate prompt if on mobile portrait and orientation couldn't be locked
    const showRotatePrompt = isMobile && isPortrait && !orientationLocked;

    const modalContent = (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 touch-none">
            {showRotatePrompt ? (
                // Rotate device prompt with option to continue anyway
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mx-4 text-center max-w-sm">
                    <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <Smartphone className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                        {t('warning.rotateDevice') || 'Rotate Your Device'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('warning.rotateDeviceDesc') || 'Please rotate your device to landscape mode for the best signing experience'}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 mb-6">
                        <RotateCcw className="w-6 h-6 animate-spin" style={{ animationDuration: '3s' }} />
                        <span className="text-sm font-medium">90°</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => setIsPortrait(false)}
                            className="w-full px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            {t('warning.continueAnyway') || 'Continue in Portrait'}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                // Full-screen signature modal - compact layout for maximum canvas area
                <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800">
                    {/* Compact Header with Action Buttons */}
                    <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
                        <div className="flex items-center gap-2">
                            <PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                            <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">
                                {t('warning.signDocument')}
                            </h3>

                            {/* Status indicator */}
                            {hasSignature && (
                                <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-800 bg-green-200 border border-green-300 rounded-full">
                                    <Check className="w-3 h-3" />
                                    {t('warning.signatureProvided') || 'เซ็นชื่อแล้ว'}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons in Header */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* Clear button */}
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={!hasSignature}
                                className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">{t('warning.clearSignature') || 'ล้าง'}</span>
                            </button>

                            {/* Cancel button */}
                            <button
                                onClick={onClose}
                                className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                            >
                                {t('common.cancel')}
                            </button>

                            {/* Confirm button */}
                            <button
                                onClick={handleSave}
                                disabled={!hasSignature}
                                className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">{t('warning.confirmSignature')}</span>
                                <span className="sm:hidden">{t('common.confirm') || 'ยืนยัน'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Full Canvas Area - Maximum space */}
                    <div className="flex-1 p-1 sm:p-2 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 min-h-0 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
                            <SignatureCanvas
                                key={clearTrigger}
                                value={clearTrigger === 0 ? initialData : null}
                                onChange={handleSignatureChange}
                                required={true}
                                fullHeight={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return createPortal(modalContent, document.body);
}


