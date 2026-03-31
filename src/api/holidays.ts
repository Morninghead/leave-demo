import api from './auth';
import { logger } from '../utils/logger';

export interface Holiday {
  id: string;
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type: 'company' | 'public' | 'religious';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name_th?: string;
  created_by_name_en?: string;
  notes?: string;
  location?: string;
}

export interface HolidayFormData {
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type?: 'company' | 'public' | 'religious';
  departments?: string[];
  notify_days_before?: number;
  notification_message?: string;
  location?: string;
  notes?: string;
}

// Get company holidays for a specific year
export const getCompanyHolidays = async (year: string): Promise<Holiday[]> => {
  try {
    const response = await api.get(`/company-holidays?year=${year}`);
    return response.data.holidays || [];
  } catch (error: any) {
    logger.error('Failed to get company holidays:', error);
    throw error;
  }
};

// Add a new company holiday
export const addCompanyHoliday = async (formData: HolidayFormData): Promise<any> => {
  try {
    logger.log('📤 Sending holiday data:', formData);
    const response = await api.post('/company-holidays', formData);
    return response.data;
  } catch (error: any) {
    logger.error('❌ Failed to add company holiday:', error);
    logger.error('❌ Error response:', error.response?.data);
    throw error;
  }
};

// Update an existing company holiday
export const updateCompanyHoliday = async (holidayId: string, formData: HolidayFormData): Promise<any> => {
  try {
    const response = await api.put(`/company-holidays/${holidayId}`, formData);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to update company holiday:', error);
    throw error;
  }
};

// Delete a company holiday
export const deleteCompanyHoliday = async (holidayId: string): Promise<void> => {
  try {
    await api.delete(`/company-holidays/${holidayId}`);
  } catch (error: any) {
    logger.error('Failed to delete company holiday:', error);
    throw error;
  }
};