// src/api/settings.ts
import { logger } from '../utils/logger';
import api from './auth';

// ✅ เพิ่ม Interface สำหรับ Branding Settings
export interface BrandingSettings {
  logo: {
    type: 'icon' | 'image';
    iconName?: string;
    imagePath?: string;
    backgroundColor: string;
    width: number;
    height: number;
    iconSize?: number;
    rounded: string;
  };
  primaryColor: string;
  enable_ai_widget?: boolean; // New toggle for AI Widget
}

// ✅ อัปเดต Settings Interface
export interface Settings {
  id: string;
  company_name_th: string;
  company_name_en: string;
  working_days_per_week: number;
  branding_settings: BrandingSettings;
  require_1_year_tenure_for_vacation?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateSettingsData {
  company_name_th?: string;
  company_name_en?: string;
  working_days_per_week?: number;
  branding_settings?: BrandingSettings;
  require_1_year_tenure_for_vacation?: boolean;
}

// Get settings with better error handling
export async function getSettings(): Promise<Settings | null> {
  try {
    const response = await api.get<{ success: boolean; settings: Settings | null }>(
      '/settings'
    );

    logger.log('✅ Settings API Response:', response.data);
    if (response.data?.settings) {
      if (!response.data.settings.branding_settings) {
        response.data.settings.branding_settings = {
          logo: {
            type: 'icon',
            iconName: 'Calendar',
            backgroundColor: '#2563eb',
            width: 64,
            height: 64,
            iconSize: 48,
            rounded: 'lg',
            imagePath: '',
          },
          primaryColor: '#2563eb',
        };
      }
      return response.data.settings;
    }
    return null;

  } catch (error: any) {
    logger.error('❌ Get settings error:', error);
    logger.error('Error response:', error.response?.data);
    logger.error('Error status:', error.response?.status);

    // If 401 error, don't log repeatedly - just return null
    if (error.response?.status === 401) {
      logger.log('🔐 Settings API: Authentication required - not logged in');
      return null;
    }

    // ✅ Return null instead of throwing - ให้ component จัดการเอง
    return null;
  }
}

// Update settings
export async function updateSettings(data: UpdateSettingsData): Promise<Settings | null> {
  try {
    const response = await api.put<{ success: boolean; settings: Settings; message: string }>(
      '/settings',
      data
    );

    logger.log('✅ Update settings response:', response.data);
    return response.data?.settings || null;

  } catch (error: any) {
    logger.error('❌ Update settings error:', error);
    logger.error('Error response:', error.response?.data);

    // ✅ Throw error สำหรับ update เพราะต้องแจ้ง user
    throw new Error(error.response?.data?.message || 'Failed to update settings');
  }
}
