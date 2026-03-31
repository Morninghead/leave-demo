import { useState, useEffect } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getInitialDeviceInfo());

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      // Debounce resize events to prevent excessive re-renders
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 150);
    };

    const handleOrientationChange = () => {
      // Clear any pending resize handler
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Orientation changes need a bit more time to settle
      setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
}

function getInitialDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      deviceType: 'desktop',
      screenWidth: 1024,
      screenHeight: 768,
      orientation: 'landscape',
    };
  }

  return getDeviceInfo();
}

function getDeviceInfo(): DeviceInfo {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';

  // Mobile: 0-768px
  if (screenWidth <= 768) {
    return {
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      deviceType: 'mobile',
      screenWidth,
      screenHeight,
      orientation,
    };
  }

  // Tablet: 769-1024px
  if (screenWidth <= 1024) {
    return {
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      deviceType: 'tablet',
      screenWidth,
      screenHeight,
      orientation,
    };
  }

  // Desktop: 1025px+
  return {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: 'desktop',
    screenWidth,
    screenHeight,
    orientation,
  };
}

// Utility functions for quick device checks
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
}

export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > 768 && window.innerWidth <= 1024;
}

export function isDesktopDevice(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth > 1024;
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobileDevice()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  return 'desktop';
}

// Touch detection
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// High DPI display detection
export function isHighDPIDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.devicePixelRatio > 1;
}

// Device-specific breakpoints
export const BREAKPOINTS = {
  MOBILE_MAX: 768,
  TABLET_MAX: 1024,
  DESKTOP_MIN: 1025,
} as const;

// Device-specific class names for styling
export function getDeviceClassNames(baseClass: string): string {
  const deviceType = getDeviceType();
  return `${baseClass} ${baseClass}--${deviceType}`;
}