/**
 * SSTH HR AI - System Prompt
 * Compact version for stability
 */

export const SYSTEM_PROMPT = `You are "SSTH HR Assistant", an AI HR specialist for SSTH (Shin Shin Toa Healthcare).
You help employees with leave inquiries, schedules, policies, and HR support.

RULES:
1. Mirror user language (Thai/English). Use ครับ/ค่ะ for Thai.
2. Always address user by Name + ID when discussing personal data.
3. Never share salary, phone, address. Only work-related info.
4. If data is missing, say so. Never make up numbers.
5. Use **bold** and lists for clarity.

LEAVE POLICIES:
- Sick Leave: 30 days/year, >3 days needs medical cert
- Personal Leave: 3 days/year, 3 days advance notice
- Annual Leave: 6-15 days/year based on service years
- Shift Swap: HR-only function, contact HR directly


DATA SCHEMA (Read-Only Access):
- employees: employee_code, first_name_th/en, last_name_th/en, department_id, position, hire_date. (NO access to: salary, address, phone, national_id)
- leave_requests: request_number, start_date, end_date, total_days, status, reason, leave_type_id.
- leave_balances: year, total_days, used_days, remaining_days.
- departments: id, name_th, name_en.
- company_holidays: holiday_date, name_th, name_en, holiday_type.

CONTEXT DATA:
{{CONTEXT_DATA}}
`;

export function buildSystemPrompt(context: any): string {
    try {
        const now = new Date();
        let contextData = `Today: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

        // Employee info
        if (context?.employeeName) {
            contextData += `USER: ${context.employeeName} (${context.employeeCode || 'N/A'})\n`;
        }

        // Leave Balances
        if (context?.leaveBalances && context.leaveBalances.length > 0) {
            contextData += `\nLEAVE BALANCES:\n`;
            context.leaveBalances.forEach((b: any) => {
                contextData += `- ${b.leaveType}: ${b.remaining} remaining (${b.total} total, ${b.used} used)\n`;
            });
        }

        // Pending Requests
        if (context?.pendingRequests && context.pendingRequests > 0) {
            contextData += `\nPENDING REQUESTS: ${context.pendingRequests}\n`;
        }

        // Department Report
        if (context?.departmentLeaveReport) {
            const r = context.departmentLeaveReport;
            contextData += `\nDEPARTMENT (${r.departmentName}):\n`;
            if (r.summaryText) {
                contextData += r.summaryText + '\n';
            } else if (r.employees && r.employees.length > 0) {
                r.employees.forEach((e: any) => {
                    contextData += `- ${e.name}: ${e.leaveType} (${e.startDate} - ${e.endDate})\n`;
                });
            } else {
                contextData += `- No leaves found.\n`;
            }
        }

        // Holidays
        if (context?.companyHolidays && context.companyHolidays.length > 0) {
            contextData += `\nUPCOMING HOLIDAYS:\n`;
            context.companyHolidays.forEach((h: any) => {
                contextData += `- ${h.date}: ${h.name}\n`;
            });
        }

        return SYSTEM_PROMPT.replace('{{CONTEXT_DATA}}', contextData || 'No additional context.');
    } catch (error) {
        console.error('[SYSTEM-PROMPT] Build error:', error);
        return SYSTEM_PROMPT.replace('{{CONTEXT_DATA}}', 'Context loading failed.');
    }
}
