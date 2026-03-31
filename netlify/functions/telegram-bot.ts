/**
 * Telegram AI Bot Webhook
 * 
 * Receives messages from Telegram and responds using Gemini AI
 * Users can ask about leave by providing employee name
 * 
 * Example queries:
 * - "ยอดลาของ สมชาย ใจดี"
 * - "สมหญิง มีวันลาเหลือกี่วัน"
 * - "นโยบายลาป่วย"
 */

import { Handler } from '@netlify/functions';
import { successResponse } from './utils/response';
import { logger } from './utils/logger';
import { query } from './utils/db';
import { generateChatResponse, detectLanguage, ChatContext } from './utils/gemini-client';
import { getTelegramConfig } from './utils/channel-config-helper';

interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        text?: string;
        date: number;
    };
}

/**
 * Send message back to Telegram
 */
async function sendTelegramReply(chatId: number, text: string): Promise<boolean> {
    const config = await getTelegramConfig();

    if (!config.botToken) {
        logger.error('[TELEGRAM-BOT] Bot token not configured');
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json() as any;
        if (!data.ok) {
            logger.error('[TELEGRAM-BOT] Send error:', data.description);
            return false;
        }
        return true;
    } catch (error: any) {
        logger.error('[TELEGRAM-BOT] Send failed:', error.message);
        return false;
    }
}

/**
 * Try to find employee by name in message
 */
async function findEmployeeByName(message: string): Promise<any | null> {
    // Common patterns for Thai names
    // "ยอดลาของ สมชาย ใจดี" -> extract "สมชาย ใจดี"
    // "สมชาย มีวันลาเหลือเท่าไหร่" -> extract "สมชาย"

    // Try to find employee by searching first/last name or code
    try {
        // 1. Priority: Look for Employee Code pattern (numbers, 5+ digits)
        const codeMatch = message.match(/\b\d{5,}\b/);
        if (codeMatch) {
            const code = codeMatch[0];
            const codeResult = await query(`
                SELECT 
                    e.id,
                    e.employee_code,
                    e.first_name_th,
                    e.last_name_th,
                    e.first_name_en,
                    e.last_name_en,
                    d.name_th as department_name_th,
                    d.name_en as department_name_en
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.status = 'active'
                AND e.employee_code = $1
                LIMIT 1
            `, [code]);

            if (codeResult.length > 0) return codeResult[0];
        }

        // 2. Try extracting potential names (words > 2 chars, not numbers)
        const words = message.split(/\s+/).filter(w => w.length > 2 && isNaN(Number(w)));

        for (const word of words) {
            // Skip common stopwords if needed
            if (['what', 'when', 'where', 'leave', 'remaining', 'want', 'check'].includes(word.toLowerCase())) continue;

            const subResult = await query(`
                SELECT 
                    e.id,
                    e.employee_code,
                    e.first_name_th,
                    e.last_name_th,
                    e.first_name_en,
                    e.last_name_en,
                    d.name_th as department_name_th,
                    d.name_en as department_name_en
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.status = 'active'
                AND (
                    e.first_name_th ILIKE $1
                    OR e.first_name_en ILIKE $1
                    OR e.last_name_th ILIKE $1
                    OR e.last_name_en ILIKE $1
                )
                LIMIT 1
            `, [`%${word}%`]);

            if (subResult.length > 0) {
                return subResult[0];
            }
        }

        return null;
    } catch (error) {
        logger.error('[TELEGRAM-BOT] Employee search error:', error);
        return null;
    }
}

/**
 * Get leave balances for employee
 */
async function getEmployeeLeaveBalances(employeeId: string): Promise<any[]> {
    try {
        // Use logic similar to dashboard-stats.ts
        // Calculate days from minutes (480 mins = 8 hours = 1 day)
        // Use most recent year available for the employee
        const result = await query(`
            SELECT DISTINCT ON (lt.id)
                lt.name_th as leave_type_th,
                lt.name_en as leave_type_en,
                ROUND(COALESCE(lb.accumulated_minutes, 0) / 480.0, 2) as total_days,
                COALESCE(lb.used_days, 0) as used_days,
                (ROUND(COALESCE(lb.accumulated_minutes, 0) / 480.0, 2) - COALESCE(lb.used_days, 0)) as remaining_days
            FROM leave_balances lb
            JOIN leave_types lt ON lb.leave_type_id = lt.id
            WHERE lb.employee_id = $1
            ORDER BY lt.id, lb.year DESC
        `, [employeeId]);
        return result;
    } catch (error) {
        logger.error('[TELEGRAM-BOT] Balance fetch error:', error);
        return [];
    }
}

