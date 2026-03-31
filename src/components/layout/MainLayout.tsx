// src/components/layout/MainLayout.tsx
import { ReactNode } from 'react';
import { DeviceAwareNavbar } from './DeviceAwareNavbar';
import { BottomNavigation } from './BottomNavigation';
import { PasswordChangeModal } from '../auth/PasswordChangeModal';
import { useAuth } from '../../hooks/useAuth';
import { useDevice } from '../../contexts/DeviceContext';
import { InstallPrompt } from '../pwa/InstallPrompt';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { requiresPasswordChange } = useAuth();
  const { isMobile, isTablet } = useDevice();

  // Show bottom nav on mobile and tablet
  const showBottomNav = isMobile || isTablet;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Password Change Modal - Only show if password change is required */}
      {requiresPasswordChange && (
        <PasswordChangeModal
          isOpen={requiresPasswordChange}
          onClose={() => { }} // Cannot close when forced
          isForced={true}
          isOwnPassword={true}
        />
      )}

      {/* Only show navbar and main content if password change is not required */}
      {!requiresPasswordChange && (
        <>
          {/* ✅ Device-aware Navbar */}
          <DeviceAwareNavbar />

          {/* ✅ Main content with padding for navbars */}
          <main className={`pt-4 ${showBottomNav ? 'pb-20' : ''}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>

          {/* ✅ Bottom Navigation for mobile/tablet */}
          {showBottomNav && <BottomNavigation />}

          {/* ✅ PWA Install Prompt */}
          <InstallPrompt />
        </>
      )}
    </div>
  );
}
