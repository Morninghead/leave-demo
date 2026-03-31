import { format, parseISO, isValid, startOfYear, endOfYear, Locale } from 'date-fns';
import { th, enUS } from 'date-fns/locale';

// Locale mapping
const locales: { [key: string]: Locale } = {
  th: th,
  en: enUS,
};

// Thailand timezone offset
const THAILAND_TIMEZONE = 'Asia/Bangkok';

/**
 * แปลง Date เป็น Thailand timezone ด้วย Native API
 * @param date - วันที่
 */
export function toThailandTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  // แปลงเป็น Thailand timezone string แล้วสร้าง Date ใหม่
  const thaiTimeString = dateObj.toLocaleString('en-US', {
    timeZone: THAILAND_TIMEZONE,
  });

  return new Date(thaiTimeString);
}

/**
 * แปลง Date เป็น YYYY-MM-DD string ใน local timezone (Thailand)
 * หลีกเลี่ยงปัญหา timezone shift ที่เกิดจาก toISOString()
 * 
 * @param date - วันที่
 * @returns string ในรูปแบบ YYYY-MM-DD
 * 
 * @example
 * // ถ้าอยู่ใน Bangkok timezone:
 * toLocalDateString(new Date('2025-12-27T00:00:00+07:00')) // "2025-12-27"
 * // toISOString() จะได้ "2025-12-26T17:00:00.000Z" ซึ่งผิด!
 */
export function toLocalDateString(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) return '';

  // ใช้ Thailand timezone เพื่อให้ได้วันที่ถูกต้อง
  const thaiDate = toThailandTime(dateObj);

  const year = thaiDate.getFullYear();
  const month = String(thaiDate.getMonth() + 1).padStart(2, '0');
  const day = String(thaiDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format date ตามภาษา พร้อม Timezone
 * @param date - วันที่
 * @param formatStr - รูปแบบการแสดงผล
 * @param language - ภาษา (th/en)
 * @param useBuddhistYear - ใช้พ.ศ. หรือไม่ (เฉพาะภาษาไทย)
 * @param useThailandTimezone - แปลงเป็นเวลาไทยหรือไม่
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = 'dd/MM/yyyy',
  language: string = 'th',
  useBuddhistYear: boolean = true,
  useThailandTimezone: boolean = true
): string {
  if (!date) return '';

  try {
    let dateObj = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(dateObj)) return '';

    // แปลงเป็นเวลาไทย
    if (useThailandTimezone) {
      dateObj = toThailandTime(dateObj);
    }

    const locale = locales[language] || locales.th;
    let formattedDate = format(dateObj, formatStr, { locale });

    // แปลงเป็น พ.ศ. สำหรับภาษาไทย
    if (language === 'th' && useBuddhistYear) {
      const year = dateObj.getFullYear();
      const buddhistYear = year + 543;
      formattedDate = formattedDate.replace(year.toString(), buddhistYear.toString());
    }

    return formattedDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Format date แบบสั้น
 * @param date - วันที่
 * @param language - ภาษา
 */
export function formatDateShort(
  date: Date | string | null | undefined,
  language: string = 'th'
): string {
  return formatDate(date, 'dd MMM yyyy', language);
}

/**
 * Format date แบบยาว
 * @param date - วันที่
 * @param language - ภาษา
 */
export function formatDateLong(
  date: Date | string | null | undefined,
  language: string = 'th'
): string {
  return formatDate(date, 'dd MMMM yyyy', language);
}

/**
 * Format date พร้อมเวลา (Thailand timezone)
 * @param date - วันที่
 * @param language - ภาษา
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  language: string = 'th'
): string {
  return formatDate(date, 'dd MMM yyyy HH:mm', language, true, true);
}

/**
 * Format เวลาแบบยาว (8 ตุลาคม 2568 เวลา 08:28 น.)
 * @param date - วันที่
 * @param language - ภาษา
 */
export function formatDateTimeLong(
  date: Date | string | null | undefined,
  language: string = 'th'
): string {
  if (language === 'th') {
    return formatDate(date, 'dd MMMM yyyy', language) + ' เวลา ' +
      formatDate(date, 'HH:mm', language) + ' น.';
  } else {
    return formatDate(date, "dd MMMM yyyy 'at' HH:mm", language, false);
  }
}

/**
 * Format เป็น ISO string (สำหรับส่งไปยัง API)
 * @param date - วันที่
 */
export function toISOString(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return dateObj.toISOString();
  } catch (error) {
    console.error('Error converting to ISO string:', error);
    return '';
  }
}

/**
 * แปลงปี ค.ศ. เป็น พ.ศ.
 * @param year - ปี ค.ศ.
 */
export function toBuddhistYear(year: number): number {
  return year + 543;
}

/**
 * แปลงปี พ.ศ. เป็น ค.ศ.
 * @param year - ปี พ.ศ.
 */
