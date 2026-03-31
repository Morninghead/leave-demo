import React, { createContext, useContext, ReactNode } from 'react';
import { useDeviceDetection, DeviceInfo } from '../utils/deviceDetection';

interface DeviceContextType {
  deviceInfo: DeviceInfo;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

interface DeviceProviderProps {
  children: ReactNode;
}

export function DeviceProvider({ children }: DeviceProviderProps) {
  const deviceInfo = useDeviceDetection();

  const value: DeviceContextType = {
    deviceInfo,
    isMobile: deviceInfo.isMobile,
    isTablet: deviceInfo.isTablet,
    isDesktop: deviceInfo.isDesktop,
    deviceType: deviceInfo.deviceType,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextType {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}

// Export individual hooks for convenience
export function useIsMobile(): boolean {
  return useDevice().isMobile;
}

export function useIsTablet(): boolean {
  return useDevice().isTablet;
}

export function useIsDesktop(): boolean {
  return useDevice().isDesktop;
}

export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  return useDevice().deviceType;
}