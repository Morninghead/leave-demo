import React, { useEffect } from 'react';
import { useMobileUXV2, trackFeatureFlagEvent } from '../../../hooks/useFeatureFlag';
import { MobileNavbarV1 } from './v1/MobileNavbar';
import { MobileNavbarV2 } from './v2/MobileNavbar';

interface MobileNavbarProps {
    title?: string;
    showBackButton?: boolean;
    onBackButton?: () => void;
}

export function MobileNavbar(props: MobileNavbarProps) {
    const isV2 = useMobileUXV2();

    // Track which version is being viewed
    useEffect(() => {
        trackFeatureFlagEvent(
            'component_view',
            'mobileUXV2',
            isV2 ? 'treatment' : 'control',
            { component: 'MobileNavbar' }
        );
    }, [isV2]);

    if (isV2) {
        return <MobileNavbarV2 {...props} />;
    }

    return <MobileNavbarV1 {...props} />;
}