export function toChristianYear(year: number): number {
  return year - 543;
}

/**
 * ดึงปีปัจจุบัน
 * @param useBuddhistYear - ใช้ พ.ศ. หรือไม่
 */
export function getCurrentYear(useBuddhistYear: boolean = false): number {
  const now = toThailandTime(new Date());
  const year = now.getFullYear();
  return useBuddhistYear ? toBuddhistYear(year) : year;
}

/**
 * ดึงวันแรกของปี
 * @param year - ปี
 * @param isBuddhistYear - เป็นปี พ.ศ. หรือไม่
 */
export function getStartOfYear(year: number, isBuddhistYear: boolean = false): Date {
  const christianYear = isBuddhistYear ? toChristianYear(year) : year;
  return startOfYear(new Date(christianYear, 0, 1));
}

/**
 * ดึงวันสุดท้ายของปี
 * @param year - ปี
 * @param isBuddhistYear - เป็นปี พ.ศ. หรือไม่
 */
export function getEndOfYear(year: number, isBuddhistYear: boolean = false): Date {
  const christianYear = isBuddhistYear ? toChristianYear(year) : year;
  return endOfYear(new Date(christianYear, 11, 31));
}

/**
 * คำนวณจำนวนวันระหว่างสองวัน
 * @param startDate - วันเริ่มต้น
 * @param endDate - วันสิ้นสุด
 */
export function calculateDaysBetween(
  startDate: Date | string,
  endDate: Date | string
): number {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(start) || !isValid(end)) return 0;

    // Reset time to start of day for accurate calculation
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const diffTime = endDay.getTime() - startDay.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return Math.max(0, diffDays);
  } catch (error) {
    console.error('Error calculating days between:', error);
    return 0;
  }
}

/**
 * คำนวณจำนวนวันทำงานระหว่างสองวัน
 * @param startDate - วันเริ่มต้น
 * @param endDate - วันสิ้นสุด
 * @param workDaysPerWeek - จำนวนวันทำงานต่อสัปดาห์ (5, 6, หรือ 7)
 * @param weekendDays - วันที่เป็นวันหยุด (array of day numbers, 0=Sunday, 6=Saturday)
 */
export function calculateBusinessDays(
  startDate: Date | string,
  endDate: Date | string,
  workDaysPerWeek: number = 5,
  weekendDays: number[] = [0, 6]
): number {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(start) || !isValid(end)) return 0;
    if (start > end) return 0;

    if (workDaysPerWeek === 7) {
      return calculateDaysBetween(start, end);
    }

    let count = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDayObj = new Date(end);
    endDayObj.setHours(0, 0, 0, 0);

    while (current <= endDayObj) {
      const dayOfWeek = current.getDay();

      // Check if the current day is not a weekend day
      if (!weekendDays.includes(dayOfWeek)) {
        count++;
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  } catch (error) {
    console.error('Error calculating business days:', error);
    return 0;
  }
}

/**
 * คำนวณจำนวนวันทำงานโดยใช้การตั้งค่าจากบริษัท
 * @param startDate - วันเริ่มต้น
 * @param endDate - วันสิ้นสุด
 * @param settings - การตั้งค่าบริษัท
 */
export function calculateWorkingDaysFromSettings(
  startDate: Date | string,
  endDate: Date | string,
  settings?: { [key: string]: string }
): number {
  const workDaysPerWeek = parseInt(settings?.work_days_per_week || '5');
  const weekendDays = settings?.weekend_days
    ? settings.weekend_days.split(',').map(Number)
    : [0, 6]; // Default to Sunday and Saturday

  return calculateBusinessDays(startDate, endDate, workDaysPerWeek, weekendDays);
}

/**
 * ตรวจสอบว่าวันที่อยู่ในช่วงหรือไม่
 * @param date - วันที่ต้องการตรวจสอบ
 * @param startDate - วันเริ่มต้น
 * @param endDate - วันสิ้นสุด
 */
export function isDateInRange(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean {
  try {
    const checkDate = typeof date === 'string' ? parseISO(date) : date;
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(checkDate) || !isValid(start) || !isValid(end)) return false;

    const check = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    return check >= rangeStart && check <= rangeEnd;
  } catch (error) {
    console.error('Error checking date range:', error);
    return false;
  }
}

/**
 * Format ช่วงวันที่
 * @param startDate - วันเริ่มต้น
 * @param endDate - วันสิ้นสุด
 * @param language - ภาษา
 */
export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  language: string = 'th'
): string {
  const start = formatDateShort(startDate, language);
  const end = formatDateShort(endDate, language);

  if (!start || !end) return '';

  const separator = language === 'th' ? ' ถึง ' : ' to ';
  return `${start}${separator}${end}`;
}

/**
 * ตรวจสอบว่าเป็นวันหยุดสุดสัปดาห์หรือไม่
 * @param date - วันที่
 */
