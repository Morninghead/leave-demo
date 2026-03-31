// User Role Types
export type UserRole = 'employee' | 'leader' | 'manager' | 'hr' | 'admin' | 'dev';

// User Status Types
export type UserStatus = 'active' | 'inactive';

// User Interface
export interface User {
  id: string;
  employee_code: string;
  scan_code: string;
  national_id?: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  email: string;
  phone?: string;
  birth_date?: string;
  address_th?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  department_id: string;
  department_code?: string;
  department_name_th?: string;
  department_name_en?: string;
  position_th?: string;
  position_en?: string;
  role: UserRole;
  profile_image_url?: string;
  status: UserStatus;
  hire_date?: string;
  is_hr?: boolean;
  is_department_admin?: boolean;
  is_department_manager?: boolean;
}

// Auth State
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresPasswordChange: boolean;
}

// Login Credentials
export interface LoginCredentials {
  employee_code?: string;
  scan_code?: string;
  password?: string;
  id_card_number?: string;
  line_id_token?: string;
}

// Login Response
export interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
  message?: string;
}

// Auth Context Type
export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  completePasswordChange: () => void;
  loginWithPasswordReset: (user: User, token: string) => void;
}

// Permission Helper Functions
export const hasPermission = (
  userRole: UserRole,
  requiredRoles: UserRole[]
): boolean => {
  return requiredRoles.includes(userRole);
};

export const canAccessRoute = (
  userRole: UserRole,
  routePath: string
): boolean => {
  const routePermissions: Record<string, UserRole[]> = {
    '/dashboard': ['employee', 'leader', 'manager', 'hr', 'admin'],
    '/leave': ['employee', 'leader', 'manager', 'hr', 'admin'],
    '/employees': ['hr', 'admin'],
    '/settings': ['admin'],
  };

  const allowedRoles = routePermissions[routePath] || [];
  return allowedRoles.includes(userRole);
};

export const getRoleName = (role: UserRole, language: 'th' | 'en' = 'th'): string => {
  const roleNames: Record<UserRole, { th: string; en: string }> = {
    employee: { th: 'พนักงาน', en: 'Employee' },
    leader: { th: 'หัวหน้างาน', en: 'Leader' },
    manager: { th: 'ผู้จัดการ', en: 'Manager' },
    hr: { th: 'ฝ่ายทรัพยากรบุคคล', en: 'Human Resources' },
    admin: { th: 'ผู้ดูแลระบบ', en: 'Administrator' },
    dev: { th: 'นักพัฒนา', en: 'Developer' },
  };

  return roleNames[role][language];
};

export const getRoleBadgeColor = (role: UserRole): string => {
  const colors: Record<UserRole, string> = {
    employee: 'bg-gray-100 text-gray-800',
    leader: 'bg-amber-100 text-amber-800',
    manager: 'bg-blue-100 text-blue-800',
    hr: 'bg-green-100 text-green-800',
    admin: 'bg-red-100 text-red-800',
    dev: 'bg-purple-100 text-purple-800',
  };

  return colors[role];
};

export const canManageEmployees = (role: UserRole): boolean => {
  return ['hr', 'admin'].includes(role);
};

export const canApproveLeave = (role: UserRole): boolean => {
  return ['manager', 'hr', 'admin'].includes(role);
};

export const canAccessSettings = (role: UserRole): boolean => {
  return ['admin', 'hr'].includes(role);
};

export const isAdmin = (role: UserRole): boolean => {
  return role === 'admin';
};
