import { useCallback } from 'react';

type VibrationPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Hook to provide haptic feedback using the Navigator.vibrate API.
 * Gracefully degrades on devices that don't support it.
 */
export function useHaptic() {
    const trigger = useCallback((pattern: VibrationPattern) => {
        if (!navigator.vibrate) return;

        switch (pattern) {
            case 'light':
                navigator.vibrate(10); // Short, sharp tick
                break;
            case 'medium':
                navigator.vibrate(40); // Standard tacticle feedback
                break;
            case 'heavy':
                navigator.vibrate(70); // Distinct 'thud'
                break;
            case 'success':
                navigator.vibrate([30, 30, 30]); // Two quick pulses
                break;
            case 'warning':
                navigator.vibrate([100, 50, 100]); // Two longer pulses
                break;
            case 'error':
                navigator.vibrate([50, 50, 50, 50, 100]); // Three quick, one long
                break;
        }
    }, []);

    return { trigger };
}
