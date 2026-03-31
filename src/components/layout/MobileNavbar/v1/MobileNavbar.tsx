import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut, Key } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { canAccessRoute } from '../../../../utils/permissions';
import { NAVIGATION_CONFIG, MenuItem } from '../../../../config/navigation';
import { LanguageSwitcher } from '../../../language/LanguageSwitcher';
import { PasswordChangeModal } from '../../../auth/PasswordChangeModal';

interface MobileNavbarProps {
    title?: string;
    showBackButton?: boolean;
    onBackButton?: () => void;
}

export function MobileNavbarV1({
    title,
}: MobileNavbarProps) {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

    React.useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const translateMenuItem = (item: MenuItem): MenuItem => ({
        ...item,
        label: i18n.language === 'th' ? item.labelTh : item.label,
        children: item.children?.map(translateMenuItem),
    });

    const navigationItems = NAVIGATION_CONFIG.map(translateMenuItem)
        .filter((item) => {
            if (!item.roles) return true;
            if (!user) return false;
            return canAccessRoute(user, item.roles as any[]);
        })
        .map((item) => ({
            ...item,
            active: location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
        }));

    return (
        <>
            <div
                className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200"
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
            >
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                    >
                        {isMenuOpen ? (
                            <X className="w-6 h-6 text-gray-600" />
                        ) : (
                            <Menu className="w-6 h-6 text-gray-600" />
                        )}
                    </button>

                    {title && (
                        <h1 className="text-lg font-semibold text-gray-900 absolute left-1/2 transform -translate-x-1/2">
                            {title}
                        </h1>
                    )}

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                    </div>
                </div>
            </div>

            <div
                className={`fixed inset-0 z-40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setIsMenuOpen(false)}
                />

                <div
                    className={`absolute left-0 top-0 h-full w-[85vw] max-w-[320px] min-w-[280px] bg-white shadow-xl transform transition-transform duration-300 flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'
                        }`}
                >
                    <div
                        className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 shrink-0"
                        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <span className="text-lg font-medium text-white">
                                    {user?.first_name_th?.charAt(0) || user?.first_name_en?.charAt(0) || user?.employee_code?.charAt(0) || 'U'}
                                </span>
                            </div>
                            <div>
                                <p className="text-base font-medium text-white">
                                    {user?.first_name_th || user?.first_name_en} {user?.last_name_th || user?.last_name_en}
                                </p>
                                <p className="text-sm text-blue-100">{user?.employee_code}</p>
                                <p className="text-xs text-blue-200 capitalize">{user?.role} • {user?.department_name_en || '-'}</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 p-4 overflow-y-auto">
                        {navigationItems.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    navigate(item.path!);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${item.active
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div
                        className="border-t border-gray-200 bg-white p-4 shrink-0"
                        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 80px)' }}
                    >
                        <button
                            onClick={() => {
                                setShowPasswordChangeModal(true);
                                setIsMenuOpen(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors mb-2"
                        >
                            <Key className="h-4 w-4" />
                            {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            {t('navigation.logout', 'Logout')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-14"></div>

            {showPasswordChangeModal && (
                <PasswordChangeModal
                    isOpen={showPasswordChangeModal}
                    onClose={() => setShowPasswordChangeModal(false)}
                    isForced={false}
                    isOwnPassword={true}
                />
            )}
        </>
    );
}
