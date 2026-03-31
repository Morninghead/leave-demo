import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface CheckDuplicateRequest {
  start_date: string;
  end_date: string;
  is_half_day?: boolean;
  half_day_period?: 'morning' | 'afternoon' | 'first_half' | 'second_half';
  is_hourly_leave?: boolean;
  leave_start_time?: string;
  leave_end_time?: string;
  checkType?: 'single_date' | 'date_range' | 'calendar_month';
  month?: string; // For calendar month checking: YYYY-MM
  year?: string;  // For calendar year checking: YYYY
}

interface CalendarConflictData {
  date: string;
  status: 'available' | 'partial_conflict' | 'full_conflict';
  conflictType?: 'pending_leave' | 'approved_leave' | 'holiday' | 'weekend' | 'past_date';
  conflictDetails?: {
    employeeName: string;
    leaveType: string;
    status: string;
  }[];
  tooltipMessage?: string;
}

const checkDuplicateLeaveRequest = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    if (!userId) {
      return errorResponse('User not authenticated', 401);
    }

    const body: CheckDuplicateRequest = JSON.parse(event.body || '{}');
    const {
      start_date,
      end_date,
      is_half_day,
      half_day_period,
      is_hourly_leave,
      leave_start_time,
      leave_end_time
    } = body;

    if (!start_date || !end_date) {
      return errorResponse('Start date and end date are required', 400);
    }

    console.log('🔍 [CHECK_DUPLICATE] Checking for overlapping requests:', {
      userId,
      start_date,
      end_date,
      is_hourly_leave,
      leave_start_time,
      leave_end_time
    });

    // Check for overlapping leave requests
    const overlappingRequests = await query(
      `SELECT
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.status,
        lr.is_half_day,
        lr.half_day_period,
        lr.shift_type,
        lr.is_hourly_leave,
        lr.leave_start_time,
        lr.leave_end_time,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lr.created_at
      FROM leave_requests lr
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = $1
        AND lr.status IN ('pending', 'approved')
        AND (
          -- Check date overlap for all request types
          (lr.start_date <= $2 AND lr.end_date >= $3)
        )
      ORDER BY lr.start_date ASC`,
      [userId, start_date, end_date]
    );

    if (overlappingRequests.length === 0) {
      console.log('✅ [CHECK_DUPLICATE] No overlapping requests found');
      return successResponse({
        hasConflict: false,
        conflictingRequests: [],
        message: 'No overlapping requests found'
      });
    }

    console.log('🔍 [CHECK_DUPLICATE] Found overlapping date requests:', overlappingRequests.length);

    // For hourly leave, filter to only actual time conflicts
    let actualConflicts = [];
    let hasTimeConflict = false;

    if (is_hourly_leave && leave_start_time && leave_end_time) {
      // If this is an hourly leave request, only conflicts with time overlaps matter
      const checkStart = timeToMinutes(leave_start_time);
      const checkEnd = timeToMinutes(leave_end_time);

      for (const request of overlappingRequests) {
        const requestDate = request.start_date;
        const checkDate = start_date;

        // Only check same-day requests
        if (requestDate === checkDate) {
          if (request.is_hourly_leave && request.leave_start_time && request.leave_end_time) {
            // Both are hourly - check time overlap
            const reqStart = timeToMinutes(request.leave_start_time);
            const reqEnd = timeToMinutes(request.leave_end_time);

            // Check if time ranges overlap
            if ((checkStart >= reqStart && checkStart < reqEnd) ||
                (checkEnd > reqStart && checkEnd <= reqEnd) ||
                (checkStart <= reqStart && checkEnd >= reqEnd)) {
              hasTimeConflict = true;
              actualConflicts.push(request);
            }
            // If times don't overlap, no conflict - allow it
          } else {
            // Existing request is full-day or half-day - this is a conflict
            hasTimeConflict = true;
            actualConflicts.push(request);
          }
        }
      }

      // If this is hourly leave and no time conflicts found, allow it
      if (!hasTimeConflict) {
        console.log('✅ [CHECK_DUPLICATE] Hourly leave request has no time conflicts - allowing');
        return successResponse({
          hasConflict: false,
          conflictingRequests: [],
          message: 'No time conflicts found for hourly leave'
        });
      }
    } else if (is_half_day && half_day_period && start_date === end_date) {
      // For half-day requests, check for specific time period conflicts
      console.log('🔍 [CHECK_DUPLICATE] Checking half-day conflicts for period:', half_day_period);

      for (const request of overlappingRequests) {
        // Only check requests on the same date
        if (request.start_date === start_date && request.end_date === end_date) {
          if (request.is_hourly_leave) {
            // Hourly leave conflicts with half-day if times overlap
            if (request.leave_start_time && request.leave_end_time) {
              const reqStart = timeToMinutes(request.leave_start_time);
              const reqEnd = timeToMinutes(request.leave_end_time);

              // Half-day time ranges
              const halfDayRanges = {
                morning: { start: 8 * 60, end: 12 * 60 },      // 08:00-12:00
                afternoon: { start: 13 * 60, end: 17 * 60 },   // 13:00-17:00
                first_half: { start: 20 * 60, end: 24 * 60 },   // 20:00-00:00 (night shift)
                second_half: { start: 0, end: 5 * 60 }          // 00:00-05:00 (night shift)
              };

              const checkRange = halfDayRanges[half_day_period];
              if (checkRange && ((reqStart < checkRange.end && reqEnd > checkRange.start))) {
                actualConflicts.push(request);
                hasTimeConflict = true;
              }
            }
          } else if (request.is_half_day && request.half_day_period) {
            // Half-day conflicts with half-day if periods overlap or are the same
            if (request.half_day_period === half_day_period) {
              actualConflicts.push(request);
              hasTimeConflict = true;
            }
          } else {
            // Full-day request always conflicts with half-day
            actualConflicts.push(request);
            hasTimeConflict = true;
          }
        } else if (request.start_date !== request.end_date) {
          // Multi-day full-day requests conflict with half-day
          actualConflicts.push(request);
          hasTimeConflict = true;
        }
      }

      // If no time conflicts found for half-day, allow it
      if (!hasTimeConflict) {
        console.log('✅ [CHECK_DUPLICATE] Half-day leave request has no time conflicts - allowing');
        return successResponse({
          hasConflict: false,
          conflictingRequests: [],
          message: 'No time conflicts found for half-day leave'
        });
      }
    } else {
      // For full-day requests, any date overlap is a conflict
      actualConflicts = overlappingRequests;
      hasTimeConflict = true;
    }

    console.log('❌ [CHECK_DUPLICATE] Found actual conflicts:', actualConflicts.length);

    // Format date to be more readable
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    // Build detailed conflict information
    const conflictingRequests = actualConflicts.map(req => {
      const leaveTypeName = req.leave_type_name_th || req.leave_type_name_en || 'Leave';
      const dates = `${formatDate(req.start_date)} to ${formatDate(req.end_date)}`;
      const statusText = req.status === 'pending' ? 'กำลังรออนุมัติ' : 'อนุมัติแล้ว';

      let details = `${leaveTypeName} (${dates})`;
      details += ` - สถานะ: ${statusText}`;

      if (req.is_hourly_leave) {
        details += ` (ลาเป็นชั่วโมง: ${req.leave_start_time} - ${req.leave_end_time})`;
      } else if (req.is_half_day) {
        const periodText = req.half_day_period === 'morning' ? 'ช่วงเช้า' :
                        req.half_day_period === 'afternoon' ? 'ช่วงบ่าย' :
                        req.half_day_period === 'first_half' ? 'ครึ่งแรก' : 'ครึ่งหลัง';
        details += ` (ลาครึ่งวัน: ${periodText})`;
      } else {
        const dayText = req.total_days === 1 ? '1 วัน' : `${req.total_days} วัน`;
        details += ` (${dayText})`;
      }

      return {
        id: req.id,
        leave_type_name: leaveTypeName,
        dates,
        status: req.status,
        is_hourly_leave: req.is_hourly_leave,
        is_half_day: req.is_half_day,
        half_day_period: req.half_day_period,
        total_days: req.total_days,
        leave_start_time: req.leave_start_time,
        leave_end_time: req.leave_end_time,
        details,
        created_at: req.created_at
      };
    });

    let conflictMessage = '';
    let tip = '';

    if (is_hourly_leave) {
      // Check if conflict is with another hourly leave or full-day leave
      const hasFullDayConflict = actualConflicts.some(req => !req.is_hourly_leave);

      if (hasFullDayConflict) {
        conflictMessage = 'ไม่สามารถลาเป็นชั่วโมงได้ เนื่องจากคุณมีคำขอลาเต็มวันหรือครึ่งวันในวันเดียวกัน';
        tip = 'กรุณายกเลิกหรือรอการอนุมัติคำขอลาเต็มวันก่อน หรือเลือกวันอื่น';
      } else {
        conflictMessage = 'ไม่สามารถลาเป็นชั่วโมงในช่วงเวลาที่ซ้อนทับกันได้ คุณมีคำขอลาในช่วงเวลาดังกล่าวอยู่แล้ว';
        tip = 'กรุณาเลือกช่วงเวลาอื่นที่ไม่ซ้อนทับกับคำขอลาที่มีอยู่';
      }
    } else {
      conflictMessage = 'ไม่สามารถสร้างคำขอลาที่ซ้ำซ้อนกันได้ คุณมีคำขอลาที่กำลังดำเนินการอยู่ในช่วงเวลาดังกล่าว';
      tip = 'คุณสามารถส่งคำขอใหม่ได้ หลังจากคำขอเดิมได้รับการอนุมัติ หรือถูกยกเลิกไปแล้ว หากเป็นช่วงเวลาใหม่ที่ไม่ตรงกับเวลาเดิม ให้สามารถส่งคำขอได้เลย';
    }

    return successResponse({
      hasConflict: true,
      conflictingRequests,
      hasTimeConflict,
      message: conflictMessage,
      tip
    });

  } catch (error: any) {
    console.error('❌ [CHECK_DUPLICATE] Error checking duplicate requests:', error);
    return errorResponse(error.message || 'Failed to check for duplicate requests', 500);
  }
};

