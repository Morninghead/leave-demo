import { vi } from 'vitest'

// Mock database query function
export const mockQuery = vi.fn()

// Mock database transaction
export const mockTransaction = vi.fn()

// Mock database connection
export const mockDb = {
  query: mockQuery,
  transaction: mockTransaction,
  begin: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
}

// Helper to set up database mocks
export const setupDatabaseMocks = () => {
  mockQuery.mockClear()

  // Default mock for successful query
  mockQuery.mockResolvedValue([])

  return {
    mockQuery,
    mockTransaction,
    mockDb,
  }
}

// Helper to mock specific database responses
export const mockDatabaseResponse = (data: any[] = []) => {
  mockQuery.mockResolvedValue(data)
  return mockQuery
}

// Helper to mock database errors
export const mockDatabaseError = (error: Error | string) => {
  const errorMessage = typeof error === 'string' ? error : error.message
  mockQuery.mockRejectedValue(new Error(errorMessage))
  return mockQuery
}

// Helper to create mock database rows with proper typing
export const createMockRow = (data: Record<string, any>) => {
  return { ...data }
}

// Helper to create mock employee data
export const createMockEmployees = (count: number) => {
  const employees = []
  for (let i = 1; i <= count; i++) {
    employees.push({
      id: `emp-${i}`,
      employee_code: `EMP${String(i).padStart(3, '0')}`,
      scan_code: `SCAN${String(i).padStart(3, '0')}`,
      first_name_th: `พนักงาน${i}`,
      last_name_th: `นามสกุล${i}`,
      first_name_en: `Employee${i}`,
      last_name_en: `Lastname${i}`,
      email: `employee${i}@example.com`,
      department_id: `dept-${i % 3 + 1}`,
      role: 'employee',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  return employees
}

// Helper to create mock leave requests
export const createMockLeaveRequests = (count: number) => {
  const requests = []
  for (let i = 1; i <= count; i++) {
    requests.push({
      id: `req-${i}`,
      employee_id: `emp-${i}`,
      leave_type_id: `type-${i % 3 + 1}`,
      start_date: '2024-06-01',
      end_date: '2024-06-03',
      status: 'pending',
      reason_th: `เหตุผลนอนที่ ${i}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  return requests
}

// Helper to mock paginated responses
export const mockPaginatedResponse = (
  data: any[],
  page: number = 1,
  pageSize: number = 10,
  total?: number
) => {
  const totalRecords = total ?? data.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = data.slice(startIndex, endIndex)

  return {
    data: paginatedData,
    pagination: {
      page,
      pageSize,
      total: totalRecords,
      totalPages: Math.ceil(totalRecords / pageSize),
      hasNext: endIndex < totalRecords,
      hasPrev: page > 1,
    },
  }
}

// Helper to mock API responses
export const mockSuccessResponse = (data: any, message?: string) => ({
  success: true,
  data,
  message: message || 'Operation successful',
})

export const mockErrorResponse = (message: string, code = 500) => ({
  success: false,
  error: message,
  code,
})

// Reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks()
  setupDatabaseMocks()
}

export { vi } from 'vitest'