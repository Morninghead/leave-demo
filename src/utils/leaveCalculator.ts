// src/utils/leaveCalculator.ts

export interface LeaveBalance {
  total_days: number;
  used_days: number;
  accumulated_minutes: number;
}

export interface LeaveCalculationResult {
  days: number;
  hours: number;
  minutes: number;
  total_days_decimal: number;
}

/**
 * คำนวณวันลา + ชั่วโมงสะสม
 * กฎ: ทุก 240 นาที (4 ชม.) → แปลงเป็น 0.5 วัน
 */
export function calculateLeaveDisplay(
  currentDays: number,
  accumulatedMinutes: number
): LeaveCalculationResult {
  const MINUTES_PER_HALF_DAY = 240; // 4 ชม. = 0.5 วัน
  
  // คำนวณจำนวนครึ่งวันที่แปลงได้จากนาทีสะสม
  const additionalHalfDays = Math.floor(accumulatedMinutes / MINUTES_PER_HALF_DAY);
  const remainingMinutes = accumulatedMinutes % MINUTES_PER_HALF_DAY;
  
  // วันลารวม
  const totalDays = currentDays + (additionalHalfDays * 0.5);
  
  // แปลงนาทีที่เหลือเป็น ชม:นาที
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  
  // คำนวณ total_days แบบทศนิยม (สำหรับ database)
  // ใช้ parseFloat และ toFixed(2) เพื่อแก้ปัญหา floating point precision
  const total_days_decimal = parseFloat(
    (totalDays + (remainingMinutes / 480)).toFixed(2)
  );
  
  return {
    days: totalDays,
    hours,
    minutes,
    total_days_decimal
  };
}

/**
 * แสดงผลวันลาแบบ human-readable (Thai)
 */
export function formatLeaveDisplayTH(result: LeaveCalculationResult): string {
  const parts: string[] = [];
  
  if (result.days > 0) {
    parts.push(`${result.days} วัน`);
  }
  
  if (result.hours > 0) {
    parts.push(`${result.hours} ชม.`);
  }
  
  if (result.minutes > 0) {
    parts.push(`${result.minutes} นาที`);
  }
  
  return parts.length > 0 ? parts.join(' ') : '0 วัน';
}

/**
 * แสดงผลวันลาแบบ human-readable (English)
 */
export function formatLeaveDisplayEN(result: LeaveCalculationResult): string {
  const parts: string[] = [];
  
  if (result.days > 0) {
    const dayLabel = result.days === 1 ? 'day' : 'days';
    parts.push(`${result.days} ${dayLabel}`);
  }
  
  if (result.hours > 0) {
    const hourLabel = result.hours === 1 ? 'hour' : 'hours';
    parts.push(`${result.hours} ${hourLabel}`);
  }
  
  if (result.minutes > 0) {
    const minLabel = result.minutes === 1 ? 'minute' : 'minutes';
    parts.push(`${result.minutes} ${minLabel}`);
  }
  
  return parts.length > 0 ? parts.join(' ') : '0 days';
}

/**
 * เพิ่มนาทีลาเข้าไปในยอดสะสม
 */
export function addLeaveMinutes(
  currentBalance: LeaveBalance,
  newLeaveMinutes: number
): LeaveBalance {
  const MINUTES_PER_HALF_DAY = 240;
  
  // รวมนาทีสะสมใหม่
  const totalMinutes = currentBalance.accumulated_minutes + newLeaveMinutes;
  
  // คำนวณครึ่งวันที่แปลงได้
  const additionalHalfDays = Math.floor(totalMinutes / MINUTES_PER_HALF_DAY);
  const remainingMinutes = totalMinutes % MINUTES_PER_HALF_DAY;
  
  return {
    total_days: currentBalance.total_days,
    used_days: currentBalance.used_days + (additionalHalfDays * 0.5),
    accumulated_minutes: remainingMinutes
  };
}

/**
 * คำนวณนาทีจากช่วงเวลา (start_time - end_time)
 */
export function calculateMinutesDifference(
  startTime: string, // "08:30"
  endTime: string     // "12:00"
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return endMinutes - startMinutes;
}

/**
 * แปลงนาทีเป็นรูปแบบ "HH:MM"
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * แสดงผลระยะเวลาการลาตามประเภท (Full day, Half day, Hourly)
 * รองรับภาษาไทยและอังกฤษ
 */
