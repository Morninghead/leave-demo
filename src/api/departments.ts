import api from './auth';

export interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description_th?: string;
  description_en?: string;
  parent_department_id?: string;
  level?: number;
  sort_order?: number;
  is_active: boolean;
  created_at: string;
  employee_count?: number;
  hierarchy_name?: string; // For hierarchical display (parent > child)
  hierarchy_depth?: number; // For hierarchical display
}

export async function getDepartments(): Promise<Department[]> {
  try {
    const response = await api.get<{ success: boolean; departments: Department[] }>(
      '/departments'
    );
    return response.data.departments;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get departments');
  }
}

export async function getHierarchicalDepartments(): Promise<Department[]> {
  try {
    const response = await api.get<{ success: boolean; departments: Department[]; hierarchical: boolean }>(
      '/departments?include_hierarchy=true'
    );
    return response.data.departments;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get hierarchical departments');
  }
}

export async function createDepartment(department: {
  name_th: string;
  name_en?: string;
  code: string;
  parent_department_id?: string;
  level?: number;
  sort_order?: number;
}): Promise<Department> {
  try {
    const response = await api.post<{ success: boolean; department: Department }>(
      '/departments',
      department
    );
    return response.data.department;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to create department');
  }
}

export async function updateDepartment(
  id: string,
  department: {
    name_th?: string;
    name_en?: string;
    code?: string;
    parent_department_id?: string;
    level?: number;
    sort_order?: number;
  }
): Promise<Department> {
  try {
    const response = await api.put<{ success: boolean; department: Department }>(
      `/departments/${id}`,
      department
    );
    return response.data.department;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update department');
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  try {
    await api.delete(`/departments/${id}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete department');
  }
}