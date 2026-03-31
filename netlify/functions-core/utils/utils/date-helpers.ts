/**
 * Backend Date Utilities for Holiday Management
 *
 * These utilities ensure consistent date handling across all Netlify functions.
 * All dates are converted to Asia/Bangkok timezone before comparison.
 */

/**
 * SQL fragment to convert holiday_date to Asia/Bangkok timezone and format as YYYY-MM-DD
 * Use this in SELECT statements to ensure dates are returned in consistent format
 *
 * @example
 * const holidays = await query(`SELECT ${HOLIDAY_DATE_SELECT} FROM company_holidays`);
 */
export const HOLIDAY_DATE_SELECT = "TO_CHAR(holiday_date AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') as holiday_date";

/**
 * SQL fragment for WHERE clause to filter holidays by year in Asia/Bangkok timezone
 *
 * @example
 * const holidays = await query(`SELECT * FROM company_holidays WHERE ${holidayYearFilter('2025')}`);
 */
export function holidayYearFilter(year: string | number): string {
  return `EXTRACT(YEAR FROM holiday_date AT TIME ZONE 'Asia/Bangkok') = ${year}`;
}

/**
 * SQL fragment for WHERE clause to check if a date matches a holiday
 *
 * @param dateColumn - The column name to compare (e.g., 'start_date', 'work_date')
 * @returns SQL fragment for holiday matching
 *
 * @example
 * const query = `SELECT * FROM leave_requests WHERE ${isHolidaySQL('start_date')}`;
 */
export function isHolidaySQL(dateColumn: string): string {
  return `EXISTS (
    SELECT 1 FROM company_holidays
    WHERE TO_CHAR(holiday_date AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') =
          TO_CHAR(${dateColumn} AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD')
      AND is_active = true
  )`;
}

/**
 * Normalize a date string to YYYY-MM-DD format in Asia/Bangkok timezone
 * This matches the frontend normalizeHolidayDate() function
 *
 * @param date - Date object, ISO string, or YYYY-MM-DD string
 * @returns Date in YYYY-MM-DD format
 *
 * @example
 * normalizeHolidayDate(new Date('2025-04-12T17:00:00.000Z')) // "2025-04-13"
 * normalizeHolidayDate('2025-04-13') // "2025-04-13"
 */
export function normalizeHolidayDate(date: Date | string): string {
  if (!date) return '';

  try {
    // If already in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // If has timestamp, extract date part
    if (typeof date === 'string' && date.includes('T')) {
      const datePart = date.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    }

    // Convert to Date and format in Bangkok timezone
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Convert to Bangkok timezone
    const bangkokTime = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    const year = bangkokTime.getFullYear();
    const month = String(bangkokTime.getMonth() + 1).padStart(2, '0');
    const day = String(bangkokTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error normalizing holiday date:', error);
    return '';
  }
}

/**
 * Check if a date matches a holiday date
 *
 * @param date - Date to check
 * @param holidayDate - Holiday date from database
 * @returns true if dates match
 */
export function isHolidayDate(date: Date | string, holidayDate: string): boolean {
  const normalizedDate = normalizeHolidayDate(date);
  const normalizedHoliday = normalizeHolidayDate(holidayDate);
  return normalizedDate === normalizedHoliday;
}

/**
 * Standard SELECT fields for company_holidays table with timezone conversion
 * Use this to ensure consistent date formatting across all queries
 */
export const HOLIDAY_STANDARD_FIELDS = `
  id,
  TO_CHAR(holiday_date AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') as holiday_date,
  name_th,
  name_en,
  holiday_type,
  is_active,
  created_at,
  updated_at
`.trim();
