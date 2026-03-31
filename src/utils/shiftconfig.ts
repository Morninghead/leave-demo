export interface ShiftPeriodConfig {
  name_th: string;
  name_en: string;
  start_time: string;
  end_time: string;
  icon: string;
  hours: number;
}

export interface ShiftConfig {
  type: 'day' | 'night';
  name_th: string;
  name_en: string;
  icon: string;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  is_cross_day: boolean;
  work_hours: number;
  half_periods: {
    first: ShiftPeriodConfig;
    second: ShiftPeriodConfig;
  };
}

export const SHIFT_CONFIGS: Record<'day' | 'night', ShiftConfig> = {
  day: {
    type: 'day',
    name_th: 'กะเช้า',
    name_en: 'Day Shift',
    icon: '☀️',
    start_time: '08:00:00',
    end_time: '17:00:00',
    break_start: '12:00:00',
    break_end: '13:00:00',
    is_cross_day: false,
    work_hours: 8,
    half_periods: {
      first: {
        name_th: 'ครึ่งเช้า',
        name_en: 'Morning',
        start_time: '08:00:00',
        end_time: '12:00:00',
        icon: '🌅',
        hours: 4,
      },
      second: {
        name_th: 'ครึ่งบ่าย',
        name_en: 'Afternoon',
        start_time: '13:00:00',
        end_time: '17:00:00',
        icon: '🌆',
        hours: 4,
      },
    },
  },
  night: {
    type: 'night',
    name_th: 'กะกลางคืน',
    name_en: 'Night Shift',
    icon: '🌙',
    start_time: '20:00:00',
    end_time: '05:00:00',
    break_start: '00:00:00',
    break_end: '01:00:00',
    is_cross_day: true,
    work_hours: 8,
    half_periods: {
      first: {
        name_th: 'ครึ่งแรก',
        name_en: 'First Half',
        start_time: '20:00:00',
        end_time: '00:00:00',
        icon: '🌃',
        hours: 4,
      },
      second: {
        name_th: 'ครึ่งหลัง',
        name_en: 'Second Half',
        start_time: '01:00:00',
        end_time: '05:00:00',
        icon: '🌌',
        hours: 4,
      },
    },
  },
};

// Helper Functions
export function getShiftConfig(shiftType: 'day' | 'night'): ShiftConfig {
  return SHIFT_CONFIGS[shiftType];
}

export function getHalfPeriodConfig(
  shiftType: 'day' | 'night',
  period: 'first' | 'second'
): ShiftPeriodConfig {
  const periodKey = shiftType === 'day' 
    ? (period === 'first' ? 'first' : 'second')
    : (period === 'first' ? 'first' : 'second');
  
  return SHIFT_CONFIGS[shiftType].half_periods[periodKey];
}

export function formatShiftTime(
  shiftType: 'day' | 'night',
  language: 'th' | 'en' = 'th'
): string {
  const shift = SHIFT_CONFIGS[shiftType];
  const start = shift.start_time.substring(0, 5);
  const end = shift.end_time.substring(0, 5);
  
  if (shift.is_cross_day) {
    return language === 'th' 
      ? `${start} - ${end} (รุ่งเช้า)` 
      : `${start} - ${end} (next day)`;
  }
  return `${start} - ${end}`;
}

export function formatBreakTime(shiftType: 'day' | 'night'): string {
  const shift = SHIFT_CONFIGS[shiftType];
  const start = shift.break_start.substring(0, 5);
  const end = shift.break_end.substring(0, 5);
  return `${start} - ${end}`;
}

export function getHalfDayPeriodKey(
  shiftType: 'day' | 'night',
  period: 'first' | 'second'
): 'morning' | 'afternoon' | 'first_half' | 'second_half' {
  if (shiftType === 'day') {
    return period === 'first' ? 'morning' : 'afternoon';
  }
  return period === 'first' ? 'first_half' : 'second_half';
}

export function formatPeriodTime(
  shiftType: 'day' | 'night',
  period: 'first' | 'second',
  language: 'th' | 'en' = 'th'
): string {
  const config = getHalfPeriodConfig(shiftType, period);
  const start = config.start_time.substring(0, 5);
  const end = config.end_time.substring(0, 5);
  
  let timeStr = `${start} - ${end}`;
  
  // เพิ่มคำเตือนถ้าข้ามวัน
  if (shiftType === 'night' && period === 'second') {
    timeStr += language === 'th' ? ' (รุ่งเช้า)' : ' (next day)';
  }
  
  return timeStr;
}
