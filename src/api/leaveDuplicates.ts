import api from './auth';

export interface DuplicateCheckRequest {
  start_date: string;
  end_date: string;
  is_half_day?: boolean;
  half_day_period?: 'morning' | 'afternoon' | 'first_half' | 'second_half';
  is_hourly_leave?: boolean;
  leave_start_time?: string;
  leave_end_time?: string;
}

export interface CalendarConflictRequest {
  checkType: 'calendar_month';
  month: string;
  year: string;
  employee_id?: string;
}

export interface CalendarConflictResponse {
  month: string;
  year: string;
  conflicts: Array<{
    date: string;
    status: 'available' | 'partial_conflict' | 'full_conflict';
    conflictType?: 'pending_leave' | 'approved_leave' | 'holiday' | 'weekend' | 'past_date';
    conflictDetails?: {
      employeeName: string;
      leaveType: string;
      status: string;
    }[];
    tooltipMessage?: string;
  }>;
  message: string;
}

export interface DuplicateCheckResponse {
  hasConflict: boolean;
  conflictingRequests: Array<{
    id: string;
    leave_type_name: string;
    dates: string;
    status: string;
    is_hourly_leave: boolean;
    is_half_day: boolean;
    half_day_period: string;
    total_days: number;
    leave_start_time: string;
    leave_end_time: string;
    details: string;
    created_at: string;
  }>;
  hasTimeConflict: boolean;
  message: string;
  tip: string;
}

export const checkDuplicateLeaveRequest = async (data: DuplicateCheckRequest): Promise<DuplicateCheckResponse> => {
  const response = await api.post('/leave-request-check-duplicate', data);
  return response.data;
};

export const checkCalendarConflicts = async (data: CalendarConflictRequest): Promise<CalendarConflictResponse> => {
  const response = await api.post('/calendar-conflicts', data);
  return response.data;
};