/**
 * Get AI Bot settings from database
 */
async function getAIBotSettings(): Promise<{ testChatId: string; productionEnabled: boolean }> {
    try {
        const result = await query(`
            SELECT 
                COALESCE((SELECT setting_value FROM company_settings WHERE setting_key = 'ai_bot_test_chat_id'), '') as test_chat_id,
                COALESCE((SELECT setting_value FROM company_settings WHERE setting_key = 'ai_bot_production_enabled'), 'false') as production_enabled
        `);
        return {
            testChatId: result[0]?.test_chat_id || '',
            productionEnabled: result[0]?.production_enabled === 'true',
        };
    } catch (error) {
        logger.error('[TELEGRAM-BOT] Failed to get settings:', error);
        return { testChatId: '', productionEnabled: false };
    }
}

/**
 * Get leave report for a department
 */
async function getDepartmentLeaveReportByName(searchText: string): Promise<any | null> {
    try {
        // Find department first
        const departments = await query(`
            SELECT id, name_th, name_en FROM departments
            WHERE name_th ILIKE $1 OR name_en ILIKE $1
            LIMIT 1
        `, [`%${searchText}%`]);

        if (departments.length === 0) return null;

        const dept = departments[0];

        // Default to current month if no date specified
        const now = new Date();

        let targetMonth = now.getMonth() + 1;
        let targetYear = now.getFullYear();

        // Very basic year detection
        const yearMatch = searchText.match(/202[0-9]/);
        if (yearMatch) {
            targetYear = parseInt(yearMatch[0]);
        }

        // Month detection (Thai) - simple check
        if (searchText.includes('มกรา') || searchText.includes('Jan')) targetMonth = 1;
        else if (searchText.includes('กุมภา') || searchText.includes('Feb')) targetMonth = 2;
        else if (searchText.includes('มีนา') || searchText.includes('Mar')) targetMonth = 3;
        else if (searchText.includes('เมษา') || searchText.includes('Apr')) targetMonth = 4;
        else if (searchText.includes('พฤษภา') || searchText.includes('May')) targetMonth = 5;
        else if (searchText.includes('มิถุนา') || searchText.includes('Jun')) targetMonth = 6;
        else if (searchText.includes('กรกฎา') || searchText.includes('Jul')) targetMonth = 7;
        else if (searchText.includes('สิงหา') || searchText.includes('Aug')) targetMonth = 8;
        else if (searchText.includes('กันยา') || searchText.includes('Sep')) targetMonth = 9;
        else if (searchText.includes('ตุลา') || searchText.includes('Oct')) targetMonth = 10;
        else if (searchText.includes('พฤศจิกา') || searchText.includes('Nov')) targetMonth = 11;
        else if (searchText.includes('ธันวา') || searchText.includes('Dec')) targetMonth = 12;

        const startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
        // End date is start of next month
        const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
        const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

        // Get leaves
        const leaves = await query(`
            SELECT 
                e.first_name_th, e.last_name_th,
                e.first_name_en, e.last_name_en,
                lt.name_th as leave_type_th,
                lt.name_en as leave_type_en,
                lr.start_date,
                lr.end_date,
                lr.total_days
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE e.department_id = $1
            AND lr.status = 'approved'
            AND (
                (lr.start_date >= $2 AND lr.start_date < $3)
                OR (lr.end_date >= $2 AND lr.end_date < $3)
            )
            ORDER BY lr.start_date ASC
        `, [dept.id, startDate, endDate]);

        return {
            departmentName: dept.name_th,
            employees: leaves.map((l: any) => ({
                name: `${l.first_name_th} ${l.last_name_th}`,
                leaveType: l.leave_type_th,
                startDate: new Date(l.start_date).toLocaleDateString('th-TH'),
                endDate: new Date(l.end_date).toLocaleDateString('th-TH'),
                days: parseFloat(l.total_days)
            }))
        };

    } catch (error) {
        logger.error('[TELEGRAM-BOT] Dept report error:', error);
        return null;
    }
}

