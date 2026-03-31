// src/api/leaveTypes.ts
import { logger } from '../utils/logger';

import api from './auth';

export interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description_th?: string;
  description_en?: string;
  default_days: number;
  requires_attachment: boolean;
  is_paid: boolean;
  color_code: string;
  is_active: boolean;
  color: string;
  allow_hourly_leave?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all leave types
 */
export async function getLeaveTypes(): Promise<LeaveType[]> {
  try {
    const response = await api.get<{
      success: boolean;
      leave_types: LeaveType[];
    }>('/leave-types');
    if (!response.data.success) {
      throw new Error('Failed to get leave types');
    }
    return response.data.leave_types || [];
  } catch (error: any) {
    logger.error('Get leave types error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to get leave types'
    );
  }
}

/**
 * Create new leave type
 */
export async function createLeaveType(data: Partial<LeaveType>): Promise<LeaveType> {
  try {
    const response = await api.post<{
      success: boolean;
      leave_type: LeaveType;
    }>('/leave-type-create', data);
    if (!response.data.success) {
      throw new Error('Failed to create leave type');
    }
    return response.data.leave_type;
  } catch (error: any) {
    logger.error('Create leave type error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to create leave type'
    );
  }
}

/**
 * Update leave type
 */
export async function updateLeaveType(id: string, data: Partial<LeaveType>): Promise<LeaveType> {
  try {
    const response = await api.put<{
      success: boolean;
      leave_type: LeaveType;
    }>('/leave-type-update', { ...data, id });
    if (!response.data.success) {
      throw new Error('Failed to update leave type');
    }
    return response.data.leave_type;
  } catch (error: any) {
    logger.error('Update leave type error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to update leave type'
    );
  }
}

/**
 * Delete leave type
 * @deprecated Use deleteLeaveType from src/api/leave.ts instead
 */
export async function deleteLeaveType(id: string): Promise<void> {
  logger.warn('⚠️ [DEPRECATED] deleteLeaveType from leaveTypes.ts is deprecated. Use deleteLeaveType from src/api/leave.ts instead');
  try {
    const response = await api.delete<{
      success: boolean;
    }>('/leave-type-delete', {
      data: { id },
    });
    if (!response.data.success) {
      throw new Error('Failed to delete leave type');
    }
  } catch (error: any) {
    logger.error('Delete leave type error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to delete leave type'
    );
  }
}
