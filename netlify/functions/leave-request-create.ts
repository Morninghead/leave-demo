import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { HOLIDAY_STANDARD_FIELDS, normalizeHolidayDate, isHolidayDate } from './utils/date-helpers';
import { getOrCreateLeaveBalance } from './utils/leave-balance-helper';
import { getApprovalFlowWithAutoSkip } from './utils/approval-flow';
import {
  sendLeaveRequestSubmitted,
  sendLeaveRequestPendingApproval,
  areEmailAlertsEnabled,
} from './utils/email-service';
import { logCreate } from './utils/audit-logger';
import { logger } from './utils/logger';
import { sendLeaveRequestNotification } from './utils/line-notify';
import { sendTelegramLeaveNotification } from './utils/telegram-notify';

// Function to calculate leave minutes with lunch break handling
function calculateLeaveMinutesWithLunchBreak(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  let duration = endTotal - startTotal;

  // Check if the time range spans over lunch break (12:00-13:00)
  const lunchStart = 12 * 60; // 12:00 = 720 minutes
  const lunchEnd = 13 * 60;   // 13:00 = 780 minutes

  // If leave starts before or at lunch break and ends after or at lunch break end
  if (startTotal <= lunchStart && endTotal >= lunchEnd) {
    // Subtract 60 minutes for lunch break
    duration -= 60;
  }
  // If leave starts during lunch break, treat it as starting after lunch
  else if (startTotal > lunchStart && startTotal < lunchEnd) {
    duration = endTotal - lunchEnd; // Calculate from lunch end time
  }
  // If leave ends during lunch break, treat it as ending at lunch start
  else if (endTotal > lunchStart && endTotal <= lunchEnd) {
    duration = lunchStart - startTotal; // Calculate until lunch start time
  }

  return duration;
}

// Helper function to calculate raw minutes difference (for logging purposes)
function calculateMinutesDifference(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes - startMinutes;
}

// Shift time configuration
const SHIFT_TIMES = {
  day: {
    full: { start: '08:00:00', end: '17:00:00' },
    morning: { start: '08:00:00', end: '12:00:00' },
    afternoon: { start: '13:00:00', end: '17:00:00' },
  },
  night: {
    full: { start: '20:00:00', end: '05:00:00' },
    first_half: { start: '20:00:00', end: '00:00:00' },
    second_half: { start: '01:00:00', end: '05:00:00' },
  },
};