/**
 * Get upcoming company holidays
 */
async function getCompanyHolidays(): Promise<any[]> {
    try {
        const result = await query(`
            SELECT holiday_date as date, name_th, name_en 
            FROM company_holidays 
            WHERE holiday_date >= CURRENT_DATE
            ORDER BY holiday_date ASC
            LIMIT 5
        `);
        return result.map((h: any) => ({
            date: new Date(h.date).toLocaleDateString('th-TH', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }),
            name: h.name_th // Use Thai name primarily
        }));
    } catch (error) {
        logger.error('[TELEGRAM-BOT] Get holiday error:', error);
        return [];
    }
}

/**
 * Get Comparison/Summary of all departments
 */
async function getAllDepartmentsSummary(month: number, year: number): Promise<string> {
    try {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

        const result = await query(`
           SELECT 
               d.name_th,
               COUNT(lr.id) as request_count,
               SUM(lr.total_days) as total_days
           FROM departments d
           LEFT JOIN employees e ON d.id = e.department_id
           LEFT JOIN leave_requests lr ON e.id = lr.employee_id 
               AND lr.status = 'approved'
               AND (
                   (lr.start_date >= $1 AND lr.start_date < $2)
                   OR (lr.end_date >= $1 AND lr.end_date < $2)
               )
           GROUP BY d.id, d.name_th
           ORDER BY total_days DESC NULLS LAST
       `, [startDate, endDate]);

        let summary = `DEPARTMENT LEAVE SUMMARY (${month}/${year}):\n`;
        result.forEach((r: any) => {
            summary += `- ${r.name_th}: ${r.request_count} requests (${r.total_days || 0} days)\n`;
        });
        return summary;
    } catch (error) {
        logger.error('[TELEGRAM-BOT] Summary error:', error);
        return '';
    }
}

/**
 * Main handler
 */
