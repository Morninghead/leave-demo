import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
// import { config } from 'vitest/config'

// Extend Vitest's expect with DOM matchers
// expect.extend(matchers)

// Global test setup
beforeAll(() => {
  // Set up global test environment
  vi.stubGlobal('fetch', vi.fn())

  // Mock IntersectionObserver
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    rootMargin: '',
    thresholds: [],
  })))

  // Mock ResizeObserver
  vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })))

  // Mock URL.createObjectURL
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn(),
  } as any)

  // Mock Blob
  vi.stubGlobal('Blob', class MockBlob {
    constructor(content: any[], options: any) {
      this.content = content
      this.options = options
    }
    content: any[] = []
    options: any = {}
    size = 0
    type = ''
    arrayBuffer = vi.fn()
    slice = vi.fn()
    stream = vi.fn()
    text = vi.fn()
  } as any)

  // Mock File
  vi.stubGlobal('File', class MockFile {
    constructor(content: any[], name: string, options: any) {
      this.content = content
      this.name = name
      this.options = options
    }
    content: any[] = []
    name = ''
    options: any = {}
    size = 0
    type = ''
    arrayBuffer = vi.fn()
    slice = vi.fn()
    stream = vi.fn()
    text = vi.fn()
  } as any)

  // Mock WebSocket
  vi.stubGlobal('WebSocket', class MockWebSocket {
    constructor(url: string) {
      this.url = url
    }
    url = ''
    readyState = 1
    send = vi.fn()
    close = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
  } as any)

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  vi.stubGlobal('localStorage', localStorageMock as any)

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  vi.stubGlobal('sessionStorage', sessionStorageMock as any)

  // Mock window.matchMedia
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))

  // Mock window.alert
  vi.stubGlobal('alert', vi.fn())

  // Mock window.confirm
  vi.stubGlobal('confirm', vi.fn(() => true))

  // Mock window.prompt
  vi.stubGlobal('prompt', vi.fn(() => 'test'))
})

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
})

afterEach(() => {
  // Clean up after each test
  cleanup()
})

afterAll(() => {
  // Cleanup after all tests
  vi.restoreAllMocks()
})

// Configure default test timeout
// config.testTimeout = 10000

// Global test utilities
export const createMockEmployee = (overrides = {}) => ({
  id: 'test-employee-id',
  employee_code: 'EMP001',
  scan_code: 'SCAN001',
  first_name_th: 'สมชิต',
  last_name_th: 'ใจดี',
  first_name_en: 'Suchart',
  last_name_en: 'Jaidi',
  email: 'suchart.jaidi@example.com',
  phone_number: '0812345678',
  department_id: 'test-dept-id',
  position_th: 'นักพัฒนา',
  position_en: 'Developer',
  role: 'employee',
  birth_date: '1990-01-01',
  hire_date: '2020-01-01',
  national_id: '1234567890123',
  address_th: '123 ถนน สุขุมวิทย์ กรุงเทพมหฐ',
  emergency_contact_name: 'ฉุกเฉิน บุคคล',
  emergency_contact_phone: '0898765432',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockLeaveRequest = (overrides = {}) => ({
  id: 'test-leave-id',
  employee_id: 'test-employee-id',
  leave_type_id: 'test-leave-type-id',
  start_date: '2024-06-01',
  end_date: '2024-06-03',
  start_time: '09:00',
  end_time: '17:00',
  leave_hours: 24,
  reason_th: 'พักผ่อน',
  reason_en: 'Personal leave',
  status: 'pending',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockLeaveType = (overrides = {}) => ({
  id: 'test-leave-type-id',
  code: 'ANNUAL',
  name_th: 'ลาพักผ่อนประจำปี',
  name_en: 'Annual Leave',
  description_th: 'ลาพักผ่อนประจำปี',
  description_en: 'Annual leave entitlement',
  default_days: 15,
  requires_attachment: false,
  is_paid: true,
  color_code: '#3B82F6',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockDepartment = (overrides = {}) => ({
  id: 'test-dept-id',
  department_code: 'IT',
  name_th: 'แผนกงานไอท',
  name_en: 'IT Department',
  description_th: 'แผนกงานเทคโนโลย',
  description_en: 'IT Department',
  is_active: true,
  parent_department_id: null,
  level: 1,
  sort_order: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const mockApiResponse = <T>(data: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ data, success: true }),
  text: async () => JSON.stringify({ data, success: true }),
} as Response)

export const mockFetch = (response: any) => {
  return vi.fn().mockResolvedValue(response)
}

export const mockError = (message: string, status = 500) => {
  return new Error(message)
}

// Helper functions for async testing
export const waitFor = (condition: () => boolean, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    if (condition()) {
      resolve(true)
      return
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout waiting for condition'))
    }, timeout)

    const checkCondition = () => {
      if (condition()) {
        clearTimeout(timeoutId)
        resolve(true)
      } else {
        setTimeout(checkCondition, 100)
      }
    }

    checkCondition()
  })
}

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

export { vi } from 'vitest'