// Helper function to get company settings
async function getCompanySettings(): Promise<{ [key: string]: string }> {
  try {
    const settings = await query(
      'SELECT setting_key, setting_value FROM company_settings'
    );

    const settingsObj = settings.reduce((acc: any, row: any) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    return settingsObj;
  } catch (error) {
    logger.error('Error getting company settings:', error);
    // Return default settings if query fails
    return {
      work_days_per_week: '5',
      weekend_days: '0,6' // Default to Sunday and Saturday
    };
  }
}

// Helper function to determine if a day is a working day based on company settings
function isWorkingDay(dayOfWeek: number, workDaysPerWeek: number, weekendDays: number[]): boolean {
  // If work_days_per_week is 7, all days are working days
  if (workDaysPerWeek === 7) {
    return true;
  }

  // If work_days_per_week is 6, exclude only Sunday (day 0)
  if (workDaysPerWeek === 6) {
    return dayOfWeek !== 0;
  }

  // If work_days_per_week is 5, exclude configured weekend days
  if (workDaysPerWeek === 5) {
    return !weekendDays.includes(dayOfWeek);
  }

  // Default to 5-day week for any other value
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

async function calculateWorkingDays(startDate: string, endDate: string): Promise<number> {
  // Get company settings for work days configuration
  const settings = await getCompanySettings();
  const workDaysPerWeek = parseInt(settings.work_days_per_week) || 5;

  // Parse weekend days from settings (comma-separated, e.g., "0,6" for Sunday and Saturday)
  const weekendDays = settings.weekend_days
    ? settings.weekend_days.split(',').map(Number)
    : [0, 6]; // Default to Sunday and Saturday

  // Parse date strings and create Date objects in local timezone
  const startParts = startDate.split('-').map(Number);
  const endParts = endDate.split('-').map(Number);

  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  // Get holidays for the requested date range (cover multiple years if needed)
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidayYears = [];
  for (let year = startYear; year <= endYear; year++) {
    holidayYears.push(year);
  }

  let holidays: any[] = [];
  try {
    logger.log('🔍 [CALCULATE] Loading holidays for years:', holidayYears);

    // Get holidays for all years in the date range
    const holidayQueries = holidayYears.map(year =>
      `SELECT ${HOLIDAY_STANDARD_FIELDS}
       FROM company_holidays
       WHERE EXTRACT(YEAR FROM holiday_date AT TIME ZONE 'Asia/Bangkok') = ${year}
         AND is_active = true`
    );

    const holidayQuery = holidayQueries.join(' UNION ALL ');
    const holidayResults = await query(holidayQuery);
    holidays = holidayResults;

    logger.log('📅 [CALCULATE] Found holidays:', holidays.length);
  } catch (holidayError) {
    logger.error('Error loading holidays for calculation:', holidayError);
    // Continue without holidays if there's an error
  }

  // Convert holidays to a Set for fast lookup
  const holidaySet = new Set(holidays.map(h => normalizeHolidayDate(h.holiday_date)));
  logger.log('🗓️ [CALCULATE] Holiday dates set:', Array.from(holidaySet));

  // Handle same day case
  if (start.toDateString() === end.toDateString()) {
    const dayOfWeek = start.getDay();
    const isWorking = isWorkingDay(dayOfWeek, workDaysPerWeek, weekendDays);

    // Check if the date is a holiday
    const dateStr = normalizeHolidayDate(start);
    const isHoliday = holidaySet.has(dateStr);

    logger.log(`📅 [CALCULATE] Same day check: ${dateStr}, Working: ${isWorking}, Holiday: ${isHoliday}`);

    // Count as working day only if it's both a working day AND not a holiday
    return (isWorking && !isHoliday) ? 1 : 0;
  }

  let workingDays = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0); // Normalize to start of day
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0); // Normalize to start of day

  while (current <= endDay) {
    const dayOfWeek = current.getDay();
    const isWorking = isWorkingDay(dayOfWeek, workDaysPerWeek, weekendDays);

    // Check if current date is a holiday
    const dateStr = normalizeHolidayDate(current);
    const isHoliday = holidaySet.has(dateStr);

    logger.log(`📅 [CALCULATE] Date: ${dateStr}, Working: ${isWorking}, Holiday: ${isHoliday}, Counted: ${isWorking && !isHoliday}`);

    // Count as working day only if it's both a working day AND not a holiday
    if (isWorking && !isHoliday) {
      workingDays++;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  logger.log(`✅ [CALCULATE] Final working days between ${startDate} and ${endDate}: ${workingDays}`);
  return workingDays;
}

// ✅ Auto-detect language helper
function detectLanguage(text: string): 'th' | 'en' {
  const thaiChars = /[\u0E00-\u0E7F]/;
  return thaiChars.test(text) ? 'th' : 'en';
}

const createLeaveRequest = async (event: AuthenticatedEvent) => {
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

    const {
      leave_type_id,
      start_date,
      end_date,
      reason, // ✅ เปลี่ยนเป็นช่องเดียว
      is_half_day = false,
      half_day_period,
      shift_type = 'day',
      is_hourly_leave = false,
      leave_minutes,
      leave_start_time,
      leave_end_time,
      attachment_urls = [], // ✅ Add attachment URLs
    } = JSON.parse(event.body || '{}');

    logger.log('📝 Create Leave Request:', {
      userId,
      leave_type_id,
      start_date,
      end_date,
      reason, // ✅
      is_half_day,
      half_day_period,
      shift_type,
      is_hourly_leave,
      leave_minutes,
      leave_start_time,
      leave_end_time,
    });

    // ===== VALIDATION =====
    if (!leave_type_id || !start_date || !end_date) {
      return errorResponse('Missing required fields: leave_type_id, start_date, end_date', 400);
    }

    // ✅ Validate reason
    if (!reason || reason.trim() === '') {
      return errorResponse('Reason is required', 400);
    }

    // Validate shift type
    if (!['day', 'night', 'evening'].includes(shift_type)) {
      return errorResponse('Invalid shift_type. Must be "day", "night", or "evening"', 400);
    }

    let total_days: number;
    let start_time: string | null = null;
    let end_time: string | null = null;
    let final_half_day_period: string | null = null;
    let final_leave_minutes: number | null = null;
    let leave_hours: number | null = null;

    // ===== HOURLY LEAVE LOGIC =====
    if (is_hourly_leave) {
      // Must be same day
      if (start_date !== end_date) {
        return errorResponse('Hourly leave must be on the same day', 400);
      }

      // Validate required fields
      if (!leave_minutes || !leave_start_time || !leave_end_time) {
        return errorResponse('Hourly leave requires leave_minutes, leave_start_time, and leave_end_time', 400);
      }

      // Recalculate leave minutes with lunch break handling
      const calculatedLeaveMinutes = calculateLeaveMinutesWithLunchBreak(leave_start_time, leave_end_time);

      // Validate minimum 60 minutes / 1 hour (after lunch break calculation)
      if (calculatedLeaveMinutes < 60) {
        return errorResponse('Hourly leave must be at least 1 hour (excluding lunch break)', 400);
      }

      // Validate maximum 8 hours (480 minutes)
      if (calculatedLeaveMinutes > 480) {
        return errorResponse('Hourly leave cannot exceed 8 hours (excluding lunch break)', 400);
      }

      // Use the calculated minutes (with lunch break deduction) for leave balance
      final_leave_minutes = calculatedLeaveMinutes;
      leave_hours = calculatedLeaveMinutes / 60;

      // Convert minutes to days for balance checking
      // Standard: 480 minutes = 1 day, so total_days = calculated_leave_minutes / 480
      // Use precise calculation to avoid floating point precision issues
      total_days = parseFloat((calculatedLeaveMinutes / 480).toFixed(6));

      logger.log('🍽️ [LUNCH_BREAK] Hourly leave calculation:', {
        start_time: leave_start_time,
        end_time: leave_end_time,
        raw_duration: calculateMinutesDifference(leave_start_time, leave_end_time),
        calculated_minutes: calculatedLeaveMinutes,
        lunch_break_deducted: calculateMinutesDifference(leave_start_time, leave_end_time) - calculatedLeaveMinutes
      });

      // ===== HOLIDAY VALIDATION =====
      // Check if requested dates fall on company holidays
      try {
        logger.log('🔍 [CREATE] Checking holidays for dates:', { start_date, end_date });
        const currentYear = new Date().getFullYear();

        // Get holidays for the requested year range (using standardized query)
        const holidays = await query(
          `SELECT ${HOLIDAY_STANDARD_FIELDS}
           FROM company_holidays
           WHERE EXTRACT(YEAR FROM holiday_date AT TIME ZONE 'Asia/Bangkok') = $1
             AND is_active = true`,
          [currentYear]
        );

        logger.log('📅 [CREATE] Found holidays:', holidays);

        // Convert to date array for checking
        const dateArray = [];
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = normalizeHolidayDate(d);
          dateArray.push(dateStr);
        }

        // Check each requested date against holidays (using standardized comparison)
        for (const dateStr of dateArray) {
          const matchedHoliday = holidays.find(holiday => isHolidayDate(dateStr, holiday.holiday_date));
          if (matchedHoliday) {
            logger.log(`❌ [CREATE] Date ${dateStr} is a company holiday (${matchedHoliday.name_en})`);
            return errorResponse(`Leave request cannot be made on company holiday: ${dateStr}`, 400);
          }
        }

        logger.log('✅ [CREATE] No holidays found for requested dates');
      } catch (holidayError) {
        logger.error('Holiday validation error:', holidayError);
        // Continue with request if holiday checking fails (but log the error)
      }

      start_time = leave_start_time;
      end_time = leave_end_time;

      logger.log('⏱️ Hourly leave:', {
        leave_minutes: final_leave_minutes,
        leave_hours,
        leave_start_time,
        leave_end_time,
        total_days,
      });
    } else if (is_half_day) {
      // Must be same day
      if (start_date !== end_date) {
        return errorResponse('Half-day leave must be on the same day', 400);
      }

      // Validate half_day_period based on shift_type
      const validPeriods =
        shift_type === 'day'
          ? ['morning', 'afternoon']
          : ['first_half', 'second_half'];

      if (!half_day_period || !validPeriods.includes(half_day_period)) {
        return errorResponse(
          `Invalid half_day_period "${half_day_period}" for ${shift_type} shift. Must be one of: ${validPeriods.join(', ')}`,
          400
        );
      }

      // Set times based on shift and period
      if (shift_type === 'day') {
        const times = SHIFT_TIMES.day[half_day_period as 'morning' | 'afternoon'];
        start_time = times.start;
        end_time = times.end;
      } else {
        // night shift
        const times = SHIFT_TIMES.night[half_day_period as 'first_half' | 'second_half'];
        start_time = times.start;
        end_time = times.end;
      }

      final_half_day_period = half_day_period;
      total_days = 0.5;

      // ===== HOLIDAY VALIDATION FOR HALF-DAY LEAVE =====
      // Check if the half-day leave date falls on a company holiday
      try {
        logger.log('🔍 [HALF-DAY] Checking holidays for date:', start_date);
        const currentYear = new Date(start_date).getFullYear();

        // Get holidays for the requested year
        const holidays = await query(
          `SELECT ${HOLIDAY_STANDARD_FIELDS}
           FROM company_holidays
           WHERE EXTRACT(YEAR FROM holiday_date AT TIME ZONE 'Asia/Bangkok') = $1
             AND is_active = true`,
          [currentYear]
        );

        logger.log('📅 [HALF-DAY] Found holidays:', holidays);

        // Check if the requested date is a holiday
        const dateStr = normalizeHolidayDate(start_date);
        const matchedHoliday = holidays.find(holiday => isHolidayDate(dateStr, holiday.holiday_date));

        if (matchedHoliday) {
          logger.log(`❌ [HALF-DAY] Date ${dateStr} is a company holiday (${matchedHoliday.name_en})`);
          return errorResponse(`Half-day leave cannot be made on company holiday: ${dateStr} (${matchedHoliday.name_en})`, 400);
        }

        logger.log('✅ [HALF-DAY] No holiday found for requested date');
      } catch (holidayError) {
        logger.error('Holiday validation error for half-day leave:', holidayError);
        // Continue with request if holiday checking fails (but log the error)
      }

      logger.log('⏰ Half-day leave:', {
        shift_type,
        half_day_period,
        start_time,
        end_time,
        total_days,
      });
    } else {
      // ===== FULL DAY LEAVE LOGIC =====
      total_days = await calculateWorkingDays(start_date, end_date);

      // Set full shift times
      if (shift_type === 'day') {
        start_time = SHIFT_TIMES.day.full.start;
        end_time = SHIFT_TIMES.day.full.end;
      } else {
        start_time = SHIFT_TIMES.night.full.start;
        end_time = SHIFT_TIMES.night.full.end;
      }

      logger.log('📅 Full day leave:', {
        shift_type,
        start_time,
        end_time,
        total_days,
      });
    }

    // ===== GET EMPLOYEE INFO =====
    const employeeResult = await query(
      'SELECT id, department_id FROM employees WHERE id = $1',
      [userId]
    );

    if (employeeResult.length === 0) {
      return errorResponse('Employee not found', 404);
    }

    const employee = employeeResult[0];
    const currentYear = new Date().getFullYear();

    // ===== GET LEAVE TYPE INFO =====
    const leaveTypeInfo = await query(
      'SELECT code, name_en, allow_hourly_leave, requires_attachment FROM leave_types WHERE id = $1',
      [leave_type_id]
    );

    if (leaveTypeInfo.length === 0) {
      return errorResponse('Leave type not found', 404);
    }

    const leaveType = leaveTypeInfo[0];

    // ===== HOURLY LEAVE VALIDATION =====
    // Check if the leave type supports hourly leave
    if (is_hourly_leave && !leaveType.allow_hourly_leave) {
      return errorResponse(`Leave type "${leaveType.name_en}" (${leaveType.code}) does not support hourly leave requests`, 400);
    }

    if (leaveType.requires_attachment && (!Array.isArray(attachment_urls) || attachment_urls.length === 0)) {
      return errorResponse('This leave type requires attachment(s) for every request', 400);
    }

    // ===== CHECK/CREATE LEAVE BALANCE =====
    // This will auto-create balances from policies if they don't exist
    const balance = await getOrCreateLeaveBalance(userId, leave_type_id, currentYear);

    if (!balance) {
      return errorResponse(
        'Leave balance not found for this leave type. Please contact HR to set up leave policies.',
        404
      );
    }

    // 🔧 Admin-configurable unlimited leave detection
    // If admin sets default_days >= 999 in leave policy, it becomes unlimited (counter-based)
    const isUnlimitedLeave = parseFloat(balance.total_days || 0) >= 999;

    logger.log(`📋 [LEAVE TYPE] ${leaveType.code} - ${leaveType.name_en} (UNLIMITED: ${isUnlimitedLeave})`);
    logger.log(`💳 [DEBUG] Balance info:`, {
      total_days: balance.total_days,
      used_days: balance.used_days,
      pending_days: balance.pending_days,
      remaining_days: balance.remaining_days,
      leave_type_code: balance.leave_type_code
    });

    // ✅ UNLIMITED LEAVE: No balance check needed - it's a counter
    if (isUnlimitedLeave) {
      logger.log(`💳 [UNLIMITED] No balance check required - using counter system (total_days >= 999)`);
      logger.log(`💳 [UNLIMITED] Current days taken: ${balance.used_days || 0}, pending: ${balance.pending_days || 0}`);
      // Skip balance check entirely for unlimited leave
    } else {
      // ✅ PAID LEAVE: Check balance availability
      const used_days = parseFloat(balance.used_days || 0);
      const pending_days = parseFloat(balance.pending_days || 0);
      const total_days_balance = parseFloat(balance.total_days || 0);

      // Available balance = Total - Used - Pending
      const available_days = total_days_balance - used_days - pending_days;

      logger.log(`📊 [BALANCE] Total: ${total_days_balance}, Used: ${used_days}, Pending: ${pending_days}, Available: ${available_days}`);

      if (available_days < total_days) {
        return errorResponse(
          `Insufficient leave balance. You have ${available_days} day(s) available (Total: ${total_days_balance}, Used: ${used_days}, Pending: ${pending_days}) but requested ${total_days} day(s)`,
          400
        );
      }
    }

    // ===== CHECK FOR DUPLICATE/OVERLAPPING LEAVE REQUESTS =====
    logger.log('🔍 [DUPLICATE] Checking for overlapping leave requests...');
    try {
      // Check for existing leave requests that overlap with the requested date range
      // Only check for pending and approved requests (allow resubmission of rejected/canceled)
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
          lt.name_en as leave_type_name_en
        FROM leave_requests lr
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = $1
          AND lr.status IN ('pending', 'approved')  -- Only check active requests
          AND (
            -- Request overlaps with existing request
            (lr.start_date <= $2 AND lr.end_date >= $3)
          )
        ORDER BY lr.start_date ASC`,
        [userId, start_date, end_date]
      );

      if (overlappingRequests.length > 0) {
        logger.log('❌ [DUPLICATE] Found overlapping requests:', overlappingRequests.length);

        // Format dates to be more readable
        const formatDate = (dateString: string) => {
          const date = new Date(dateString);
          return date.toLocaleDateString('th-TH', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        };

        // Build detailed error message with information about existing active requests
        const overlappingDetails = overlappingRequests.map(req => {
          const leaveTypeName = req.leave_type_name_th || req.leave_type_name_en || 'การลา';
          const dates = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;
          const statusText = req.status === 'pending' ? 'กำลังรออนุมัติ' : 'อนุมัติแล้ว';

          let details = `${leaveTypeName} (${dates}) - สถานะ: ${statusText}`;

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

          return details;
        });

        return errorResponse(
          `ไม่สามารถสร้างคำขอลาที่ซ้ำซ้อนกันได้ ครับ/ค่ะ\n\nคุณมีคำขอลาที่กำลังดำเนินการอยู่ในช่วงเวลาดังกล่าว:\n\n${overlappingDetails.join('\n')}\n\nคำแนะนำ: คุณสามารถส่งคำขอใหม่ได้ หลังจากคำขอเดิมได้รับการอนุมัติ หรือถูกยกเลิกไปแล้ว`,
          409
        );
      }

      logger.log('✅ [DUPLICATE] No overlapping requests found');
    } catch (duplicateError) {
      logger.error('Error checking for duplicate requests:', duplicateError);
      // Continue with request creation if duplicate checking fails, but log the error
    }

    // ===== GENERATE REQUEST NUMBER =====
    const requestNumber = `LV${Date.now()}`;

    // ✅ Auto-detect language
    const reason_language = detectLanguage(reason);

    // ===== CHECK FOR AUTO-SKIP (NEW!) =====
    logger.log('🔍 [CREATE] Checking for auto-skip stages...');
    const approvalFlow = await getApprovalFlowWithAutoSkip(userId, employee.department_id);

    const initialStage = approvalFlow.initialStage;
    const skippedStages = approvalFlow.skippedStages;
    const autoSkipReason = approvalFlow.autoSkipReason;

    // Determine initial status
    let initialStatus = 'pending';
    if (skippedStages.length === approvalFlow.totalStages) {
      // All stages skipped = auto-approved
      initialStatus = 'approved';
      logger.log('✅ [CREATE] All stages skipped - request will be auto-approved');
    } else if (skippedStages.length > 0) {
      logger.log(`⏭️  [CREATE] Skipping stages: ${skippedStages.join(', ')}`);
      logger.log(`📍 [CREATE] Starting at stage: ${initialStage}`);
    }

    // ===== CREATE LEAVE REQUEST =====
    const insertResult = await query(
      `INSERT INTO leave_requests (
        employee_id, leave_type_id, request_number,
        start_date, end_date, total_days,
        reason, reason_language,
        is_half_day, half_day_period, shift_type,
        start_time, end_time,
        is_hourly_leave, leave_minutes, leave_hours, leave_start_time, leave_end_time,
        status, current_approval_stage,
        attachment_urls,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
      RETURNING *`,
      [
        userId,
        leave_type_id,
        requestNumber,
        start_date,
        end_date,
        total_days,
        reason, // ✅ ช่องเดียว
        reason_language, // ✅ ภาษาที่ใช้
        is_half_day,
        final_half_day_period,
        shift_type,
        start_time,
        end_time,
        is_hourly_leave,
        final_leave_minutes,
        leave_hours,
        leave_start_time,
        leave_end_time,
        initialStatus, // ✅ May be 'approved' if all skipped
        initialStage, // ✅ May be > 1 if stages skipped
        JSON.stringify(attachment_urls || []), // ✅ Save attachment URLs as JSON
      ]
    );

    const leaveRequest = insertResult[0];
    logger.log('✅ Leave request created:', leaveRequest.id);

    // ===== AUDIT LOG =====
    await logCreate(
      userId,
      'leave_request',
      leaveRequest.id,
      {
        leave_type_id,
        start_date,
        end_date,
        total_days,
        status: initialStatus,
      },
      event,
      { request_number: requestNumber }
    );

    // ===== BALANCE MANAGEMENT =====
    if (isUnlimitedLeave) {
      // ✅ UNLIMITED LEAVE: Track pending first, then move to used on final approval
      if (initialStatus === 'pending') {
        logger.log(`⏳ [UNLIMITED] Reserving ${total_days} days into pending counter`);
        await query(
          `UPDATE leave_balances
           SET
             pending_days = pending_days + $1,
             updated_at = NOW()
           WHERE employee_id = $2
             AND leave_type_id = $3
             AND year = $4`,
          [total_days, userId, leave_type_id, currentYear]
        );
        logger.log(`✅ [UNLIMITED] Pending counter reserved for ${total_days} days`);
      } else if (initialStatus === 'approved') {
        logger.log(`💳 [UNLIMITED] Auto-approved - incrementing used counter by ${total_days} days`);
        await query(
          `UPDATE leave_balances
           SET
             used_days = used_days + $1,
             updated_at = NOW()
           WHERE employee_id = $2
             AND leave_type_id = $3
             AND year = $4`,
          [total_days, userId, leave_type_id, currentYear]
        );
        logger.log(`✅ [UNLIMITED] Used counter incremented for ${total_days} days`);
      }
    } else {
      // ✅ PAID LEAVE: Traditional balance management
      if (initialStatus === 'pending') {
        logger.log('⏳ [CREATE] Pending request - reserving pending balance');
        await query(
          `UPDATE leave_balances
           SET pending_days = pending_days + $1,
               updated_at = NOW()
           WHERE employee_id = $2
             AND leave_type_id = $3
             AND year = $4`,
          [total_days, userId, leave_type_id, currentYear]
        );
        logger.log(`✅ [CREATE] Reserved ${total_days} days as pending balance`);
      } else if (initialStatus === 'approved') {
        logger.log('💰 [CREATE] Auto-approved - deducting leave balance immediately');
        await query(
          `UPDATE leave_balances
           SET used_days = used_days + $1,
               updated_at = NOW()
           WHERE employee_id = $2
             AND leave_type_id = $3
             AND year = $4`,
          [total_days, userId, leave_type_id, currentYear]
        );
        logger.log(`✅ [CREATE] Deducted ${total_days} days from balance`);
      }
    }

    // ===== GET FULL LEAVE REQUEST DATA =====
    const fullRequestResult = await query(
      `SELECT
        lr.*,
        e.employee_code,
        e.email,
        CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
        CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
        d.name_th as department_name_th,
        d.name_en as department_name_en,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.id = $1`,
      [leaveRequest.id]
    );

    const fullRequest = fullRequestResult[0];

    // ===== SEND EMAIL NOTIFICATIONS =====
    const emailsEnabled = await areEmailAlertsEnabled();
    if (emailsEnabled && fullRequest.email) {
      try {
        // 1. Send confirmation email to employee
        await sendLeaveRequestSubmitted(
          fullRequest.employee_name_en || fullRequest.employee_name_th,
          fullRequest.email,
          fullRequest.leave_type_name_en || fullRequest.leave_type_name_th,
          start_date,
          end_date,
          total_days,
          leaveRequest.id
        );

        // 2. Send notification to first approver (if status is pending)
        if (initialStatus === 'pending' && approvalFlow.approvers.length > 0) {
          const firstApprover = approvalFlow.approvers[0];

          // Get approver details
          const approverResult = await query(
            `SELECT email, CONCAT(first_name_en, ' ', last_name_en) as name_en,
                    CONCAT(first_name_th, ' ', last_name_th) as name_th
             FROM employees WHERE id = $1`,
            [firstApprover.id]
          );

          if (approverResult.length > 0 && approverResult[0].email) {
            await sendLeaveRequestPendingApproval(
              fullRequest.employee_name_en || fullRequest.employee_name_th,
              fullRequest.leave_type_name_en || fullRequest.leave_type_name_th,
              start_date,
              end_date,
              total_days,
              approverResult[0].email,
              approverResult[0].name_en || approverResult[0].name_th,
              leaveRequest.id
            );
          }
        }
      } catch (emailError) {
        // Don't fail the request if email fails
        logger.error('[EMAIL] Failed to send notifications:', emailError);
      }
    }

    // ===== SEND NOTIFICATIONS (LINE & TELEGRAM) =====
    try {
      // Process attachment count shared by both platforms
      let attachmentCount = 0;
      if (fullRequest.attachment_urls) {
        if (Array.isArray(fullRequest.attachment_urls)) {
          attachmentCount = fullRequest.attachment_urls.length;
        } else if (typeof fullRequest.attachment_urls === 'string') {
          try {
            const parsed = JSON.parse(fullRequest.attachment_urls);
            attachmentCount = Array.isArray(parsed) ? parsed.length : 0;
          } catch (e) {
            attachmentCount = 0;
          }
        }
      }

      const notificationParams = {
        action: 'created' as const,
        employeeName: fullRequest.employee_name_th || fullRequest.employee_name_en,
        departmentName: fullRequest.department_name_en || fullRequest.department_name_th,
        leaveTypeName: fullRequest.leave_type_name_th || fullRequest.leave_type_name_en,
        startDate: start_date,
        endDate: end_date,
        totalDays: total_days,
        reason: reason,
        // Hourly leave info
        isHourlyLeave: is_hourly_leave,
        leaveMinutes: final_leave_minutes || undefined,
        leaveStartTime: leave_start_time,
        leaveEndTime: leave_end_time,
        // Attachment info
        hasAttachments: attachmentCount > 0,
        attachmentCount: attachmentCount,
      };

      // 1. Send LINE Info
      await sendLeaveRequestNotification(notificationParams);

      // 2. Send Telegram Info
      await sendTelegramLeaveNotification(notificationParams);

    } catch (notifyError) {
      // Don't fail the request if notification fails
      logger.error('[NOTIFY] Failed to send notification:', notifyError);
    }

    return successResponse({
      leave_request: fullRequest,
      message: 'Leave request created successfully',
    });
  } catch (error: any) {
    logger.error('❌ Create leave request error:', error);
    return errorResponse(error.message || 'Failed to create leave request', 500);
  }
};

export const handler: Handler = requireAuth(createLeaveRequest);
