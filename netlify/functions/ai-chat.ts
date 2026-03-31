/**
 * AI Chat Netlify Function
 * 
 * Handle chat messages and generate AI responses using Gemini
 */

import { Handler } from '@netlify/functions';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse } from './utils/response';
import { logger } from './utils/logger';
import { query } from './utils/db';
import { generateChatResponse, detectLanguage, ChatContext } from './utils/gemini-client';

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

const handleChat = async (event: AuthenticatedEvent) => {
    const user = event.user;

    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    if (!user) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { message, history = [] } = body;

        if (!message || typeof message !== 'string') {
            return errorResponse('Message is required', 400);
        }

        logger.log(`[AI-CHAT] Processing message from user ${user.sub}`);

        // Detect language
        const language = detectLanguage(message);

        // Define context
        const context: ChatContext = { language };
        let targetEmployeeId = user.sub; // Default to current user
        let targetEmployeeName = language === 'th' ? user.firstNameTh : user.firstNameEn;
        let targetEmployeeCode = user.employeeCode;

        // 1. Try to find employee mentioned in the message
        try {
            // 1.1 Priority: Look for Employee Code pattern
            const codeMatch = message.match(/\b\d{5,}\b/);
            let foundEmployee = null;

            if (codeMatch) {
                const code = codeMatch[0];
                const codeResult = await query(`
                    SELECT id, employee_code, first_name_th, last_name_th, first_name_en, last_name_en
                    FROM employees WHERE status = 'active' AND employee_code = $1 LIMIT 1
                `, [code]);
                if (codeResult.length > 0) foundEmployee = codeResult[0];
            } else {
                // 1.2 Name search
                const words = message.split(/\s+/).filter(w => w.length > 2 && isNaN(Number(w)));
                for (const word of words) {
                    if (['what', 'when', 'where', 'leave', 'remaining', 'want', 'check', 'my'].includes(word.toLowerCase())) continue;

                    const subResult = await query(`
                        SELECT id, employee_code, first_name_th, last_name_th, first_name_en, last_name_en
                        FROM employees 
                        WHERE status = 'active' 
                        AND (first_name_th ILIKE $1 OR first_name_en ILIKE $1 OR last_name_th ILIKE $1 OR last_name_en ILIKE $1)
                        LIMIT 1
                    `, [`%${word}%`]);

                    if (subResult.length > 0) {
                        foundEmployee = subResult[0];
                        break;
                    }
                }
            }

            if (foundEmployee) {
                targetEmployeeId = foundEmployee.id;
                targetEmployeeCode = foundEmployee.employee_code;
                targetEmployeeName = language === 'th'
                    ? `${foundEmployee.first_name_th} ${foundEmployee.last_name_th}`
                    : `${foundEmployee.first_name_en} ${foundEmployee.last_name_en}`;

                logger.log(`[AI-CHAT] Context switched to found employee: ${targetEmployeeCode}`);
            }
        } catch (err) {
            logger.error('[AI-CHAT] Employee search error:', err);
        }

        // Set basic info in context
        context.employeeName = targetEmployeeName;
        context.employeeCode = targetEmployeeCode;

        // Fetch leave balances for target employee
        try {
            // Use same calculation logic as dashboard/telegram
            const balanceResult = await query(`
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
            `, [targetEmployeeId]);

            context.leaveBalances = balanceResult.map((b: any) => ({
                leaveType: language === 'th' ? b.leave_type_th : b.leave_type_en,
                total: parseFloat(b.total_days) || 0,
                used: parseFloat(b.used_days) || 0,
                remaining: parseFloat(b.remaining_days) || 0,
            }));
        } catch (err) {
            logger.warn('[AI-CHAT] Could not fetch leave balances:', err);
        }

        // Fetch pending requests count for target employee
        try {
            const pendingResult = await query(`
                SELECT COUNT(*) as count
                FROM leave_requests
                WHERE employee_id = $1 AND status = 'pending'
            `, [targetEmployeeId]);
            context.pendingRequests = parseInt(pendingResult[0]?.count || '0');
        } catch (err) {
            logger.warn('[AI-CHAT] Could not fetch pending count:', err);
        }

        // Convert history format for Gemini
        const geminiHistory = history.map((msg: ChatMessage) => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        // Generate AI response
        const aiResponse = await generateChatResponse(message, geminiHistory, context);

        logger.log('[AI-CHAT] Response generated successfully');

        return successResponse({
            success: true,
            response: aiResponse,
            language,
        });

    } catch (error: any) {
        logger.error('[AI-CHAT] Error:', error.message);
        return errorResponse('Failed to process chat message', 500);
    }
};

export const handler: Handler = requireAuth(handleChat);
