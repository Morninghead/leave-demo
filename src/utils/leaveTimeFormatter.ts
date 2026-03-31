// src/utils/leaveTimeFormatter.ts
// Utility functions for formatting leave time (days, hours, minutes)

export interface TimeBreakdown {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

/**
 * Format for displaying leave balance with half-day highlighting
 * Used for leave types that allow hourly leave
 */
export interface HalfDayFormat {
  fullDays: number;           // Full days (integer part)
  hasHalfDay: boolean;         // Whether there's a half day (0.5)
  extraHours: number;          // Remaining hours as decimal (not minutes)
  totalDaysWithHalf: number;   // Full days + 0.5 if hasHalfDay
}

/**
 * Convert minutes to days, hours, and minutes breakdown
 * @param totalMinutes - Total minutes
 * @param minutesPerDay - Minutes in a working day (default: 480 = 8 hours)
 */
export function minutesToTimeBreakdown(
  totalMinutes: number,
  minutesPerDay: number = 480
): TimeBreakdown {
  if (totalMinutes <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMinutes: 0 };
  }

  const days = Math.floor(totalMinutes / minutesPerDay);
  const remainingMinutes = totalMinutes % minutesPerDay;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  return {
    days,
    hours,
    minutes,
    totalMinutes,
  };
}

/**
 * Convert days (decimal) to half-day format
 * Example: 3.9 days -> { fullDays: 3, hasHalfDay: true, extraHours: 3.2 }
 *
 * @param days - Decimal days (e.g., 3.9, 2.3, 5.5)
 * @param hoursPerDay - Hours in a working day (default: 8)
 */
export function daysToHalfDayFormat(
  days: number,
  hoursPerDay: number = 8
): HalfDayFormat {
  if (days <= 0) {
    return {
      fullDays: 0,
      hasHalfDay: false,
      extraHours: 0,
      totalDaysWithHalf: 0
    };
  }

  const fullDays = Math.floor(days);
  const fraction = days - fullDays;

  // Check if fraction includes half day (>= 0.5)
  const hasHalfDay = fraction >= 0.5;

  // Calculate extra hours from remaining fraction
  const rawExtraHours = hasHalfDay
    ? (fraction - 0.5) * hoursPerDay
    : fraction * hoursPerDay;
  const extraHours = Math.round(rawExtraHours * 10) / 10;

  return {
    fullDays,
    hasHalfDay,
    extraHours,
    totalDaysWithHalf: hasHalfDay ? fullDays + 0.5 : fullDays
  };
}

/**
 * Format half-day balance to display string
 * @param format - HalfDayFormat object
 * @param language - Language ('th' or 'en')
 */
export function formatHalfDayBalance(
  format: HalfDayFormat,
  language: 'th' | 'en' = 'th'
): string {
  const dayLabel = language === 'th' ? 'วัน' : 'day' + (format.totalDaysWithHalf !== 1 ? 's' : '');
  const hourLabel = language === 'th' ? 'ชม.' : 'hr' + (format.extraHours !== 1 ? 's' : '');

  let result = '';

  // Show days with half if exists
  if (format.hasHalfDay) {
    result = `${format.fullDays}.5 ${dayLabel}`;
  } else if (format.fullDays > 0) {
    result = `${format.fullDays} ${dayLabel}`;
  }

  // Show extra hours if > 0
  if (format.extraHours > 0) {
    const hoursText = `${format.extraHours} ${hourLabel}`;
    result = result ? `${result} ${hoursText}` : hoursText;
  }

  return result || `0 ${dayLabel}`;
}

/**
 * Convert days to minutes
 * @param days - Number of days
 * @param minutesPerDay - Minutes in a working day (default: 480)
 */
export function daysToMinutes(days: number, minutesPerDay: number = 480): number {
  return days * minutesPerDay;
}

/**
 * Format time breakdown to human-readable string
 * @param breakdown - Time breakdown object
 * @param language - Language ('th' or 'en')
 * @param showZeroValues - Whether to show zero values (default: false)
 */
