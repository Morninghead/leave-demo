import React from 'react';
import { useDevice } from '../../contexts/DeviceContext';
import { MobileNavbar } from './MobileNavbar';
import { TabletNavbar } from './TabletNavbar';
import { DesktopNavbar } from './DesktopNavbar';

interface DeviceAwareNavbarProps {
  title?: string;
  showBackButton?: boolean;
  onBackButton?: () => void;
}

export function DeviceAwareNavbar({
  title,
  showBackButton = false,
  onBackButton
}: DeviceAwareNavbarProps) {
  const { deviceType } = useDevice();

  switch (deviceType) {
    case 'mobile':
      return (
        <MobileNavbar
          title={title}
          showBackButton={showBackButton}
          onBackButton={onBackButton}
        />
      );
    case 'tablet':
      return (
        <TabletNavbar
          title={title}
          showBackButton={showBackButton}
          onBackButton={onBackButton}
        />
      );
    case 'desktop':
    default:
      return (
        <DesktopNavbar
          title={title}
          showBackButton={showBackButton}
          onBackButton={onBackButton}
        />
      );
  }
}