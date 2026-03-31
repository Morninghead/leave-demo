import { Handler } from '@netlify/functions';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export const handler: Handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message } = JSON.parse(event.body || '{}');

        if (!message) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Message is required' }) };
        }

        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Telegram is not configured for this environment' }),
            };
        }

        const payload = {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        };

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, payload);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Announcement sent' }),
        };
    } catch (error: any) {
        console.error('Telegram Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send announcement', details: error.message }),
        };
    }
};
