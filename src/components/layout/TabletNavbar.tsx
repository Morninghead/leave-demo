import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LogOut,
  ChevronDown,
  Menu,
  X,
  Key,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAVIGATION_CONFIG, MenuItem } from '../../config/navigation';
import { canAccessRoute } from '../../utils/permissions';
import { LanguageSwitcher } from '../language/LanguageSwitcher';
import { PasswordChangeModal } from '../auth/PasswordChangeModal';

interface TabletNavbarProps {
  title?: string;
  showBackButton?: boolean;
  onBackButton?: () => void;
}

export function TabletNavbar({
  title,
  showBackButton = false,
  onBackButton
}: TabletNavbarProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  // Close menus when location changes
  React.useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };



  // Helper to flatten menu items for tablet view if needed, or translate
  const translateMenuItem = (item: MenuItem): any => {
    return {
      ...item,
      label: i18n.language === 'th' ? item.labelTh : item.label,
      children: item.children ? item.children.map(translateMenuItem) : undefined
    };
  };

  // Menu Configuration
  const menuItems = useMemo(() => {
    // For tablet, we might want a flattened list or just top level?
    // Current design uses horizontal scroll. Let's flatten children into the main list for easier access
    // OR keep top level and let users drill down?
    // Given "Tablet" is often touch, dropdowns can be tricky if not implemented well.
    // Let's TRY to keep top level consistent with Desktop but maybe flatten specific high-value items?
    // Actually, let's stick to the Grouped approach -> Tablets can handle dropdowns/modals.
    // BUT the current TabletNavbar implementation expects a flat list for `navigationItems`.

    // Let's FLATTEN the config for Tablet for now for simplicity and big touch targets
    const flatItems: any[] = [];
    const processItem = (item: any) => {
      flatItems.push(item);
      if (item.children) {
        item.children.forEach(processItem);
      }
    };

    NAVIGATION_CONFIG.map(translateMenuItem).forEach(processItem);

    // Only keep items with paths (clickable)
    return flatItems.filter(item => item.path);
  }, [i18n.language]);

  const navigationItems = menuItems
    .filter((item) => {
      if (!item.roles) return true;
      if (!user) return false;
      return canAccessRoute(user, item.roles as any[]);
    })
    .map((item) => ({
      ...item,
      active: location.pathname === item.path || location.pathname.startsWith(item.path + '/'),
    }));

  return (
    <>
      {/* Top Navigation Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {showBackButton ? (
              <button
                onClick={onBackButton || (() => navigate(-1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            ) : (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isMenuOpen ? (
                  <X className="w-5 h-5 text-gray-600" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600" />
                )}
              </button>
            )}
            {title && (
              <h1 className="text-xl font-semibold text-gray-900">
                {title}
              </h1>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.first_name_th?.charAt(0) || user?.first_name_en?.charAt(0) || user?.employee_code?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.first_name_th || user?.first_name_en} {user?.last_name_th || user?.last_name_en}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.first_name_th || user?.first_name_en} {user?.last_name_th || user?.last_name_en}
                    </p>
                    <p className="text-xs text-gray-500">{user?.employee_code}</p>
                    <p className="text-xs text-gray-400 capitalize">{user?.department_name_en || '-'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPasswordChangeModal(true);
                      setIsProfileOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Key className="h-4 w-4" />
                    {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('navigation.logout', 'Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tablet Navigation Tabs */}
        <div className="px-6 pb-3">
          <div className="flex gap-1 overflow-x-auto">
            {navigationItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${item.active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side Navigation Menu (for hamburger menu) */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setIsMenuOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {/* Menu Header */}
          <div
            className="p-6 border-b border-gray-200"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-white">
                  {user?.first_name_th?.charAt(0) || user?.first_name_en?.charAt(0) || user?.employee_code?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <p className="text-base font-medium text-gray-900">
                  {user?.first_name_th || user?.first_name_en} {user?.last_name_th || user?.last_name_en}
                </p>
                <p className="text-sm text-gray-500">{user?.employee_code}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role} • {user?.department_name_en || '-'}</p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4">
            {navigationItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate(item.path);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${item.active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Spacer for fixed header (accounts for top bar + navigation tabs) */}
      <div className="h-28"></div>

      {/* Password Change Modal */}
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
