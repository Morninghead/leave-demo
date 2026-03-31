import { Fragment, ReactNode, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { useHaptic } from '../../hooks/useHaptic';

interface ResponsiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    className?: string; // Additional classes for the panel
    hideCloseButton?: boolean;
}

export function ResponsiveModal({
    isOpen,
    onClose,
    children,
    title,
    className = "",
    hideCloseButton = false
}: ResponsiveModalProps) {
    const { isMobile } = useDevice();
    const haptic = useHaptic();
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const handleClose = () => {
        haptic.trigger('light');
        onClose();
    };

    // Handle keyboard visibility on mobile devices
    useEffect(() => {
        if (!isMobile || !window.visualViewport) return;

        const handleResize = () => {
            if (window.visualViewport) {
                const height = window.innerHeight - window.visualViewport.height;
                setKeyboardHeight(height > 0 ? height : 0);
            }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, [isMobile]);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[60]" onClose={handleClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className={`flex min-h-full ${isMobile ? 'items-end justify-center' : 'items-center justify-center p-4'}`}>
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom={isMobile ? "translate-y-full opacity-0" : "opacity-0 scale-95"}
                            enterTo={isMobile ? "translate-y-0 opacity-100" : "opacity-100 scale-100"}
                            leave="ease-in duration-200"
                            leaveFrom={isMobile ? "translate-y-0 opacity-100" : "opacity-100 scale-100"}
                            leaveTo={isMobile ? "translate-y-full opacity-0" : "opacity-0 scale-95"}
                        >
                            <Dialog.Panel
                                className={`
                  w-full bg-white shadow-xl transform transition-all 
                  ${isMobile ? 'rounded-t-2xl px-0 pb-0 pt-0 max-h-[90vh]' : 'rounded-2xl max-w-2xl max-h-[90vh]'}
                  overflow-hidden
                  ${className}
                `}
                                style={{
                                    marginBottom: isMobile ? keyboardHeight : 0,
                                    maxHeight: isMobile ? `calc(90vh - ${keyboardHeight}px)` : '90vh'
                                }}
                            >
                                {/* Mobile Drag Handle */}
                                {isMobile && (
                                    <div className="w-full flex justify-center pt-2 pb-1 absolute top-0 z-20 pointer-events-none">
                                        <div className="w-12 h-1.5 bg-gray-300 rounded-full opacity-50"></div>
                                    </div>
                                )}

                                {/* Close Button (Generic) - Only show if not hidden and NO custom header is expected */}
                                {!hideCloseButton && (
                                    <button
                                        onClick={handleClose}
                                        className={`absolute ${isMobile ? 'top-4 right-4' : 'top-6 right-6'} p-3 min-w-[44px] min-h-[44px] flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-20`}
                                        aria-label="Close"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                )}

                                {/* Title for accessibility */}
                                {title && (
                                    <Dialog.Title className="sr-only">
                                        {title}
                                    </Dialog.Title>
                                )}

                                {children}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
