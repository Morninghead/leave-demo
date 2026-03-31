// netlify/functions/utils/fiscal-year.ts
// Dynamic Fiscal year utility for SSTH Leave Management System
// 
// Supports multiple fiscal cycle types:
// 1. 'day_of_month' - Payroll cycle (e.g., 26th - 25th)
// 2. 'calendar' - Calendar year (Jan 1 - Dec 31)
// 3. 'thai_government' - Thai Government fiscal year (Oct 1 - Sep 30)
//
// Settings are loaded from database (fiscal_settings table) with caching

import { query } from './db';

// ====================
// Types
// ====================

export interface FiscalSettings {
    cycle_start_day: number;
    cycle_type: 'day_of_month' | 'calendar' | 'thai_government';
    fiscal_year_start_month: number;
    filter_pending_by_year: boolean;
}

// Default settings (hardcoded fallback)
const DEFAULT_SETTINGS: FiscalSettings = {
    cycle_start_day: 26,
    cycle_type: 'day_of_month',
    fiscal_year_start_month: 10,
    filter_pending_by_year: false,
};

// ====================
// Cache Implementation
// ====================

let cachedSettings: FiscalSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Get fiscal settings from database with caching
 */
export async function getFiscalSettings(): Promise<FiscalSettings> {
    const now = Date.now();

    // Return cached settings if still valid
    if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedSettings;
    }

    try {
        const result = await query(`
      SELECT cycle_start_day, cycle_type, fiscal_year_start_month, filter_pending_by_year
      FROM fiscal_settings
      ORDER BY updated_at DESC
      LIMIT 1
    `);

        if (result.length > 0) {
            cachedSettings = {
                cycle_start_day: result[0].cycle_start_day,
                cycle_type: result[0].cycle_type,
                fiscal_year_start_month: result[0].fiscal_year_start_month,
                filter_pending_by_year: result[0].filter_pending_by_year,
            };
            cacheTimestamp = now;
            return cachedSettings;
        }
    } catch (error) {
        console.error('⚠️ Failed to load fiscal settings, using defaults:', error);
    }

    // Return defaults if DB query fails
    return DEFAULT_SETTINGS;
}

/**
 * Clear the cached settings (call after updating settings)
 */
export function clearFiscalSettingsCache(): void {
    cachedSettings = null;
    cacheTimestamp = 0;
}

/**
 * Get fiscal settings synchronously (uses cached value or defaults)
 * Use this when you can't await (e.g., in synchronous contexts)
 */
export function getFiscalSettingsSync(): FiscalSettings {
    return cachedSettings || DEFAULT_SETTINGS;
}

// ====================
// Core Functions
// ====================

/**
 * Get the fiscal year for a given date based on settings
 * 
 * @param date - The date to check (defaults to current date)
 * @param settings - Fiscal settings (optional, uses cached/default if not provided)
 * @returns The fiscal year number
 */
export function getFiscalYear(date: Date = new Date(), settings?: FiscalSettings): number {
    const s = settings || getFiscalSettingsSync();
    const calendarYear = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const day = date.getDate();

    switch (s.cycle_type) {
        case 'calendar':
            // Calendar year: Jan 1 - Dec 31
            return calendarYear;

        case 'thai_government':
            // Thai Government: Oct 1 - Sep 30
            // If month >= fiscal_year_start_month (Oct = 10), it's the next fiscal year
            const fiscalStartMonth = s.fiscal_year_start_month - 1; // Convert to 0-indexed
            if (month >= fiscalStartMonth) {
                return calendarYear + 1;
            }
            return calendarYear;

        case 'day_of_month':
        default:
            // Day-of-month cycle: e.g., 26th - 25th
            // Fiscal year starts on Dec (cycle_start_day) and ends on Dec (cycle_start_day - 1)
            // If date is in December and day >= cycle_start_day, it's the next fiscal year
            const cycleStartDay = s.cycle_start_day;
            if (month === 11 && day >= cycleStartDay) {
                // December 26-31 → Next fiscal year
                return calendarYear + 1;
            }
            return calendarYear;
    }
}

/**
 * Get the start date of a fiscal year
 * 
 * @param fiscalYear - The fiscal year (e.g., 2026)
 * @param settings - Fiscal settings (optional)
 * @returns Date object for the first day of the fiscal year
 */
export function getFiscalYearStartDate(fiscalYear: number, settings?: FiscalSettings): Date {
    const s = settings || getFiscalSettingsSync();

    switch (s.cycle_type) {
        case 'calendar':
            // Jan 1 of the fiscal year
            return new Date(fiscalYear, 0, 1);

        case 'thai_government':
            // Oct 1 of the previous calendar year (for fiscal year N, starts Oct 1 of N-1)
            const startMonth = s.fiscal_year_start_month - 1; // 0-indexed
            return new Date(fiscalYear - 1, startMonth, 1);

        case 'day_of_month':
        default:
            // Dec (cycle_start_day) of the previous calendar year
            // E.g., Fiscal 2026 starts Dec 26, 2025
            return new Date(fiscalYear - 1, 11, s.cycle_start_day);
    }
}

/**
 * Get the end date of a fiscal year
 * 
 * @param fiscalYear - The fiscal year (e.g., 2026)
 * @param settings - Fiscal settings (optional)
 * @returns Date object for the last day of the fiscal year
 */
