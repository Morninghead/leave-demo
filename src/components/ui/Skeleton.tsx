import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
    className = '',
    variant = 'text',
    width,
    height,
    animation = 'pulse',
}: SkeletonProps) {
    const baseClasses = 'bg-gray-200';

    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: '',
        rounded: 'rounded-lg',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer',
        none: '',
    };

    const style: React.CSSProperties = {
        width: width,
        height: height || (variant === 'text' ? '1em' : undefined),
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
            style={style}
            role="status"
            aria-label="Loading"
        />
    );
}

// Common skeleton patterns
export function SkeletonCard() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="40%" height={12} />
                </div>
            </div>
            <Skeleton height={80} variant="rounded" />
            <div className="flex gap-2">
                <Skeleton width={80} height={32} variant="rounded" />
                <Skeleton width={80} height={32} variant="rounded" />
            </div>
        </div>
    );
}

export function SkeletonTableRow() {
    return (
        <tr className="border-b border-gray-100">
            <td className="px-4 py-3"><Skeleton width={100} /></td>
            <td className="px-4 py-3"><Skeleton width={150} /></td>
            <td className="px-4 py-3"><Skeleton width={120} /></td>
            <td className="px-4 py-3"><Skeleton width={80} /></td>
            <td className="px-4 py-3"><Skeleton width={60} /></td>
        </tr>
    );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div className="flex-1 space-y-2">
                        <Skeleton width="70%" height={16} />
                        <Skeleton width="50%" height={12} />
                    </div>
                    <Skeleton width={60} height={24} variant="rounded" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="space-y-6 p-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                        <Skeleton width={80} height={12} className="mb-2" />
                        <Skeleton width={60} height={32} />
                    </div>
                ))}
            </div>

            {/* Main content */}
            <div className="grid md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
            </div>

            {/* List */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
                <Skeleton width={150} height={20} className="mb-4" />
                <SkeletonList count={3} />
            </div>
        </div>
    );
}
