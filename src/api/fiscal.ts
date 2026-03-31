// src/api/fiscal.ts
// Frontend API for fiscal settings

import api from './auth';

export interface FiscalSettings {
    id: string | null;
    cycle_start_day: number;
    cycle_type: 'day_of_month' | 'calendar' | 'thai_government';
    fiscal_year_start_month: number;
    filter_pending_by_year: boolean;
    description_th: string;
    description_en: string;
    updated_at: string | null;
    updated_by: string | null;
    updated_by_name_th?: string;
    updated_by_name_en?: string;
}

export interface FiscalSettingsResponse {
    settings: FiscalSettings;
    is_default: boolean;
}

/**
 * Get current fiscal settings
 */
export async function getFiscalSettings(): Promise<FiscalSettingsResponse> {
    const response = await api.get('/fiscal-settings');
    return response.data;
}

/**
 * Update fiscal settings (HR/Admin only)
 */
export async function updateFiscalSettings(settings: Partial<FiscalSettings>): Promise<FiscalSettings> {
    const response = await api.put('/fiscal-settings', settings);
    return response.data.settings;
}

/**
 * Calculate the current fiscal year based on settings
 */
export function calculateFiscalYear(date: Date, settings: FiscalSettings): number {
    const calendarYear = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    switch (settings.cycle_type) {
        case 'calendar':
            return calendarYear;

        case 'thai_government':
            const fiscalStartMonth = settings.fiscal_year_start_month - 1;
            if (month >= fiscalStartMonth) {
                return calendarYear + 1;
            }
            return calendarYear;

        case 'day_of_month':
        default:
            if (month === 11 && day >= settings.cycle_start_day) {
                return calendarYear + 1;
            }
            return calendarYear;
    }
}

/**
 * Get fiscal year date range
 */
export function getFiscalYearDateRange(
    fiscalYear: number,
    settings: FiscalSettings
): { start: Date; end: Date } {
    switch (settings.cycle_type) {
        case 'calendar':
            return {
                start: new Date(fiscalYear, 0, 1),
                end: new Date(fiscalYear, 11, 31),
            };

        case 'thai_government':
            const startMonth = settings.fiscal_year_start_month - 1;
            const endMonth = startMonth - 1 < 0 ? 11 : startMonth - 1;
            const endYear = endMonth === 11 ? fiscalYear - 1 : fiscalYear;
            const lastDay = new Date(endYear, endMonth + 1, 0).getDate();
            return {
                start: new Date(fiscalYear - 1, startMonth, 1),
                end: new Date(endYear, endMonth, lastDay),
            };

        case 'day_of_month':
        default:
            return {
                start: new Date(fiscalYear - 1, 11, settings.cycle_start_day),
                end: new Date(fiscalYear, 11, settings.cycle_start_day - 1),
            };
    }
}

/**
 * Get fiscal month date range
 * Returns start and end dates for a specific fiscal month
 */
export function getFiscalMonthDateRange(
    year: number,
    month: number, // 1-12
    settings: FiscalSettings
): { start: Date; end: Date } {
    switch (settings.cycle_type) {
        case 'calendar':
            // Calendar: 1st to last day of month
            const lastDay = new Date(year, month, 0).getDate();
            return {
                start: new Date(year, month - 1, 1),
                end: new Date(year, month - 1, lastDay),
            };

        case 'thai_government':
            // Thai Gov: Also uses calendar months but fiscal year starts Oct
            const govLastDay = new Date(year, month, 0).getDate();
            return {
                start: new Date(year, month - 1, 1),
                end: new Date(year, month - 1, govLastDay),
            };

        case 'day_of_month':
        default:
            // Day of month cycle (e.g., 26th prev month to 25th current month)
            const cycleDay = settings.cycle_start_day;
            let prevMonth = month - 1;
            let prevYear = year;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear = year - 1;
            }
            return {
                start: new Date(prevYear, prevMonth - 1, cycleDay),
                end: new Date(year, month - 1, cycleDay - 1),
            };
    }
}

/**
 * Format fiscal year display
 */
export function formatFiscalYearDisplay(
    fiscalYear: number,
    settings: FiscalSettings,
    language: string = 'th'
): string {
    const { start, end } = getFiscalYearDateRange(fiscalYear, settings);

    const formatDate = (d: Date) => {
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        return d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', options);
    };

    const yearDisplay = language === 'th' ? fiscalYear + 543 : fiscalYear;
    return `${language === 'th' ? 'ปี' : 'FY'} ${yearDisplay} (${formatDate(start)} - ${formatDate(end)})`;
}

/**
 * Get cycle type display name
 */
export function getCycleTypeDisplay(cycleType: string, language: string = 'th'): string {
    const displays: Record<string, { th: string; en: string }> = {
        'day_of_month': {
            th: 'รอบการทำงาน (วันที่กำหนด)',
            en: 'Payroll Cycle (Day of Month)',
        },
        'calendar': {
            th: 'ปีปฏิทิน (1 ม.ค. - 31 ธ.ค.)',
            en: 'Calendar Year (Jan 1 - Dec 31)',
        },
        'thai_government': {
            th: 'ปีงบประมาณราชการ (1 ต.ค. - 30 ก.ย.)',
            en: 'Thai Government Fiscal Year (Oct 1 - Sep 30)',
        },
    };

    return displays[cycleType]?.[language as 'th' | 'en'] || cycleType;
}