export function formatTimeBreakdown(
  breakdown: TimeBreakdown,
  language: 'th' | 'en' = 'en',
  showZeroValues: boolean = false
): string {
  const parts: string[] = [];

  const labels = language === 'th'
    ? { day: 'วัน', days: 'วัน', hour: 'ชั่วโมง', hours: 'ชั่วโมง', minute: 'นาที', minutes: 'นาที' }
    : { day: 'day', days: 'days', hour: 'hour', hours: 'hours', minute: 'minute', minutes: 'minutes' };

  if (breakdown.days > 0 || showZeroValues) {
    const dayLabel = breakdown.days === 1 ? labels.day : labels.days;
    parts.push(`${breakdown.days} ${dayLabel}`);
  }

  if (breakdown.hours > 0 || (showZeroValues && breakdown.days === 0)) {
    const hourLabel = breakdown.hours === 1 ? labels.hour : labels.hours;
    parts.push(`${breakdown.hours} ${hourLabel}`);
  }

  if (breakdown.minutes > 0 || (showZeroValues && breakdown.days === 0 && breakdown.hours === 0)) {
    const minuteLabel = breakdown.minutes === 1 ? labels.minute : labels.minutes;
    parts.push(`${breakdown.minutes} ${minuteLabel}`);
  }

  return parts.length > 0 ? parts.join(' ') : `0 ${language === 'th' ? 'วัน' : 'days'}`;
}

/**
 * Format time breakdown to compact format (e.g., "2d 3h 30m")
 */
export function formatTimeBreakdownCompact(breakdown: TimeBreakdown): string {
  const parts: string[] = [];

  if (breakdown.days > 0) {
    parts.push(`${breakdown.days}d`);
  }

  if (breakdown.hours > 0) {
    parts.push(`${breakdown.hours}h`);
  }

  if (breakdown.minutes > 0 || (breakdown.days === 0 && breakdown.hours === 0)) {
    parts.push(`${breakdown.minutes}m`);
  }

  return parts.join(' ');
}

/**
 * Format leave balance display
 * @param totalDays - Total days (from database)
 * @param usedDays - Used days (from database)
 * @param remainingDays - Remaining days (from database)
 * @param allowHourlyLeave - Whether this leave type allows hourly tracking
 * @param totalMinutes - Total accumulated minutes (optional)
 * @param usedMinutes - Used minutes (optional)
 * @param minutesPerDay - Minutes per working day (default: 480)
 * @param language - Language for display
 */
export function formatLeaveBalance(
  totalDays: number,
  usedDays: number,
  remainingDays: number,
  allowHourlyLeave: boolean,
  totalMinutes?: number,
  usedMinutes?: number,
  minutesPerDay: number = 480,
  language: 'th' | 'en' = 'en'
): {
  total: string;
  used: string;
  remaining: string;
  totalCompact: string;
  usedCompact: string;
  remainingCompact: string;
  isUnlimited: boolean;
  // New fields for half-day format
  remainingHalfDayFormat?: HalfDayFormat;
  totalHalfDayFormat?: HalfDayFormat;
  usedHalfDayFormat?: HalfDayFormat;
} {
  // Check if unlimited (0 total days)
  const isUnlimited = totalDays === 0;

  if (isUnlimited) {
    // Unlimited leave type - just count usage
    if (allowHourlyLeave && usedMinutes !== undefined) {
      const usedBreakdown = minutesToTimeBreakdown(usedMinutes, minutesPerDay);
      return {
        total: language === 'th' ? 'ไม่จำกัด' : 'Unlimited',
        used: formatTimeBreakdown(usedBreakdown, language),
        remaining: language === 'th' ? 'ไม่จำกัด' : 'Unlimited',
        totalCompact: '∞',
        usedCompact: formatTimeBreakdownCompact(usedBreakdown),
        remainingCompact: '∞',
        isUnlimited: true,
      };
    } else {
      return {
        total: language === 'th' ? 'ไม่จำกัด' : 'Unlimited',
        used: `${usedDays} ${language === 'th' ? 'วัน' : 'days'}`,
        remaining: language === 'th' ? 'ไม่จำกัด' : 'Unlimited',
        totalCompact: '∞',
        usedCompact: `${usedDays}d`,
        remainingCompact: '∞',
        isUnlimited: true,
      };
    }
  }

  // Limited leave type
  if (allowHourlyLeave && totalMinutes !== undefined && usedMinutes !== undefined) {
    // Use half-day format for hourly leave types
    const hoursPerDay = minutesPerDay / 60;

    const totalDaysDecimal = totalMinutes / minutesPerDay;
    const usedDaysDecimal = usedMinutes / minutesPerDay;
    const remainingDaysDecimal = (totalMinutes - usedMinutes) / minutesPerDay;

    const totalFormat = daysToHalfDayFormat(totalDaysDecimal, hoursPerDay);
    const usedFormat = daysToHalfDayFormat(usedDaysDecimal, hoursPerDay);
    const remainingFormat = daysToHalfDayFormat(remainingDaysDecimal, hoursPerDay);

    return {
      total: formatHalfDayBalance(totalFormat, language),
      used: formatHalfDayBalance(usedFormat, language),
      remaining: formatHalfDayBalance(remainingFormat, language),
      totalCompact: formatHalfDayBalance(totalFormat, language),
      usedCompact: formatHalfDayBalance(usedFormat, language),
      remainingCompact: formatHalfDayBalance(remainingFormat, language),
      isUnlimited: false,
      totalHalfDayFormat: totalFormat,
      usedHalfDayFormat: usedFormat,
      remainingHalfDayFormat: remainingFormat,
    };
  } else {
    // Regular day-based leave
    return {
      total: `${totalDays} ${language === 'th' ? 'วัน' : 'days'}`,
      used: `${usedDays} ${language === 'th' ? 'วัน' : 'days'}`,
      remaining: `${remainingDays} ${language === 'th' ? 'วัน' : 'days'}`,
      totalCompact: `${totalDays}d`,
      usedCompact: `${usedDays}d`,
      remainingCompact: `${remainingDays}d`,
      isUnlimited: false,
    };
  }
}

