// src/api/leave-policy.ts
import { logger } from '../utils/logger';

import api from './auth';

export interface LeavePolicy {
  id: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  year: number;
  default_days: number;
  effective_from: string;
  effective_until?: string;
  notes?: string;
  is_active: boolean;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get leave policies for a specific year
 */
export async function getLeavePolicies(year?: number): Promise<LeavePolicy[]> {
  try {
    const currentYear = year || new Date().getFullYear();
    const response = await api.get<{
      success: boolean;
      leave_policies: LeavePolicy[];
    }>('/leave-policies', {
      params: { year: currentYear },
    });
    if (!response.data.success) {
      throw new Error('Failed to get leave policies');
    }
    return response.data.leave_policies || [];
  } catch (error: any) {
    logger.error('Get leave policies error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to get leave policies'
    );
  }
}

/**
 * Get leave policy by ID
 */
export async function getLeavePolicyById(id: string): Promise<LeavePolicy> {
  try {
    const response = await api.get<{
      success: boolean;
      leave_policy: LeavePolicy;
    }>(`/leave-policy/${id}`);
    if (!response.data.success) {
      throw new Error('Failed to get leave policy');
    }
    return response.data.leave_policy;
  } catch (error: any) {
    logger.error('Get leave policy error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to get leave policy'
    );
  }
}

/**
 * Create policies for new year
 */
export async function createLeavePolicies(
  year: number,
  copyFromYear?: number
): Promise<LeavePolicy[]> {
  try {
    const response = await api.post<{
      success: boolean;
      leave_policies: LeavePolicy[];
    }>('/leave-policy-create', {
      year,
      copy_from_year: copyFromYear,
    });
    if (!response.data.success) {
      throw new Error('Failed to create leave policies');
    }
    return response.data.leave_policies || [];
  } catch (error: any) {
    logger.error('Create leave policies error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to create leave policies'
    );
  }
}

/**
 * Alias for backward compatibility
 */
export const createLeavePoliciesForYear = createLeavePolicies;


/**
 * Update leave policy
 */
export async function updateLeavePolicy(
  id: string,
  data: { default_days: number; notes?: string }
): Promise<LeavePolicy> {
  try {
    const response = await api.put<{
      success: boolean;
      leave_policy: LeavePolicy;
    }>(`/leave-policy-update/${id}`, data);
    if (!response.data.success) {
      throw new Error('Failed to update leave policy');
    }
    return response.data.leave_policy;
  } catch (error: any) {
    logger.error('Update leave policy error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to update leave policy'
    );
  }
}

/**
 * Delete leave policy
 */
export async function deleteLeavePolicy(id: string): Promise<void> {
  try {
    const response = await api.delete<{
      success: boolean;
    }>(`/leave-policy-delete/${id}`);
    if (!response.data.success) {
      throw new Error('Failed to delete leave policy');
    }
  } catch (error: any) {
    logger.error('Delete leave policy error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to delete leave policy'
    );
  }
}

/**
 * Toggle leave policy active status
 */
export async function toggleLeavePolicyStatus(id: string): Promise<LeavePolicy> {
  try {
    const response = await api.put<{
      success: boolean;
      leave_policy: LeavePolicy;
    }>(`/leave-policy-toggle/${id}`);
    if (!response.data.success) {
      throw new Error('Failed to toggle leave policy status');
    }
    return response.data.leave_policy;
  } catch (error: any) {
    logger.error('Toggle leave policy status error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to toggle leave policy status'
    );
  }
}

/**
 * Auto-sync: Ensure new leave types are always present as leave policies for a year
 */
export async function syncLeavePolicyForYear(year: number): Promise<{ success: boolean, added: number }> {
  try {
    const response = await api.post<{
      success: boolean;
      added: number;
    }>('/leave-policy-sync', { year });
    if (!response.data.success) {
      throw new Error('Failed to sync leave policies');
    }
    return response.data;
  } catch (error: any) {
    logger.error('Sync leave policy error:', error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to sync leave policy'
    );
  }
}