export function formatLeaveDuration(
  totalDays: number,
  isHalfDay: boolean = false,
  isHourlyLeave: boolean = false,
  leaveMinutes: number = 0,
  language: 'th' | 'en' = 'th',
  leaveTypeNameTh?: string,
  leaveTypeNameEn?: string
): { value: string; unit: string } {
  // กรณีลารายชั่วโมง
  if (isHourlyLeave && leaveMinutes > 0) {
    // For hourly leave, use a more robust calculation
    // Try to detect and correct floating-point precision issues
    let finalMinutes = Math.round(leaveMinutes);

    // If we have start and end times, recalculate from them (most reliable)
    // This handles cases where the stored leave_minutes value is incorrect due to floating-point precision
    const expectedHours = [1, 2, 3, 4, 5, 6, 7, 8]; // Common hourly leave durations

    // Check if this is close to an exact hour and correct it
    for (const hour of expectedHours) {
      const exactMinutes = hour * 60;
      if (Math.abs(finalMinutes - exactMinutes) <= 2) { // Allow 2-minute tolerance
        finalMinutes = exactMinutes;
        break;
      }
    }

    // Check if this represents an exact hour (to avoid showing "2 นาที" residue)
    const isExactHour = finalMinutes % 60 === 0;

    const hours = Math.floor(finalMinutes / 60);
    const minutes = isExactHour ? 0 : finalMinutes % 60;

    if (language === 'th') {
      let value = '';
      if (hours > 0) value += `${hours} ชม.`;
      if (minutes > 0) value += `${minutes > 0 && hours > 0 ? ' ' : ''}${minutes} นาที`;
      return { value, unit: '' };
    } else {
      let value = '';
      if (hours > 0) value += `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) value += `${minutes > 0 && hours > 0 ? ' ' : ''}${minutes} minute${minutes !== 1 ? 's' : ''}`;
      return { value, unit: '' };
    }
  }

  // กรณีลาครึ่งวัน
  if (isHalfDay) {
    return {
      value: '0.5',
      unit: language === 'th' ? 'วัน' : 'day'
    };
  }

  // กรณีลาน้อยกว่า 1 วัน แต่เป็นประเภทที่允许ลารายชั่วโมง (Annual leave, Personal leave)
  // ให้แสดงเป็นชั่วโมงแทนที่จะแสดงเป็นวันทศนิยม
  if (totalDays < 1 && totalDays > 0) {
    // ตรวจสอบว่าเป็นประเภทลาที่允许ลารายชั่วโมงหรือไม่
    const typeName = language === 'th' ? (leaveTypeNameTh || '') : (leaveTypeNameEn || '');
    const lowerTypeName = typeName.toLowerCase();

    const allowDecimal =
      lowerTypeName.includes('พักร้อน') ||
      lowerTypeName.includes('annual') ||
      lowerTypeName.includes('vacation') ||
      lowerTypeName.includes('ป่วย') ||
      lowerTypeName.includes('sick') ||
      lowerTypeName.includes('กิจ') ||
      lowerTypeName.includes('personal') ||
      lowerTypeName.includes('business');

    // ถ้าเป็นประเภทที่允许ลารายชั่วโมง หรือถ้าไม่มีข้อมูลประเภท (default ให้แสดงเป็นชั่วโมง)
    if (allowDecimal || !typeName) {
      // Fix floating point precision issues
      // Convert to minutes with higher precision, then round to nearest minute
      const totalMinutes = Math.round(totalDays * 480 * 100000) / 100000; // Maintain precision
      let finalMinutes = Math.round(totalMinutes); // Round to nearest minute

      // Additional correction for common hourly values that might have precision issues
      const expectedHours = [1, 2, 3, 4, 5, 6, 7, 8]; // Common hourly leave durations

      // Check if this is close to an exact hour and correct it
      for (const hour of expectedHours) {
        const exactMinutes = hour * 60;
        if (Math.abs(finalMinutes - exactMinutes) <= 2) { // Allow 2-minute tolerance
          finalMinutes = exactMinutes;
          break;
        }
      }

      // Check if this represents an exact hour (to avoid showing "2 นาที" residue)
      const isExactHour = finalMinutes % 60 === 0;

      const hours = Math.floor(finalMinutes / 60);
      const minutes = isExactHour ? 0 : finalMinutes % 60;

      if (language === 'th') {
        let value = '';
        if (hours > 0) value += `${hours} ชม.`;
        if (minutes > 0) value += `${minutes > 0 && hours > 0 ? ' ' : ''}${minutes} นาที`;
        return { value, unit: '' };
      } else {
        let value = '';
        if (hours > 0) value += `${hours} hour${hours !== 1 ? 's' : ''}`;
        if (minutes > 0) value += `${minutes > 0 && hours > 0 ? ' ' : ''}${minutes} minute${minutes !== 1 ? 's' : ''}`;
        return { value, unit: '' };
      }
    }

    // ถ้าไม่ใช่ประเภทที่允许ลารายชั่วโมง ให้แสดงเป็นวันทศนิยม
    return {
      value: totalDays.toFixed(2),
      unit: language === 'th' ? 'วัน' : (totalDays === 1 ? 'day' : 'days')
    };
  }

  // กรณีลาหลายวัน
  return {
    value: totalDays.toString(),
    unit: language === 'th' ? 'วัน' : (totalDays === 1 ? 'day' : 'days')
  };
}

/**
 * แสดงผลระยะเวลาการลาแบบสำเร็จรูป (สำหรับแสดงใน UI)
 */
export function formatLeaveDurationDisplay(
  request: {
    total_days: number;
    is_half_day?: boolean;
    is_hourly_leave?: boolean;
    leave_minutes?: number;
    leave_type_name_th?: string;
    leave_type_name_en?: string;
  },
  language: 'th' | 'en' = 'th'
): string {
  const { value, unit } = formatLeaveDuration(
    request.total_days,
    request.is_half_day,
    request.is_hourly_leave,
    request.leave_minutes || 0,
    language,
    request.leave_type_name_th,
    request.leave_type_name_en
  );

  return unit ? `${value} ${unit}` : value;
}