export function getFiscalYearEndDate(fiscalYear: number, settings?: FiscalSettings): Date {
    const s = settings || getFiscalSettingsSync();

    switch (s.cycle_type) {
        case 'calendar':
            // Dec 31 of the fiscal year
            return new Date(fiscalYear, 11, 31);

        case 'thai_government':
            // Sep 30 of the fiscal year
            const endMonth = s.fiscal_year_start_month - 2; // Month before start month, 0-indexed
            const endMonthAdjusted = endMonth < 0 ? 11 : endMonth;
            const endYear = endMonth < 0 ? fiscalYear - 1 : fiscalYear;
            // Get last day of the end month
            const lastDay = new Date(endYear, endMonthAdjusted + 1, 0).getDate();
            return new Date(endYear, endMonthAdjusted, lastDay);

        case 'day_of_month':
        default:
            // Dec (cycle_start_day - 1) of the fiscal year
            // E.g., Fiscal 2026 ends Dec 25, 2026
            return new Date(fiscalYear, 11, s.cycle_start_day - 1);
    }
}

/**
 * Get the fiscal year date range as ISO strings (for SQL queries)
 * 
 * @param fiscalYear - The fiscal year (e.g., 2026)
 * @param settings - Fiscal settings (optional)
 * @returns Object with start and end dates as ISO strings
 */
export function getFiscalYearDateRange(fiscalYear: number, settings?: FiscalSettings): { start: string; end: string } {
    const startDate = getFiscalYearStartDate(fiscalYear, settings);
    const endDate = getFiscalYearEndDate(fiscalYear, settings);

    // Format as YYYY-MM-DD for SQL
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return {
        start: formatDate(startDate),
        end: formatDate(endDate),
    };
}

/**
 * Get the fiscal month period for a given date
 * Fiscal month starts on cycle_start_day and ends on cycle_start_day - 1
 * 
 * @param date - The date to check
 * @param settings - Fiscal settings (optional)
 * @returns Object with period start/end dates and the "salary month" name
 */
export function getFiscalMonthPeriod(date: Date = new Date(), settings?: FiscalSettings): {
    start: Date;
    end: Date;
    salaryMonth: number;
    salaryYear: number;
} {
    const s = settings || getFiscalSettingsSync();
    const cycleStartDay = s.cycle_start_day;

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    if (day >= cycleStartDay) {
        // cycle_start_day to end of month → belongs to NEXT month's salary
        const nextMonth = month + 1;
        const salaryMonth = nextMonth > 11 ? 0 : nextMonth;
        const salaryYear = nextMonth > 11 ? year + 1 : year;

        return {
            start: new Date(year, month, cycleStartDay),
            end: new Date(salaryYear, salaryMonth, cycleStartDay - 1),
            salaryMonth: salaryMonth + 1, // 1-12 format
            salaryYear,
        };
    } else {
        // 1st to cycle_start_day-1 → belongs to CURRENT month's salary
        const prevMonth = month - 1;
        const startYear = prevMonth < 0 ? year - 1 : year;
        const startMonth = prevMonth < 0 ? 11 : prevMonth;

        return {
            start: new Date(startYear, startMonth, cycleStartDay),
            end: new Date(year, month, cycleStartDay - 1),
            salaryMonth: month + 1, // 1-12 format
            salaryYear: year,
        };
    }
}

/**
 * Check if a date falls within a specific fiscal year
 * 
 * @param date - The date to check
 * @param fiscalYear - The fiscal year to check against
 * @param settings - Fiscal settings (optional)
 * @returns true if date is within the fiscal year
 */
export function isDateInFiscalYear(date: Date, fiscalYear: number, settings?: FiscalSettings): boolean {
    const startDate = getFiscalYearStartDate(fiscalYear, settings);
    const endDate = getFiscalYearEndDate(fiscalYear, settings);

    // Set time to start and end of day for accurate comparison
    const start = new Date(startDate.setHours(0, 0, 0, 0));
    const end = new Date(endDate.setHours(23, 59, 59, 999));

    return date >= start && date <= end;
}

/**
 * Async version of getFiscalYear that loads settings from DB
 * Use this in API handlers where you can await
 */
export async function getFiscalYearAsync(date: Date = new Date()): Promise<number> {
    const settings = await getFiscalSettings();
    return getFiscalYear(date, settings);
}

/**
 * Async version of getFiscalYearDateRange that loads settings from DB
 * Use this in API handlers where you can await
 */
export async function getFiscalYearDateRangeAsync(fiscalYear: number): Promise<{ start: string; end: string }> {
    const settings = await getFiscalSettings();
    return getFiscalYearDateRange(fiscalYear, settings);
}

/**
 * Helper: Get current fiscal year with async settings loading
 */
export async function getCurrentFiscalYear(): Promise<number> {
    return getFiscalYearAsync(new Date());
}

/**
 * Helper: Get current fiscal year date range with async settings loading
 */
export async function getCurrentFiscalYearDateRange(): Promise<{ start: string; end: string }> {
    const currentYear = await getCurrentFiscalYear();
    return getFiscalYearDateRangeAsync(currentYear);
}

// Export sync version for backward compatibility (uses defaults/cache)
export const currentFiscalYear = getFiscalYear(new Date());
