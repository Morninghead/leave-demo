import api from './auth';
import { logger } from '../utils/logger';
import axios from 'axios';

export interface CompanySettings {
  [key: string]: string;
}

// Get all company settings
export const getCompanySettings = async (): Promise<CompanySettings> => {
  try {
    const response = await api.get('/company-settings');
    return response.data.settings || {};
  } catch (error) {
    logger.error('Failed to get company settings:', error);
    // Return default settings if request fails
    return {
      work_days_per_week: '5',
      weekend_days: '0,6', // Sunday and Saturday
    };
  }
};

// Get specific setting
export const getCompanySetting = async (key: string): Promise<string> => {
  try {
    const settings = await getCompanySettings();
    return settings[key] || '';
  } catch (error) {
    logger.error(`Failed to get company setting "${key}":`, error);
    return '';
  }
};

// Update company setting (HR/Admin only)
export const updateCompanySetting = async (
  key: string,
  value: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.put('/company-settings', {
      setting_key: key,
      setting_value: value
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to update company setting:', error);
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as { message?: string };
      throw new Error(data.message || 'Failed to update company setting');
    }
    throw new Error('Failed to update company setting');
  }
};