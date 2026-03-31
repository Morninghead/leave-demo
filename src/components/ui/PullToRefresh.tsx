import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    disabled?: boolean;
    threshold?: number;
    refreshingText?: string;
    pullText?: string;
    releaseText?: string;
}

export function PullToRefresh({
    onRefresh,
    children,
    disabled = false,
    threshold = 80,
    refreshingText = 'Refreshing...',
    pullText = 'Pull to refresh',
    releaseText = 'Release to refresh',
}: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [canRefresh, setCanRefresh] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const isDragging = useRef(false);
    const haptic = useHaptic();
    const hasTriggeredHaptic = useRef(false);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (disabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) return;

        startY.current = e.touches[0].clientY;
        isDragging.current = true;
        hasTriggeredHaptic.current = false;
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging.current || disabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) {
            isDragging.current = false;
            setPullDistance(0);
            return;
        }

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Resistance effect - pull harder as you go further
            const distance = Math.min(diff * 0.5, threshold * 1.5);
            setPullDistance(distance);

            const newCanRefresh = distance >= threshold;
            setCanRefresh(newCanRefresh);

            // Haptic trigger on threshold cross
            if (newCanRefresh && !hasTriggeredHaptic.current) {
                haptic.trigger('medium');
                hasTriggeredHaptic.current = true;
            } else if (!newCanRefresh) {
                hasTriggeredHaptic.current = false;
            }

            if (distance > 10) {
                e.preventDefault();
            }
        }
    }, [disabled, isRefreshing, threshold, haptic]);

    const handleTouchEnd = useCallback(async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (canRefresh && !isRefreshing && !disabled) {
            setIsRefreshing(true);
            setPullDistance(threshold);
            haptic.trigger('light'); // Feedback that refresh started

            try {
                await onRefresh();
                haptic.trigger('success'); // Feedback that refresh finished
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
                setCanRefresh(false);
            }
        } else {
            setPullDistance(0);
            setCanRefresh(false);
        }
    }, [canRefresh, isRefreshing, disabled, onRefresh, threshold, haptic]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const indicatorOpacity = Math.min(pullDistance / threshold, 1);
    const indicatorRotation = isRefreshing ? 0 : (pullDistance / threshold) * 180;

    return (
        <div ref={containerRef} className="relative overflow-auto h-full">
            {/* Pull indicator */}
            <div
                className="absolute left-0 right-0 flex items-center justify-center transition-all z-10"
                style={{
                    height: `${pullDistance}px`,
                    top: 0,
                    opacity: indicatorOpacity,
                }}
            >
                <div className="flex items-center gap-2 text-blue-600">
                    <RefreshCw
                        className={`w-5 h-5 transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
                        style={{ transform: `rotate(${indicatorRotation}deg)` }}
                    />
                    <span
                        className="text-sm font-medium"
                        role="status"
                        aria-live="polite"
                    >
                        {isRefreshing ? refreshingText : canRefresh ? releaseText : pullText}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
                }}
            >
                {children}
            </div>
        </div>
    );
}
