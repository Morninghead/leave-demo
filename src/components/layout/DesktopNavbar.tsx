import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { LanguageSwitcher } from '../language/LanguageSwitcher';
import { Logo } from '../common/logo';
import { PasswordChangeModal } from '../auth/PasswordChangeModal';
import { canAccessRoute } from '../../utils/permissions';
import {
  ChevronDown,
  Key,
  LogOut
} from 'lucide-react';

import { NAVIGATION_CONFIG, MenuItem } from '../../config/navigation';

// ... Helper functions remain the same ...
const getDisplayName = (
  firstNameTh: string | null | undefined,
  lastNameTh: string | null | undefined,
  firstNameEn: string | null | undefined,
  lastNameEn: string | null | undefined,
  language: string,
  t: (key: string) => string
): string => {
  const fth = firstNameTh?.trim();
  const lth = lastNameTh?.trim();
  const fen = firstNameEn?.trim();
  const len = lastNameEn?.trim();

  if (language === 'th') {
    if (fth && lth) return `${fth} ${lth}`;
    if (fth) return fth;
    if (fen && len) return `${fen} ${len}`;
    if (fen) return fen;
    return t('common.user');
  } else {
    if (fen && len) return `${fen} ${len}`;
    if (fen) return fen;
    if (fth && lth) return `${fth} ${lth}`;
    if (fth) return fth;
    return t('common.user');
  }
};

const getShortName = (
  firstNameTh: string | null | undefined,
  firstNameEn: string | null | undefined,
  language: string,
  t: (key: string) => string
): string => {
  const fth = firstNameTh?.trim();
  const fen = firstNameEn?.trim();
  if (language === 'th') {
    return fth || fen || t('common.user');
  } else {
    return fen || fth || t('common.user');
  }
};

const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, handler]);
};



interface DesktopNavbarProps {
  title?: string;
  showBackButton?: boolean;
  onBackButton?: () => void;
}

