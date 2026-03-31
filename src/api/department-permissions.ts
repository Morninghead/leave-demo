// src/api/department-permissions.ts
import api from './auth';
import { logger } from '../utils/logger';

export interface DepartmentPermission {
    id: string;
    employee_id: string;
    department_id: string;
    department_name_th?: string;
    department_name_en?: string;
    permission_type: string;
    is_active: boolean;
    granted_at?: string;
    notes?: string;
}

// Get department permissions for an employee
export async function getDepartmentPermissions(employeeId: string): Promise<DepartmentPermission[]> {
    try {
        const response = await api.get<{
            success: boolean;
            permissions: DepartmentPermission[];
        }>('/department-permissions', {
            params: { employee_id: employeeId }
        });

        if (!response.data.success) {
            throw new Error('Failed to get department permissions');
        }

        return response.data.permissions || [];
    } catch (error: any) {
        logger.error('Get department permissions error:', error);
        throw new Error(
            error.response?.data?.error ||
            error.response?.data?.message ||
            'Failed to get department permissions'
        );
    }
}

// Add a single department permission
export async function addDepartmentPermission(
    employeeId: string,
    departmentId: string,
    permissionType: string = 'approve',
    notes?: string
): Promise<{ permission_id: string; message: string }> {
    try {
        const response = await api.post<{
            success: boolean;
            permission_id: string;
            message: string;
        }>('/department-permissions', {
            employee_id: employeeId,
            department_id: departmentId,
            permission_type: permissionType,
            notes
        });

        if (!response.data.success) {
            throw new Error('Failed to add department permission');
        }

        return response.data;
    } catch (error: any) {
        logger.error('Add department permission error:', error);
        throw new Error(
            error.response?.data?.error ||
            error.response?.data?.message ||
            'Failed to add department permission'
        );
    }
}

// Remove a department permission
export async function removeDepartmentPermission(
    employeeId: string,
    departmentId: string,
    permissionType: string = 'approve'
): Promise<{ message: string }> {
    try {
        const response = await api.delete<{
            success: boolean;
            message: string;
        }>('/department-permissions', {
            data: {
                employee_id: employeeId,
                department_id: departmentId,
                permission_type: permissionType
            }
        });

        if (!response.data.success) {
            throw new Error('Failed to remove department permission');
        }

        return response.data;
    } catch (error: any) {
        logger.error('Remove department permission error:', error);
        throw new Error(
            error.response?.data?.error ||
            error.response?.data?.message ||
            'Failed to remove department permission'
        );
    }
}

// Bulk update department permissions (replaces all current permissions)
export async function updateDepartmentPermissions(
    employeeId: string,
    departmentIds: string[],
    permissionType: string = 'approve'
): Promise<{ department_count: number; message: string }> {
    try {
        const response = await api.put<{
            success: boolean;
            department_count: number;
            message: string;
        }>('/department-permissions', {
            employee_id: employeeId,
            department_ids: departmentIds,
            permission_type: permissionType
        });

        if (!response.data.success) {
            throw new Error('Failed to update department permissions');
        }

        return response.data;
    } catch (error: any) {
        logger.error('Update department permissions error:', error);
        throw new Error(
            error.response?.data?.error ||
            error.response?.data?.message ||
            'Failed to update department permissions'
        );
    }
}