// Enhanced calendar conflict checking for month/year views
const checkCalendarConflicts = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    if (!userId) {
      return errorResponse('User not authenticated', 401);
    }

    const body: CheckDuplicateRequest = JSON.parse(event.body || '{}');
    const { checkType, month, year, employee_id } = body;

    // Use provided employee_id or current user ID
    const targetUserId = employee_id || userId;

    if (checkType === 'calendar_month' && month && year) {
      // Check conflicts for entire month
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const conflictingRequests = await query(
        `SELECT
          lr.id,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.status,
          lr.is_half_day,
          lr.half_day_period,
          lr.shift_type,
          lr.is_hourly_leave,
          lr.leave_start_time,
          lr.leave_end_time,
          lt.name_th as leave_type_name_th,
          lt.name_en as leave_type_name_en,
          e.first_name || 'Unknown' as employee_firstname,
          e.last_name || 'Unknown' as employee_lastname
        FROM leave_requests lr
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN employees e ON lr.employee_id = e.id
        WHERE lr.employee_id = $1
          AND lr.status IN ('pending', 'approved')
          AND (
            lr.start_date <= $2 AND lr.end_date >= $3
          )
        ORDER BY lr.start_date ASC`,
        [targetUserId, startDate, endDate]
      );

      // Generate calendar conflict data
      const calendarConflicts: CalendarConflictData[] = [];

      // Add all conflict dates
      conflictingRequests.forEach(req => {
        const startDate = new Date(req.start_date);
        const endDate = new Date(req.end_date);

        // Add each date in the range as conflicted
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];

          const conflictData: CalendarConflictData = {
            date: dateStr,
            status: 'full_conflict',
            conflictType: req.status === 'approved' ? 'approved_leave' : 'pending_leave',
            conflictDetails: [{
              employeeName: `${req.employee_firstname} ${req.employee_lastname}`,
              leaveType: req.leave_type_name_th || req.leave_type_name_en || 'Leave',
              status: req.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'
            }],
            tooltipMessage: `${req.leave_type_name_th || req.leave_type_name_en}: ${req.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'} (${req.total_days === 1 ? '1 วัน' : `${req.total_days} วัน`})`
          };

          calendarConflicts.push(conflictData);
        }
      });

      console.log('📅 [CALENDAR_CONFLICTS] Generated calendar conflicts for', { userId, month, year }, calendarConflicts.length);

      return successResponse({
        month: month,
        year: year,
        conflicts: calendarConflicts,
        message: `Found ${calendarConflicts.length} conflicted dates in ${month}/${year}`
      });
    }

    return errorResponse('Invalid check type', 400);

  } catch (error: any) {
    console.error('❌ [CALENDAR_CONFLICTS] Error checking calendar conflicts:', error);
    return errorResponse(error.message || 'Failed to check calendar conflicts', 500);
  }
};

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export const handler: Handler = requireAuth(checkDuplicateLeaveRequest);
export const calendarHandler: Handler = requireAuth(checkCalendarConflicts);