export function DesktopNavbar({
  title: _title,
  showBackButton: _showBackButton = false,
  onBackButton: _onBackButton
}: DesktopNavbarProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, loading: settingsLoading } = useSettings();

  const companyNameTh = settings?.company_name_th || t('common.company');
  const companyNameEn = settings?.company_name_en || t('common.company');

  const handleLogout = () => {
    logout();
    navigate('/login');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // State for dropdowns
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useClickOutside(userMenuRef, () => setShowUserMenu(false));
  useClickOutside(navRef, () => setActiveDropdown(null));

  const companyName = useMemo(() => {
    return i18n.language === 'th' ? companyNameTh : companyNameEn;
  }, [i18n.language, companyNameTh, companyNameEn]);

  const displayName = user
    ? getDisplayName(
      user.first_name_th,
      user.last_name_th,
      user.first_name_en,
      user.last_name_en,
      i18n.language,
      t
    )
    : '';

  const shortName = user
    ? getShortName(user.first_name_th, user.first_name_en, i18n.language, t)
    : '';

  // Menu Configuration

  // Helper to translate config items
  const translateMenuItem = (item: MenuItem): any => {
    return {
      ...item,
      label: i18n.language === 'th' ? item.labelTh : item.label,
      children: item.children ? item.children.map(translateMenuItem) : undefined
    };
  };

  // Menu Configuration
  const menuGroups = useMemo(() => {
    return NAVIGATION_CONFIG.map(translateMenuItem);
  }, [i18n.language]);

  // Helper to check access
  const hasAccess = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    if (!user) return false;
    return canAccessRoute(user, roles as any[]);
  };

  // Helper to check active state including children
  const isActive = (item: MenuItem) => {
    if (item.path && location.pathname.startsWith(item.path)) return true;
    if (item.children) {
      return item.children.some(child => child.path && location.pathname.startsWith(child.path));
    }
    return false;
  };

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50" ref={navRef}>
        <div className="w-full max-w-full px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left spacer for balancing center elements */}
            <div className="flex-1 min-w-0"></div>

            {/* Center - Logo and Navigation Menu */}
            <div className="flex items-center justify-center shrink-0 gap-4 xl:gap-8">
              {/* Logo and Company */}
              <div
                className="flex items-center gap-2 cursor-pointer min-w-0 shrink-0 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-gray-50 hover:shadow-sm"
                onClick={() => navigate('/dashboard')}
              >
                <Logo size="navbar" />
                {!settingsLoading && (
                  <span className="hidden xl:block text-sm font-semibold text-gray-900 whitespace-nowrap px-2">
                    {companyName}
                  </span>
                )}
              </div>

              {/* Navigation Menu */}
              <div className="hidden md:flex items-center min-w-0 gap-1 lg:gap-2">
                {menuGroups.map((group, index) => {
                  // Check group access
                  if (group.roles && !hasAccess(group.roles)) return null;

                  // If group has children, check if at least one child is accessible
                  if (group.children) {
                    const accessibleChildren = group.children.filter(child => !child.roles || hasAccess(child.roles));
                    if (accessibleChildren.length === 0) return null;
                  }

                  const isGroupActive = isActive(group);
                  const isDropdownOpen = activeDropdown === group.label;

                  if (group.children) {
                    return (
                      <div key={index} className="relative">
                        <button
                          onClick={() => setActiveDropdown(isDropdownOpen ? null : group.label)}
                          className={`flex cursor-pointer items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
                                          ${isGroupActive || isDropdownOpen
                              ? 'text-blue-600 bg-blue-50'
                              : 'text-gray-600 hover:-translate-y-px hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm active:translate-y-0'}`}
                        >
                          {group.icon && <group.icon className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />}
                          <span className="hidden lg:inline">{group.label}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {group.children.map((child, childIndex) => {
                              if (child.roles && !hasAccess(child.roles)) return null;

                              const isChildActive = child.path && location.pathname.startsWith(child.path);

                              return (
                                <button
                                  key={childIndex}
                                  onClick={() => {
                                    if (child.path) navigate(child.path);
                                    setActiveDropdown(null);
                                  }}
                                  className={`flex cursor-pointer items-center gap-3 w-full rounded-md px-4 py-2.5 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
                                                          ${isChildActive
                                      ? 'text-blue-600 bg-blue-50 font-medium'
                                      : 'text-gray-700 hover:bg-blue-50/70 hover:text-blue-700'}`}
                                >
                                  {child.icon && <child.icon className="h-4 w-4 opacity-70" />}
                                  {child.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (group.path) navigate(group.path);
                          setActiveDropdown(null);
                        }}
                        className={`flex cursor-pointer items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
                                      ${isGroupActive
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-600 hover:-translate-y-px hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm active:translate-y-0'}`}
                      >
                        {group.icon && <group.icon className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />}
                        <span className="hidden lg:inline">{group.label}</span>
                      </button>
                    );
                  }
                })}
              </div>
            </div>

            {/* Right side - User Actions */}
            <div className="flex-1 flex items-center justify-end gap-2 lg:gap-3 shrink-0 ml-4">
              <LanguageSwitcher />
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-gray-200">
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {shortName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-sm text-left hidden 2xl:block">
                      <div className="font-medium text-gray-900">{displayName}</div>
                      <div className="text-xs text-gray-500">{user?.employee_code}</div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>

                  {/* User Dropdown Menu */}
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          setShowPasswordChangeModal(true);
                          setShowUserMenu(false);
                        }}
                        className="flex cursor-pointer items-center gap-2 w-full rounded-md px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      >
                        <Key className="h-4 w-4" />
                        {i18n.language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
                      </button>
                      <hr className="my-1 border-gray-200" />
                      <button
                        onClick={handleLogout}
                        className="flex cursor-pointer items-center gap-2 w-full rounded-md px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('auth.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

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
