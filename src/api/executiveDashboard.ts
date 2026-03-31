import api from './auth';

export interface DashboardKPIs {
  totalEmployees: number;
  totalRequests: number;
  avgDaysPerRequest: number;
  approvalRate: number;
}

export interface MonthlyTrend {
  month: string;
  requests: number;
  approved: number;
  rejected: number;
}

export interface LeaveTypeDistribution {
  name: string;
  value: number;
}

export interface DepartmentStat {
  department: string;
  requests: number;
  days: number;
}

export interface RecentActivity {
  id: string;
  employee: string;
  type: string;
  status: string;
  date: string;
}

export interface SystemAlert {
  id: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
}

export interface ExecutiveDashboardData {
  kpis: DashboardKPIs;
  monthlyTrends: MonthlyTrend[];
  leaveTypeDistribution: LeaveTypeDistribution[];
  departmentStats: DepartmentStat[];
  recentActivity: RecentActivity[];
  alerts: SystemAlert[];
}

export interface DashboardFilters {
  startDate?: string; // DD/MM/YYYY format
  endDate?: string;   // DD/MM/YYYY format
  month?: string;     // YYYY-MM format
  year?: string;      // YYYY format
}

export const getExecutiveDashboardData = async (filters?: DashboardFilters): Promise<ExecutiveDashboardData> => {
  // Add cache-busting parameter to ensure fresh data
  const timestamp = Date.now();

  // Build query parameters
  const params = new URLSearchParams();
  params.append('t', timestamp.toString());

  // Priority order: startDate/endDate, then month, then year
  if (filters?.startDate && filters?.endDate) {
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);
  } else if (filters?.month) {
    params.append('month', filters.month);
  } else if (filters?.year) {
    params.append('year', filters.year);
  }

  const response = await api.get(`/executive-dashboard?${params.toString()}`);
  return response.data;
};