/**
 * Calculate percentage for progress bar
 * @param used - Used amount
 * @param total - Total amount
 * @param isUnlimited - Whether this is unlimited leave
 */
export function calculateLeavePercentage(
  used: number,
  total: number,
  isUnlimited: boolean
): number {
  if (isUnlimited || total === 0) {
    return 0; // Don't show progress for unlimited
  }

  const remaining = total - used;
  if (remaining < 0) return 0;
  if (total === 0) return 0;

  return (remaining / total) * 100;
}

/**
 * Format leave balance in Thai style (.5 day + hours in 0.5 increments)
 *
 * Rules:
 * - Days: Always display as .0 or .5 (rounded down)
 * - Hours: Minimum 0.5 hours, rounded to 0.5 increments (30 min minimum)
 * - No decimals like 3.9 days, 3.7 days, 2.4 hours, 1.6 hours
 *
 * Examples for Hourly Leave Types:
 * - 4.0 days (no usage) → "4 วัน"
 * - 3.9375 days (used 30 min) → "3.5 วัน 3.5 ชั่วโมง"
 * - 3.875 days (used 1 hr) → "3.5 วัน 3 ชั่วโมง"
 * - 0.0625 days (30 min only) → "0.5 ชั่วโมง" (no "0 วัน")
 * - 0.125 days (1 hr only) → "1 ชั่วโมง"
 * - 0.5 days (half day) → "0.5 วัน"
 *
 * @param totalDays - Total days (can have any decimal value)
 * @param language - Language ('th' or 'en')
 */
export function formatThaiLeaveBalance(totalDays: number, language: 'th' | 'en' = 'th'): string {
  if (totalDays < 0) totalDays = 0;

  // Round down to .0 or .5 (ปัดลงเป็น .0 หรือ .5 เท่านั้น)
  const dayPart = Math.floor(totalDays * 2) / 2;

  // Calculate remaining hours from the fractional part
  const remainingDays = totalDays - dayPart;
  const hoursExact = remainingDays * 8; // 1 day = 8 hours

  // ✅ CRITICAL: Round hours to 0.5 increments (30 minutes minimum)
  // Example: 3.2 hrs → 3 hrs, 3.7 hrs → 3.5 hrs, 0.3 hrs → 0.5 hrs
  const hours = Math.round(hoursExact * 2) / 2;

  const dayLabel = language === 'th' ? 'วัน' : (dayPart === 1 ? 'day' : 'days');
  const hourLabel = language === 'th' ? 'ชั่วโมง' : (hours === 1 ? 'hour' : 'hours');

  // แสดงชั่วโมงถ้ามีค่ามากกว่า 0.01 (เพื่อหลีกเลี่ยง floating point errors)
  if (hours >= 0.5) {
    // แสดงเลขเต็มถ้าเป็นเลขเต็ม (1, 2, 3), แสดง .5 ถ้าเป็นครึ่ง (0.5, 1.5, 2.5)
    const displayHours = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);

    // ถ้ามีแค่ชั่วโมง (ไม่มีวัน) ไม่ต้องแสดง "0 วัน"
    if (dayPart === 0) {
      return `${displayHours} ${hourLabel}`;
    }
    return `${dayPart} ${dayLabel} ${displayHours} ${hourLabel}`;
  } else {
    // ไม่มีชั่วโมงเศษ แสดงแค่วัน
    return `${dayPart} ${dayLabel}`;
  }
}

/**
 * Format leave balance from minutes in Thai style
 * Converts minutes to days first, then formats using Thai style
 *
 * @param totalMinutes - Total minutes
 * @param minutesPerDay - Minutes per working day (default: 480 = 8 hours)
 * @param language - Language ('th' or 'en')
 */