export const handler: Handler = async (event) => {
    logger.log(`[TELEGRAM-BOT] 🚀 START Request: ${event.httpMethod}`);

    // Only accept POST
    if (event.httpMethod !== 'POST') {
        logger.log(`[TELEGRAM-BOT] 🛑 Method not allowed: ${event.httpMethod}`);
        return successResponse({ ok: true });
    }

    try {
        logger.log(`[TELEGRAM-BOT] 📝 Parsing body...`);
        const update: TelegramUpdate = JSON.parse(event.body || '{}');

        // Ignore non-message updates
        if (!update.message?.text) {
            logger.log(`[TELEGRAM-BOT] ⏭️ No text message found. Update type: ${Object.keys(update.message || {}).join(',')}`);
            return successResponse({ ok: true });
        }

        const chatId = update.message.chat.id;
        const userMessage = update.message.text.trim();
        const fromUser = update.message.from;

        logger.log(`[TELEGRAM-BOT] 📩 Message RX: "${userMessage}" from ${fromUser.first_name} (ChatID: ${chatId})`);

        // Check if this chat is allowed
        const settings = await getAIBotSettings();
        const testChatId = settings.testChatId ? parseInt(settings.testChatId) : -5127397295;
        logger.log(`[TELEGRAM-BOT] ⚙️ Settings: Production=${settings.productionEnabled}, TestChatID=${testChatId}, CurrentChatID=${chatId}`);

        // DEBUG: Allow all chats temporarily to debug
        // if (!settings.productionEnabled && chatId !== testChatId) {
        //     logger.log(`[TELEGRAM-BOT] Ignoring message from non-test chat: ${chatId}`);
        //     return successResponse({ ok: true });
        // }

        // If user asks for "chat id" or "id", reply with current chat id
        if (userMessage.toLowerCase() === '/id' || userMessage.toLowerCase().includes('chat id')) {
            logger.log(`[TELEGRAM-BOT] ℹ️ User requested Chat ID`);
            await sendTelegramReply(chatId, `Current Chat ID: <code>${chatId}</code>`);
            return successResponse({ ok: true });
        }

        // Detect language
        const language = detectLanguage(userMessage);
        logger.log(`[TELEGRAM-BOT] 🌐 Detected Language: ${language}`);

        // Try to find employee mentioned in message
        logger.log(`[TELEGRAM-BOT] 🔍 Searching for employee in message...`);
        const employee = await findEmployeeByName(userMessage);
        logger.log(`[TELEGRAM-BOT] 👤 Employee Search Result: ${employee ? `Found ID ${employee.id} (${employee.employee_code})` : 'Not Found'}`);

        // Build context
        const context: ChatContext = {
            language,
        };

        if (employee) {
            context.employeeName = language === 'th'
                ? `${employee.first_name_th} ${employee.last_name_th}`
                : `${employee.first_name_en} ${employee.last_name_en}`;
            context.employeeCode = employee.employee_code;

            // Get leave balances
            logger.log(`[TELEGRAM-BOT] 📊 Fetching leave balances for EmpID ${employee.id}...`);
            const balances = await getEmployeeLeaveBalances(employee.id);
            if (Array.isArray(balances)) {
                logger.log(`[TELEGRAM-BOT] ✅ Balances found: ${balances.length} types`);
                context.leaveBalances = balances.map(b => ({
                    leaveType: language === 'th' ? b.leave_type_th : b.leave_type_en,
                    total: parseFloat(b.total_days) || 0,
                    used: parseFloat(b.used_days) || 0,
                    remaining: parseFloat(b.remaining_days) || 0,
                }));
            } else {
                logger.warn(`[TELEGRAM-BOT] ⚠️ Invalid balances returned: ${JSON.stringify(balances)}`);
                context.leaveBalances = [];
            }
        }

        // TEMPORARILY DISABLED FOR DEBUGGING
        // Check for specific department leave inquiry (simple version)
        /*
        const deptMatch = userMessage.match(/(?:แผนก|department)\s+([a-zA-Z0-9\u0E00-\u0E7F]+)/i);
        if (deptMatch) { ... }
        */

        // Get company holidays (Always attach for now as it's useful context)
        logger.log(`[TELEGRAM-BOT] 📅 Fetching company holidays...`);
        const holidays = await getCompanyHolidays();
        if (holidays.length > 0) {
            logger.log(`[TELEGRAM-BOT] ✅ Holidays found: ${holidays.length} days`);
            context.companyHolidays = holidays;
        }

        // Generate AI response
        logger.log('[TELEGRAM-BOT] 🧠 Generating AI response via Gemini...');
        const aiResponse = await generateChatResponse(userMessage, [], context);
        logger.log(`[TELEGRAM-BOT] 💡 AI Response received. Length: ${aiResponse?.length || 0} chars`);
        if (aiResponse) {
            logger.log(`[TELEGRAM-BOT] 💬 Preview: ${aiResponse.substring(0, 50)}...`);
        } else {
            logger.warn(`[TELEGRAM-BOT] ⚠️ AI Response is empty/null`);
        }

        // Fallback if AI returns empty
        const finalResponse = aiResponse?.trim() || (
            context.language === 'th'
                ? 'ขออภัย ไม่สามารถประมวลผลได้ในขณะนี้ กรุณาลองใหม่อีกครั้งครับ'
                : 'Sorry, unable to process your request. Please try again.'
        );

        // Send reply
        logger.log(`[TELEGRAM-BOT] 📤 Sending reply to Telegram Chat ${chatId}...`);
        const sent = await sendTelegramReply(chatId, finalResponse);

        if (sent) {
            logger.log('[TELEGRAM-BOT] ✅ Response sent successfully');
        } else {
            logger.error('[TELEGRAM-BOT] ❌ Failed to send reply to Telegram');
        }

        logger.log(`[TELEGRAM-BOT] 🏁 END Request`);
        return successResponse({ ok: true });

    } catch (error: any) {
        logger.error('[TELEGRAM-BOT] 💥 CRITICAL ERROR:', error.message, error.stack);

        // Try to send error message to user
        try {
            const update = JSON.parse(event.body || '{}');
            if (update.message?.chat?.id) {
                logger.log(`[TELEGRAM-BOT] 🚑 Attempting to send error notification to user...`);
                await sendTelegramReply(
                    update.message.chat.id,
                    '❌ ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง หรือติดต่อ HR'
                );
            }
        } catch (sendError) {
            logger.error('[TELEGRAM-BOT] 💀 Failed to send error notification:', sendError);
        }

        return successResponse({ ok: true }); // Always return 200 to Telegram
    }
};
