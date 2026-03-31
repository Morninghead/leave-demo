import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, CalendarCheck, ClipboardCheck, BarChart3, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { canAccessRoute } from '../../utils/permissions';
import { useHaptic } from '../../hooks/useHaptic';

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
    roles?: string[];
}

export function BottomNavigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { user } = useAuth();
    const haptic = useHaptic();

    const navItems: NavItem[] = [
        {
            icon: Home,
            label: t('nav.dashboard'),
            path: '/dashboard',
        },
        {
            icon: CalendarCheck,
            label: t('nav.leave', 'Leave'),
            path: '/leave',
        },
        {
            icon: ClipboardCheck,
            label: t('nav.probation', 'Probation'),
            path: '/probation-evaluations',
            roles: ['leader', 'manager', 'hr', 'admin', 'dev'],
        },
        {
            icon: CheckCircle2,
            label: t('nav.approvals', 'Approvals'),
            path: '/approval',
            roles: ['manager', 'hr', 'admin', 'dev'],
        },
        {
            icon: BarChart3,
            label: t('nav.reports', 'Reports'),
            path: '/reports',
            roles: ['manager', 'hr', 'admin', 'dev'],
        },
    ];

    // Filter items based on user role
    const visibleItems = navItems.filter((item) => {
        if (!item.roles) return true;
        if (!user) return false;
        return canAccessRoute(user, item.roles as any[]);
    });

    // For regular employees, show max 4 items
    const displayItems = visibleItems.length > 5 ? visibleItems.slice(0, 5) : visibleItems;

    const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
            {/* Main navigation content */}
            <div className="flex items-center justify-around h-16 px-2">
                {displayItems.map((item) => {
                    const active = isActive(item.path);
                    const Icon = item.icon;

                    return (
                        <button
                            key={`bottom-nav-${item.path}`}
                            onClick={() => {
                                haptic.trigger('light');
                                navigate(item.path);
                            }}
                            aria-label={item.label}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors ${active
                                ? 'text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <div className={`relative ${active ? 'scale-110' : ''} transition-transform`}>
                                <Icon className="w-5 h-5" />
                                {active && (
                                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
                                )}
                            </div>
                            <span className={`text-xs mt-1 truncate max-w-full ${active ? 'font-medium' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            {/* Safe area padding for devices with home indicator/notch */}
            <div
                className="bg-white"
                style={{
                    paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)'
                }}
            />
        </nav>
    );
}
