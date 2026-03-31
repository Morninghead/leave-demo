import api from './auth';

export interface Department {
  id: string;
  name_th: string;
  name_en: string;
  code: string;
  employee_count?: string;
  created_at: string;
  parent_department_id?: string;
  level?: number;
  sort_order?: number;
  hierarchy_name?: string;
  hierarchy_depth?: number;
}

export interface CreateDepartmentData {
  name_th: string;
  name_en?: string;
  code: string;
  parent_department_id?: string;
  level?: number;
  sort_order?: number;
}

// Get all departments
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

// Get hierarchical departments
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

// Create department
export async function createDepartment(data: CreateDepartmentData): Promise<Department> {
  try {
    const response = await api.post<{ success: boolean; department: Department; message: string }>(
      '/departments',
      data
    );
    return response.data.department;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to create department');
  }
}

// Update department
export async function updateDepartment(
  id: string,
  data: Partial<CreateDepartmentData>
): Promise<Department> {
  try {
    const response = await api.put<{ success: boolean; department: Department; message: string }>(
      `/departments/${id}`,
      data
    );
    return response.data.department;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update department');
  }
}

// Delete department
export async function deleteDepartment(id: string): Promise<void> {
  try {
    await api.delete(`/departments/${id}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete department');
  }
}
