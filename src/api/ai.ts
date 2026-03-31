/**
 * AI Chat API Functions
 */

import api from './auth';

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
    timestamp?: Date;
}

export interface ChatResponse {
    success: boolean;
    response: string;
    language: 'th' | 'en';
}

/**
 * Send a chat message to AI and get response
 */
export async function sendChatMessage(
    message: string,
    history: ChatMessage[] = []
): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/ai-chat', {
        message,
        history: history.map(m => ({
            role: m.role,
            content: m.content
        }))
    });
    return response.data;
}