export function isWeekend(date: Date | string): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;

    const dayOfWeek = dateObj.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  } catch (error) {
    console.error('Error checking weekend:', error);
    return false;
  }
}

/**
 * ดึงชื่อวันในสัปดาห์
 * @param date - วันที่
 * @param language - ภาษา
 */
export function getDayName(
  date: Date | string,
  language: string = 'th'
): string {
  return formatDate(date, 'EEEE', language);
}

/**
 * ดึงชื่อเดือน
 * @param date - วันที่
 * @param language - ภาษา
 */
export function getMonthName(
  date: Date | string,
  language: string = 'th'
): string {
  return formatDate(date, 'MMMM', language);
}

/**
 * ดึงวันที่ปัจจุบัน (Thailand timezone)
 */
export function getToday(): Date {
  return toThailandTime(new Date());
}

/**
 * ตรวจสอบว่าเป็นวันนี้หรือไม่
 * @param date - วันที่
 */
export function isToday(date: Date | string): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;

    const today = getToday();
    return dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear();
  } catch (error) {
    console.error('Error checking today:', error);
    return false;
  }
}

/**
 * แปลงวันที่เป็นรูปแบบ YYYY-MM-DD ใน Thailand timezone
 * ใช้สำหรับเปรียบเทียบกับวันหยุดจากฐานข้อมูล
 *
 * @param date - วันที่ที่ต้องการแปลง (Date object, ISO string, หรือ YYYY-MM-DD string)
 * @returns วันที่ในรูปแบบ YYYY-MM-DD เช่น "2025-04-13"
 *
 * @example
 * normalizeHolidayDate(new Date('2025-04-12T17:00:00.000Z')) // "2025-04-13" (Bangkok time)
 * normalizeHolidayDate('2025-04-13') // "2025-04-13"
 * normalizeHolidayDate('2025-04-13T10:30:00') // "2025-04-13"
 */
export function normalizeHolidayDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    // If already in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // If has timestamp (contains 'T'), extract date part only
    if (typeof date === 'string' && date.includes('T')) {
      // This handles backend dates like "2025-04-13T00:00:00" or "2025-04-12T17:00:00.000Z"
      const datePart = date.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    }

    // Convert to Date object and format in Thailand timezone
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';

    // Convert to Thailand time
    const thaiDate = toThailandTime(dateObj);

    // Format as YYYY-MM-DD
    const year = thaiDate.getFullYear();
    const month = String(thaiDate.getMonth() + 1).padStart(2, '0');
    const day = String(thaiDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error normalizing holiday date:', error, date);
    return '';
  }
}

/**
 * เปรียบเทียบว่าวันที่ตรงกับวันหยุดหรือไม่
 *
 * @param date - วันที่ที่ต้องการเช็ค
 * @param holidayDate - วันหยุดจากฐานข้อมูล (YYYY-MM-DD หรือ ISO format)
 * @returns true ถ้าวันที่ตรงกัน
 *
 * @example
 * isHolidayDate(new Date('2025-04-13'), '2025-04-13') // true
 * isHolidayDate('2025-04-13', '2025-04-12T17:00:00.000Z') // true (same day in Bangkok time)
 */
export function isHolidayDate(date: Date | string, holidayDate: string): boolean {
  const normalizedDate = normalizeHolidayDate(date);
  const normalizedHoliday = normalizeHolidayDate(holidayDate);
  return normalizedDate === normalizedHoliday;
}

/**
 * คำนวณปีและเดือนของรอบบัญชีวันลา (Fiscal Month context)
 * 
 * รอบการตัด: วันที่ 26 ของเดือนก่อนหน้า ถึง วันที่ 25 ของเดือนปัจจุบัน
 * ตัวอย่าง:
 * - 25 ม.ค. 2026 -> รอบเดือน 1 ปี 2026 (อยู่ในช่วง 26 ธ.ค. 2025 - 25 ม.ค. 2026)
 * - 26 ม.ค. 2026 -> รอบเดือน 2 ปี 2026 (อยู่ในช่วง 26 ม.ค. 2026 - 25 ก.พ. 2026)
 * 
 * @param date - วันที่
 */
export function getFiscalMonthContext(date: Date | string): { year: number, month: number } {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const day = d.getDate();
  let month = d.getMonth() + 1; // 1-12
  let year = d.getFullYear();

  if (day >= 26) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return { year, month };
}

/**
 * ดึงช่วงวันที่ของรอบบัญชีวันลาสำหรับปีและเดือนที่ระบุ
 * 
 * @param year - ปี (เช่น 2026)
 * @param month - เดือน (1-12)
 */
export function getFiscalMonthRange(year: number, month: number): { startDate: string, endDate: string } {
  let prevMonth = month - 1;
  let prevYear = year;

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }

  const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
  const end = `${year}-${String(month).padStart(2, '0')}-25`;

  return { startDate: start, endDate: end };
}
