import api from './auth';

export interface Employee {
  id: string;
  employee_code: string;
  name_th: string;
  name_en: string;
  email: string;
  department_name_th?: string;
  department_name_en?: string;
  position_th?: string;
  position_en?: string;
  role: string;
  status: string;
  created_at: string;
  phone_number?: string;
  department_id?: string;
  birth_date?: string;
  hire_date?: string;
  national_id?: string;
  address_th?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  is_department_admin?: boolean;
  is_department_manager?: boolean;
  // ❌ ลบ is_hr ออก - ใช้ role === 'hr' แทน
}

export interface CreateEmployeeData {
  employee_code: string;
  scan_code?: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en?: string;
  last_name_en?: string;
  email: string;
  phone_number?: string;
  department_id?: string;
  position_th?: string;
  position_en?: string;
  role?: string;
  birth_date?: string;
  hire_date?: string;
  national_id?: string;
  address_th?: string;
  address_en?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

// Get all employees
export async function getEmployees(params?: {
  search?: string;
  role?: string;
  status?: string;
}): Promise<Employee[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.status) queryParams.append('status', params.status);

    const response = await api.get<{ success: boolean; employees: Employee[] }>(
      `/employees?${queryParams.toString()}`
    );
    return response.data.employees;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get employees');
  }
}

// Create employee
export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  try {
    const response = await api.post<{ success: boolean; employee: Employee; message: string }>(
      '/create-employee',
      data
    );
    return response.data.employee;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to create employee');
  }
}

// Update employee
export async function updateEmployee(id: string, data: Partial<CreateEmployeeData>): Promise<Employee> {
  try {
    const response = await api.put<{ success: boolean; employee: Employee; message: string }>(
      `/update-employee/${id}`,
      data
    );
    return response.data.employee;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update employee');
  }
}

// Delete/Resign employee
export async function deleteEmployee(
  id: string,
  resignationDate?: string,
  resignationReason?: string
): Promise<void> {
  try {
    const queryParams = new URLSearchParams();
    if (resignationDate) queryParams.append('resignation_date', resignationDate);
    if (resignationReason) queryParams.append('resignation_reason', resignationReason);

    const url = queryParams.toString()
      ? `/delete-employee/${id}?${queryParams.toString()}`
      : `/delete-employee/${id}`;

    await api.delete(url);
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete employee');
  }
}

// Get employee signature
export async function getEmployeeSignature(employeeId?: string): Promise<{
  signature_image: string | null;
  signature_uploaded_at: string | null;
}> {
  try {
    const url = employeeId
      ? `/employee-signature?employee_id=${employeeId}`
      : '/employee-signature';
    const response = await api.get<{ success: boolean; data: any }>(url);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get signature');
  }
}

// Upload/update employee signature
export async function uploadEmployeeSignature(
  signatureData: string,
  employeeId?: string
): Promise<{
  signature_image: string;
  signature_uploaded_at: string;
}> {
  try {
    const response = await api.post<{ success: boolean; data: any }>('/employee-signature', {
      signature_data: signatureData,
      employee_id: employeeId,
    });
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to upload signature');
  }
}

// Delete employee signature
export async function deleteEmployeeSignature(employeeId?: string): Promise<void> {
  try {
    await api.delete('/employee-signature', {
      data: { employee_id: employeeId },
    });
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete signature');
  }
}
