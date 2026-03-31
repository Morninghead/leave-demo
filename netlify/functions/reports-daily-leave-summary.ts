import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { getFiscalSettings, getFiscalYearStartDate } from './utils/fiscal-year';


/**
 * Daily Leave Summary Report API
 * 
 * Returns leave data grouped by date with employee details
 * Supports filtering by department, date range, and grouping (daily/weekly/monthly)
 */

interface LeaveEntryByDate {
    leave_date: string;
    leave_request_id: string; // Added
    request_number: string;   // Added - friendly ID
    employee_id: string;
    employee_code: string;
    employee_name_th: string;
    employee_name_en: string;
    department_id: string;
    department_name_th: string;
    department_name_en: string;
    leave_type_id: string;
    leave_type_code: string;
    leave_type_name_th: string;
    leave_type_name_en: string;
    request_total_days: number; // Renamed to match query alias
    is_hourly_leave: boolean;
    leave_minutes: number;
    status: string;
    start_date: string; // Added - from leave_requests
    end_date: string;   // Added - from leave_requests
}

const getDailyLeaveSummary = async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const params = event.queryStringParameters || {};
        const {
            department_id,
            start_date,
            end_date,
            group_by = 'daily', // 'daily', 'weekly', 'monthly'
        } = params;

        // Validate date range
        if (!start_date || !end_date) {
            return errorResponse('start_date and end_date are required', 400);
        }

        logger.log('📊 [DAILY_LEAVE_SUMMARY] Generating report:', {
            department_id,
            start_date,
            end_date,
            group_by,
        });

        // Load fiscal settings for dynamic calculations
        const fiscalSettings = await getFiscalSettings();
        const cycleStartDay = fiscalSettings.cycle_start_day;

        // Build query to get all approved/pending leave requests in the date range
        // AND exclude holidays/Sundays from the exploded dates
        let queryText = `
      WITH date_range AS (
        SELECT generate_series(
          $1::date,
          $2::date,
          '1 day'::interval
        )::date AS leave_date
      ),
      leave_entries AS (
        SELECT 
          dr.leave_date,
          lr.id as leave_request_id,
          lr.request_number,
          lr.start_date,
          lr.end_date,
          lr.employee_id,
          e.employee_code,
          CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name_th,
          CONCAT(e.first_name_en, ' ', e.last_name_en) as employee_name_en,
          d.id as department_id,
          d.name_th as department_name_th,
          d.name_en as department_name_en,
          lt.id as leave_type_id,
          lt.code as leave_type_code,
          lt.name_th as leave_type_name_th,
          lt.name_en as leave_type_name_en,
          lr.total_days as request_total_days,
          lr.is_hourly_leave,
          lr.leave_minutes,
          lr.is_half_day,
          lr.half_day_period,
          lr.status
        FROM date_range dr
        INNER JOIN leave_requests lr 
          ON dr.leave_date >= lr.start_date::date 
          AND dr.leave_date <= lr.end_date::date
          AND lr.status IN ('approved', 'pending')
        LEFT JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN company_holidays ch ON dr.leave_date = ch.holiday_date AND ch.is_active = true
        WHERE 1=1
          AND ch.id IS NULL
          AND EXTRACT(DOW FROM dr.leave_date) != 0 -- Exclude Sundays
    `;

        const queryParams: any[] = [start_date, end_date];
        let paramIndex = 3;

        // Filter by department if specified
        if (department_id) {
            queryText += ` AND d.id = $${paramIndex}`;
            queryParams.push(department_id);
            paramIndex++;
        }

        queryText += `
      )
      SELECT * FROM leave_entries
      ORDER BY leave_date ASC, department_name_en ASC, employee_name_en ASC
    `;

        const leaveEntries = await query(queryText, queryParams);

        logger.log(`📊 [DAILY_LEAVE_SUMMARY] Found ${leaveEntries.length} leave entries`);

        // Group data based on group_by parameter
        let groupedData: any[] = [];

        if (group_by === 'daily') {
            // Group by date
            const dateMap = new Map<string, any>();

            leaveEntries.forEach((entry: LeaveEntryByDate) => {
                const dateKey = entry.leave_date; // Assuming YYYY-MM-DD from Postgres

                // Format date string to ensure consistency
                const dateObj = new Date(dateKey);
                const formattedDateKey = dateObj.toISOString().split('T')[0];


                if (!dateMap.has(formattedDateKey)) {
                    dateMap.set(formattedDateKey, {
                        date: formattedDateKey,
                        total_employees: 0,
                        by_leave_type: {} as Record<string, any>,
                        employees: [] as any[],
                    });
                }

                const dateGroup = dateMap.get(formattedDateKey);

                // Count by leave type
                const leaveTypeKey = entry.leave_type_code;
                if (!dateGroup.by_leave_type[leaveTypeKey]) {
                    dateGroup.by_leave_type[leaveTypeKey] = {
                        leave_type_code: entry.leave_type_code,
                        leave_type_name_th: entry.leave_type_name_th,
                        leave_type_name_en: entry.leave_type_name_en,
                        count: 0,
                        employees: [],
                    };
                }

                // Add employee to the list
                const employeeEntry = {
                    leave_request_id: entry.leave_request_id,
                    request_number: entry.request_number,
                    employee_id: entry.employee_id,
                    employee_code: entry.employee_code,
                    employee_name_th: entry.employee_name_th,
                    employee_name_en: entry.employee_name_en,
                    department_name_th: entry.department_name_th,
                    department_name_en: entry.department_name_en,
                    leave_type_code: entry.leave_type_code,
                    leave_type_name_th: entry.leave_type_name_th,
                    leave_type_name_en: entry.leave_type_name_en,
                    is_hourly_leave: entry.is_hourly_leave,
                    leave_minutes: entry.leave_minutes,
                    total_days: entry.request_total_days, // Fixed: Use request_total_days
                    status: entry.status,
                    start_date: entry.start_date,
                    end_date: entry.end_date
                };

                dateGroup.by_leave_type[leaveTypeKey].employees.push(employeeEntry);
                dateGroup.by_leave_type[leaveTypeKey].count++;
                dateGroup.employees.push(employeeEntry);
                dateGroup.total_employees++;
            });

            // Convert map to array and sort by date
            groupedData = Array.from(dateMap.values())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(group => ({
                    ...group,
                    by_leave_type: Object.values(group.by_leave_type),
                }));

        } else if (group_by === 'weekly') {
            // Group by week
            const weekMap = new Map<string, any>();

            // Pre-process: Group entries by Request ID within each Week
            // We need to iterate entries, determine week, then group by request

            leaveEntries.forEach((entry: any) => { // Use 'any' to access leave_request_id
                // Robust date parsing (handle String or Date object from DB)
                let y: number, m: number, d: number;
                if (entry.leave_date instanceof Date) {
                    y = entry.leave_date.getFullYear();
                    m = entry.leave_date.getMonth(); // 0-11
                    d = entry.leave_date.getDate();
                } else {
                    // Assume string YYYY-MM-DD or ISO
                    const dateObj = new Date(entry.leave_date);
                    y = dateObj.getFullYear();
                    m = dateObj.getMonth();
                    d = dateObj.getDate();
                }

                // Construct UTC date for calculation to avoid timezone shifts
                const date = new Date(Date.UTC(y, m, d));

                // Fiscal logic (Dynamic)
                let fiscalYear = date.getUTCFullYear();
                if (fiscalSettings.cycle_type === 'day_of_month') {
                    // Use cycleStartDay for fiscal boundary
                    const testMonth = date.getUTCMonth();
                    const testDay = date.getUTCDate();
                    // If it's Dec and day >= cycleStartDay, it's next fiscal year
                    if (testMonth === 11 && testDay >= cycleStartDay) {
                        fiscalYear = fiscalYear + 1;
                    }
                } else if (fiscalSettings.cycle_type === 'thai_government') {
                    // Thai government: Oct 1 - Sep 30
                    if (date.getUTCMonth() >= 9) { // Oct, Nov, Dec
                        fiscalYear = fiscalYear + 1;
                    }
                }
                // For 'calendar' cycle, it's calendar year

                // Fiscal start using utility function
                const fiscalStart = getFiscalYearStartDate(fiscalYear, fiscalSettings);

                // Time difference in milliseconds
                const diffTime = date.getTime() - fiscalStart.getTime();
                // Difference in days (floor)
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // Week number (1-based)
                let weekNum = Math.floor(diffDays / 7) + 1;

                // Wrap Week 53+ into Week 52
                if (weekNum > 52) {
                    weekNum = 52;
                }

                const weekKey = `${fiscalYear}-W${weekNum.toString().padStart(2, '0')}`;

                if (!weekMap.has(weekKey)) {
                    // Calculate week start and end dates
                    const weekStart = new Date(fiscalStart);
                    weekStart.setUTCDate(fiscalStart.getUTCDate() + (weekNum - 1) * 7);

                    let weekEnd = new Date(weekStart);
                    if (weekNum === 52) {
                        // Week 52 extends to the end of the fiscal year (Dec 25)
                        weekEnd = new Date(Date.UTC(fiscalYear, 11, 25));
                    } else {
                        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
                    }

                    weekMap.set(weekKey, {
                        week: weekKey,
                        week_start: weekStart.toISOString().split('T')[0],
                        week_end: weekEnd.toISOString().split('T')[0],
                        total_leave_instances: 0,
                        unique_employees: new Set(),
                        by_leave_type: {} as Record<string, any>,
                        requests: new Map<string, any>() // Map<RequestId, Entry>
                    });
                }

                const weekGroup = weekMap.get(weekKey);
                const requestId = entry.leave_request_id;

                if (!weekGroup.requests.has(requestId)) {
                    // Create new request entry
                    weekGroup.requests.set(requestId, {
                        leave_request_id: requestId, // Added
                        request_number: entry.request_number,
                        employee_id: entry.employee_id,
                        employee_code: entry.employee_code,
                        employee_name_th: entry.employee_name_th,
                        employee_name_en: entry.employee_name_en,
                        department_name_th: entry.department_name_th,
                        department_name_en: entry.department_name_en,
                        leave_type_code: entry.leave_type_code,
                        leave_type_name_th: entry.leave_type_name_th,
                        leave_type_name_en: entry.leave_type_name_en,
                        is_hourly_leave: entry.is_hourly_leave,
                        leave_minutes: entry.leave_minutes,
                        total_days: entry.request_total_days, // Use original request total
                        status: entry.status,
                        dates: [] as string[],
                        start_date: entry.start_date, // Added
                        end_date: entry.end_date      // Added
                    });
                    // Update counts only once per request
                    weekGroup.total_leave_instances++;
                    weekGroup.unique_employees.add(entry.employee_id);

                    const leaveTypeKey = entry.leave_type_code;
                    if (!weekGroup.by_leave_type[leaveTypeKey]) {
                        weekGroup.by_leave_type[leaveTypeKey] = {
                            leave_type_code: entry.leave_type_code,
                            leave_type_name_th: entry.leave_type_name_th,
                            leave_type_name_en: entry.leave_type_name_en,
                            count: 0,
                            employees: [],
                        };
                    }
                    weekGroup.by_leave_type[leaveTypeKey].count++;
                }

                weekGroup.requests.get(requestId).dates.push(entry.leave_date);
            });

            // Transform Requests Map to Employees Array
            groupedData = Array.from(weekMap.values())
                .sort((a, b) => a.week.localeCompare(b.week))
                .map(group => {
                    const employeesList: any[] = [];
                    group.requests.forEach((req: any) => {
                        const empEntry = {
                            ...req,
                            leave_date: req.dates[0],
                            leave_dates: req.dates,
                            dates: undefined // Clean up
                        };
                        employeesList.push(empEntry);

                        // Add to by_leave_type list
                        group.by_leave_type[req.leave_type_code].employees.push(empEntry);
                    });

                    return {
                        ...group,
                        unique_employee_count: group.unique_employees.size,
                        unique_employees: undefined, // Remove Set
                        requests: undefined, // Remove Map
                        employees: employeesList,
                        by_leave_type: Object.values(group.by_leave_type),
                    };
                });


        } else if (group_by === 'monthly') {
            // Group by month
            const monthMap = new Map<string, any>();

            leaveEntries.forEach((entry: any) => {
                const date = new Date(entry.leave_date);

                // Fiscal Month Logic (Dynamic):
                const day = date.getDate();
                let month = date.getMonth() + 1;
                let year = date.getFullYear();

                if (fiscalSettings.cycle_type === 'day_of_month' && day >= cycleStartDay) {
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                }

                const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

                if (!monthMap.has(monthKey)) {
                    monthMap.set(monthKey, {
                        month: monthKey,
                        year: date.getFullYear(),
                        month_number: date.getMonth() + 1,
                        total_leave_instances: 0,
                        unique_employees: new Set(),
                        by_leave_type: {} as Record<string, any>,
                        requests: new Map<string, any>()
                    });
                }

                const monthGroup = monthMap.get(monthKey);
                const requestId = entry.leave_request_id; // Using request ID as key

                if (!monthGroup.requests.has(requestId)) {
                    // Create new request entry
                    monthGroup.requests.set(requestId, {
                        leave_request_id: requestId, // Added
                        request_number: entry.request_number,
                        employee_id: entry.employee_id,
                        employee_code: entry.employee_code,
                        employee_name_th: entry.employee_name_th,
                        employee_name_en: entry.employee_name_en,
                        department_name_th: entry.department_name_th,
                        department_name_en: entry.department_name_en,
                        leave_type_code: entry.leave_type_code,
                        leave_type_name_th: entry.leave_type_name_th,
                        leave_type_name_en: entry.leave_type_name_en,
                        is_hourly_leave: entry.is_hourly_leave,
                        leave_minutes: entry.leave_minutes,
                        total_days: entry.request_total_days,
                        status: entry.status,
                        dates: [] as string[],
                        start_date: entry.start_date, // Added
                        end_date: entry.end_date      // Added
                    });
                    // Update counts
                    monthGroup.total_leave_instances++;
                    monthGroup.unique_employees.add(entry.employee_id);

                    const leaveTypeKey = entry.leave_type_code;
                    if (!monthGroup.by_leave_type[leaveTypeKey]) {
                        monthGroup.by_leave_type[leaveTypeKey] = {
                            leave_type_code: entry.leave_type_code,
                            leave_type_name_th: entry.leave_type_name_th,
                            leave_type_name_en: entry.leave_type_name_en,
                            count: 0,
                            employees: [],
                        };
                    }
                    monthGroup.by_leave_type[leaveTypeKey].count++;
                }

                monthGroup.requests.get(requestId).dates.push(entry.leave_date);
            });

            // Convert map to array
            groupedData = Array.from(monthMap.values())
                .sort((a, b) => a.month.localeCompare(b.month))
                .map(group => {
                    const employeesList: any[] = [];
                    group.requests.forEach((req: any) => {
                        const empEntry = {
                            ...req,
                            leave_date: req.dates[0],
                            leave_dates: req.dates,
                            dates: undefined
                        };
                        employeesList.push(empEntry);

                        group.by_leave_type[req.leave_type_code].employees.push(empEntry);
                    });

                    return {
                        ...group,
                        unique_employee_count: group.unique_employees.size,
                        unique_employees: undefined,
                        requests: undefined,
                        employees: employeesList,
                        by_leave_type: Object.values(group.by_leave_type),
                    };
                });
        }

        // Calculate overall summary
        const uniqueEmployees = new Set(leaveEntries.map((e: any) => e.employee_id));
        const leaveTypeSummary: Record<string, any> = {};

        // Recalculate summary from grouped requests to match displayed count?
        // Actually, leaveEntries is still "all exploded days".
        // If we want summary to show "Number of Requests", we should count unique Request IDs.

        const uniqueRequests = new Set(leaveEntries.map((e: any) => e.leave_request_id));
        const leaveTypeRequestCount: Record<string, Set<string>> = {}; // code -> Set<RequestId>

        leaveEntries.forEach((entry: any) => {
            const key = entry.leave_type_code;
            if (!leaveTypeRequestCount[key]) {
                leaveTypeRequestCount[key] = new Set();
            }
            leaveTypeRequestCount[key].add(entry.leave_request_id);
        });

        const leaveTypeSummaryValues = Object.keys(leaveTypeRequestCount).map(key => ({
            leave_type_code: key,
            // Find name from entries
            leave_type_name_th: leaveEntries.find((e: any) => e.leave_type_code === key)?.leave_type_name_th || key,
            leave_type_name_en: leaveEntries.find((e: any) => e.leave_type_code === key)?.leave_type_name_en || key,
            total_instances: leaveTypeRequestCount[key].size
        }));

        return successResponse({
            report_type: 'daily_leave_summary',
            group_by,
            date_range: {
                start: start_date,
                end: end_date,
            },
            department_id: department_id || null,
            summary: {
                // Return total REQUESTS, not total DAYS/Entries
                total_leave_instances: uniqueRequests.size,
                unique_employees: uniqueEmployees.size,
                by_leave_type: leaveTypeSummaryValues,
                periods_count: groupedData.length,
            },
            data: groupedData,
        });

    } catch (error: any) {
        logger.error('❌ [DAILY_LEAVE_SUMMARY] Error:', error);
        return errorResponse(error.message || 'Failed to generate daily leave summary', 500);
    }
};

export const handler: Handler = requireAuth(getDailyLeaveSummary);
