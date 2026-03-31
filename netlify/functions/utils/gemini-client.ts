/**
 * Gemini AI Client Utility
 * 
 * Wrapper for Google Gemini API with rate limiting and error handling
 */

import { logger } from './logger';
import { query } from './db';
import { buildSystemPrompt } from './system-prompt';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Model Options:
// - gemini-2.5-flash: Stable, best price-performance, agentic use cases
// - gemini-3-flash-preview: Latest preview, balanced speed + intelligence
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Get configured Gemini model from database
 */
async function getConfiguredModel(): Promise<string> {
    try {
        const result = await query(`
            SELECT setting_value FROM company_settings 
            WHERE setting_key = 'gemini_model'
            LIMIT 1
        `);
        return result[0]?.setting_value || DEFAULT_MODEL;
    } catch (error) {
        logger.warn('[GEMINI] Failed to get model config, using default');
        return DEFAULT_MODEL;
    }
}

interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface GeminiResponse {
    candidates?: {
        content: {
            parts: { text: string }[];
            role: string;
        };
        finishReason: string;
    }[];
    error?: {
        message: string;
        code: number;
    };
}

export interface ChatContext {
    employeeName?: string;
    employeeCode?: string;
    leaveBalances?: {
        leaveType: string;
        remaining: number;
        total: number;
        used: number;
    }[];
    pendingRequests?: number;
    language?: 'th' | 'en';
    companyHolidays?: {
        date: string;
        name: string;
    }[];
    departmentLeaveReport?: {
        departmentName: string;
        employees: {
            name: string;
            leaveType: string;
            startDate: string;
            endDate: string;
            days: number;
        }[];
    };
}

/**
 * Generate AI response using Gemini API
 */
export async function generateChatResponse(
    userMessage: string,
    chatHistory: GeminiMessage[],
    context: ChatContext
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        logger.error('[GEMINI] API key not configured');
        return context.language === 'th'
            ? 'ขออภัย ระบบ AI ยังไม่พร้อมใช้งาน กรุณาติดต่อ HR'
            : 'Sorry, AI system is not available. Please contact HR.';
    }

    try {
        // Build dynamic system prompt
        const systemInstruction = buildSystemPrompt(context);

        // Build messages array
        const messages: GeminiMessage[] = [
            {
                role: 'user', // System prompt as user message (for now, until system role is fully supported or use correct field)
                parts: [{ text: systemInstruction }]
            },
            {
                role: 'model',
                parts: [{
                    text: context.language === 'th'
                        ? 'รับทราบครับ ผมพร้อมให้บริการข้อมูล HR แล้วครับ'
                        : 'Understood. I am ready to provide HR assistance.'
                }]
            },
            ...chatHistory,
            {
                role: 'user',
                parts: [{ text: userMessage }]
            }
        ];

        // Get configured model from database
        const model = await getConfiguredModel();
        const apiUrl = `${GEMINI_API_BASE}/${model}:generateContent`;
        logger.log(`[GEMINI] Using model: ${model}`);

        const response = await fetch(`${apiUrl}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: messages,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                ]
            }),
        });

        const data = await response.json() as GeminiResponse;

        logger.log(`[GEMINI] Response status: ${response.status}`);
        logger.log(`[GEMINI] Response data: ${JSON.stringify(data).substring(0, 500)}`);

        if (data.error) {
            logger.error('[GEMINI] API Error:', data.error.message, data.error.code);
            return context.language === 'th'
                ? 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
                : 'Sorry, an error occurred. Please try again.';
        }

        if (data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0]?.text || '';
            logger.log('[GEMINI] Response generated successfully');
            return text;
        }

        logger.warn('[GEMINI] No candidates in response');

        return context.language === 'th'
            ? 'ขออภัย ไม่สามารถประมวลผลได้ กรุณาลองใหม่'
            : 'Sorry, could not process your request. Please try again.';

    } catch (error: any) {
        logger.error('[GEMINI] Request failed:', error.message);
        return context.language === 'th'
            ? 'ขออภัย ระบบขัดข้อง กรุณาลองใหม่ภายหลัง'
            : 'Sorry, system error. Please try again later.';
    }
}

/**
 * Detect language from text
 */
export function detectLanguage(text: string): 'th' | 'en' {
    // Check for Thai characters
    const thaiPattern = /[\u0E00-\u0E7F]/;
    return thaiPattern.test(text) ? 'th' : 'en';
}