export function formatThaiLeaveBalanceFromMinutes(
  totalMinutes: number,
  minutesPerDay: number = 480,
  language: 'th' | 'en' = 'th'
): string {
  const totalDays = totalMinutes / minutesPerDay;
  return formatThaiLeaveBalance(totalDays, language);
}

/**
 * Format leave duration for display in leave request lists/modals
 * 
 * Rules:
 * - 8 hours = 1 day (full day)
 * - 4 hours = 0.5 day (half day) 
 * - Less than 4 hours = show as hours (e.g., 2 ชม., 3.5 ชม.)
 * - More than 4 hours but less than 8 = show as hours (e.g., 5 ชม., 7 ชม.)
 * - Minimum unit = 30 minutes (0.5 ชม.)
 * 
 * Examples:
 * - 480 min = 1 วัน
 * - 240 min = ครึ่งวัน
 * - 300 min = 5 ชม.
 * - 270 min = 4.5 ชม.
 * - 30 min = 30 นาที
 * - 90 min = 1.5 ชม.
 * 
 * @param totalDays - Total days (decimal from database, e.g., 0.63, 1.0, 0.5)
 * @param leaveMinutes - Leave minutes (for hourly leave)
 * @param isHourlyLeave - Whether this is hourly leave
 * @param language - Language ('th' or 'en')
 */
export function formatLeaveDuration(
  totalDays: number,
  leaveMinutes: number | null | undefined,
  isHourlyLeave: boolean,
  language: 'th' | 'en' = 'th'
): string {
  // For hourly leave, use minutes for calculation
  if (isHourlyLeave && leaveMinutes && leaveMinutes > 0) {
    const minutesPerDay = 480; // 8 hours
    const halfDayMinutes = 240; // 4 hours

    // If it's exactly 1 day or more
    if (leaveMinutes >= minutesPerDay) {
      const days = leaveMinutes / minutesPerDay;
      // Check if it's exactly full days
      if (leaveMinutes % minutesPerDay === 0) {
        return `${Math.round(days)} ${language === 'th' ? 'วัน' : 'day(s)'}`;
      }
      // Has remainder - format with formatThaiLeaveBalanceFromMinutes
      return formatThaiLeaveBalanceFromMinutes(leaveMinutes, minutesPerDay, language);
    }

    // If it's exactly half day (4 hours = 240 min)
    if (leaveMinutes === halfDayMinutes) {
      return language === 'th' ? 'ครึ่งวัน' : 'Half day';
    }

    // If less than 1 day, show as hours or minutes
    const hours = leaveMinutes / 60;

    // If less than 1 hour, show as minutes (minimum 30 min)
    if (leaveMinutes < 60) {
      // Round to 30-minute increments
      const roundedMinutes = Math.round(leaveMinutes / 30) * 30;
      const displayMinutes = Math.max(roundedMinutes, 30);
      return `${displayMinutes} ${language === 'th' ? 'นาที' : 'min'}`;
    }

    // Round hours to 0.5 increments (30 min)
    const roundedHours = Math.round(hours * 2) / 2;

    // Format hours - show as integer if whole, otherwise show with .5
    const displayHours = roundedHours % 1 === 0
      ? roundedHours.toString()
      : roundedHours.toFixed(1);

    return `${displayHours} ${language === 'th' ? 'ชม.' : 'hr'}`;
  }

  // For non-hourly leave or when no minutes available
  // Check if it's a nice round number
  if (totalDays === 1) {
    return `1 ${language === 'th' ? 'วัน' : 'day'}`;
  }

  if (totalDays === 0.5) {
    return language === 'th' ? 'ครึ่งวัน' : 'Half day';
  }

  // If totalDays is a whole number
  if (totalDays % 1 === 0) {
    return `${totalDays} ${language === 'th' ? 'วัน' : 'days'}`;
  }

  // If totalDays ends in .5
  if ((totalDays * 2) % 1 === 0) {
    return `${totalDays} ${language === 'th' ? 'วัน' : 'days'}`;
  }

  // For decimal days that aren't nice (like 0.63), convert to hours
  // This is likely hourly leave stored as days
  const totalMinutes = totalDays * 480; // 8 hours per day
  const hours = totalMinutes / 60;

  // Round to 0.5 increments
  const roundedHours = Math.round(hours * 2) / 2;

  // If less than 1 hour
  if (roundedHours < 1) {
    const minutes = Math.round(totalMinutes / 30) * 30;
    return `${Math.max(minutes, 30)} ${language === 'th' ? 'นาที' : 'min'}`;
  }

  // Format hours
  const displayHours = roundedHours % 1 === 0
    ? roundedHours.toString()
    : roundedHours.toFixed(1);

  return `${displayHours} ${language === 'th' ? 'ชม.' : 'hr'}`;
}
