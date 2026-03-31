// src/config/branding.ts
export const BRANDING = {
  // ✅ ชื่อแอปพลิเคชัน
  appName: 'Portfolio Leave Demo',
  appNameShort: 'Leave Demo',
  
  // ✅ สี Theme
  primaryColor: '#2563eb', // blue-600
  
  // ✅ Logo Configuration
  logo: {
    // Option 1: ใช้ Icon Component
    type: 'icon' as 'icon' | 'image',
    iconName: 'Calendar', // lucide-react icon name
    
    // Option 2: ใช้รูปภาพ
    // type: 'image',
    // imagePath: '/logo.png',
    // imageAlt: 'SSTH Logo',
    
    // ขนาด
    width: 40,
    height: 40,
    iconSize: 24,
    
    // สไตล์
    backgroundColor: '#2563eb', // blue-600
    rounded: 'lg', // rounded-lg
  },
};
