// src/components/common/Logo.tsx
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../hooks/useSettings';
import * as Icons from 'lucide-react';

interface LogoProps {
  showText?: boolean;  // ❌ เก็บไว้แต่ไม่ใช้แล้ว
  className?: string;
  size?: 'small' | 'medium' | 'navbar' | 'large'; // ✅ Add size prop for different contexts
}

export function Logo({ className = '', size = 'medium' }: LogoProps) {
  const { settings, loading } = useSettings();

  // Size configurations for different contexts
  const sizeConfig = {
    small: { width: 32, height: 32, iconSize: 20 },   // For mobile/compact
    medium: { width: 40, height: 40, iconSize: 24 },  // For navbar (default)
    navbar: { width: 56, height: 56, iconSize: 32 },  // For navbar - larger logo
    large: { width: 64, height: 64, iconSize: 48 }    // For settings preview
  };

  const currentSize = sizeConfig[size];

  // Default fallback while loading
  if (loading || !settings) {
    return (
      <div className={`flex items-center ${className}`}>
        <div
          className="bg-blue-600 rounded-lg flex items-center justify-center"
          style={{ width: `${currentSize.width}px`, height: `${currentSize.height}px` }}
        >
          <Icons.Calendar size={currentSize.iconSize} className="text-white" />
        </div>
      </div>
    );
  }

  const { branding_settings } = settings;
  const logo = branding_settings?.logo;

  return (
    <div className={`flex items-center ${className}`}>
      {/* Logo Icon/Image */}
      {logo?.type === 'icon' && logo.iconName ? (
        <div
          className={`flex items-center justify-center rounded-${logo.rounded || 'lg'}`}
          style={{
            width: `${currentSize.width}px`,
            height: `${currentSize.height}px`,
            backgroundColor: logo.backgroundColor || '#2563eb',
          }}
        >
          {React.createElement(
            Icons[logo.iconName as keyof typeof Icons] as any,
            {
              className: 'text-white',
              size: currentSize.iconSize,
            }
          )}
        </div>
      ) : logo?.type === 'image' && logo.imagePath ? (
        <img
          src={logo.imagePath}
          alt="Company Logo"
          width={currentSize.width}
          height={currentSize.height}
          className={`rounded-${logo.rounded || 'lg'} object-contain`}
          onError={(e) => {
            // Fallback to icon logo if image fails to load
            console.error('Failed to load logo image:', logo.imagePath);
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        // Fallback
        <div
          className="bg-blue-600 rounded-lg flex items-center justify-center"
          style={{ width: `${currentSize.width}px`, height: `${currentSize.height}px` }}
        >
          <Icons.Calendar size={currentSize.iconSize} className="text-white" />
        </div>
      )}

      {/* ✅ ลบ Company Name ออก - ให้ Navbar จัดการเอง */}
    </div>
  );
}
