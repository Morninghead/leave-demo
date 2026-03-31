import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMobileUXV2, trackFeatureFlagEvent } from '../../hooks/useFeatureFlag';
import { MobileNavbarV1 } from './MobileNavbar/v1/MobileNavbar';
import { MobileNavbarV2 } from './MobileNavbar/v2/MobileNavbar';

export interface MobileNavbarProps {
  title?: string;
  showBackButton?: boolean;
  onBackButton?: () => void;
}

export function MobileNavbar(props: MobileNavbarProps) {
  const isV2 = useMobileUXV2();
  const location = useLocation();

  // Track which version is being viewed
  useEffect(() => {
    trackFeatureFlagEvent(
      'component_view',
      'mobileUXV2',
      isV2 ? 'treatment' : 'control',
      { component: 'MobileNavbar', path: location.pathname }
    );
  }, [isV2, location.pathname]);

  if (isV2) {
    return <MobileNavbarV2 {...props} />;
  }

  return <MobileNavbarV1 {...props} />;
}
