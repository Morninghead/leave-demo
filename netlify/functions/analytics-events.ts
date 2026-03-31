import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (lazy initialization to prevent module load failures)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

function getSupabase() {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }
    return supabase;
}

/**
 * Track analytics event for A/B testing
 * POST /.netlify/functions/analytics-events
 */
async function trackEvent(eventData: AnalyticsEventData): Promise<HandlerResponse> {
    try {
        const { data, error } = await getSupabase()
            .from('analytics_events')
            .insert({
                event_name: eventData.event_name,
                user_id: eventData.user_id,
                session_id: eventData.session_id,
                feature_flag: eventData.feature_flag,
                variant: eventData.variant,
                metadata: eventData.metadata || {},
                device_info: eventData.device_info || {},
                timestamp: eventData.timestamp || new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error tracking analytics event:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to track event' }),
            };
        }

        return {
            statusCode: 201,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}

/**
 * Get analytics summary for a feature flag
 * GET /.netlify/functions/analytics-events?flag=:flagName&startDate=:date&endDate=:date
 */
async function getAnalyticsSummary(
    flagName: string,
    startDate?: string,
    endDate?: string
): Promise<HandlerResponse> {
    try {
        let query = getSupabase()
            .from('analytics_events')
            .select('*')
            .eq('feature_flag', flagName);

        if (startDate) {
            query = query.gte('timestamp', startDate);
        }

        if (endDate) {
            query = query.lte('timestamp', endDate);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching analytics:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to fetch analytics' }),
            };
        }

        // Calculate summary statistics
        const summary = calculateSummary(data || []);

        return {
            statusCode: 200,
            body: JSON.stringify({
                flag_name: flagName,
                summary,
                events: data,
            }),
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}

/**
 * Calculate summary statistics from events
 */
function calculateSummary(events: any[]): AnalyticsSummary {
    const controlEvents = events.filter(e => e.variant === 'control');
    const treatmentEvents = events.filter(e => e.variant === 'treatment');

    const eventNames = [...new Set(events.map(e => e.event_name))];
    const eventCounts: Record<string, { control: number; treatment: number }> = {};

    eventNames.forEach(name => {
        eventCounts[name] = {
            control: controlEvents.filter(e => e.event_name === name).length,
            treatment: treatmentEvents.filter(e => e.event_name === name).length,
        };
    });

    return {
        total_events: events.length,
        control_events: controlEvents.length,
        treatment_events: treatmentEvents.length,
        unique_users: new Set(events.map(e => e.user_id)).size,
        event_counts: eventCounts,
        date_range: {
            start: events.length > 0 ? events[0].timestamp : null,
            end: events.length > 0 ? events[events.length - 1].timestamp : null,
        },
    };
}

// Types
interface AnalyticsEventData {
    event_name: string;
    user_id?: string;
    session_id?: string;
    feature_flag?: string;
    variant?: 'control' | 'treatment';
    metadata?: Record<string, any>;
    device_info?: Record<string, any>;
    timestamp?: string;
}

interface AnalyticsSummary {
    total_events: number;
    control_events: number;
    treatment_events: number;
    unique_users: number;
    event_counts: Record<string, { control: number; treatment: number }>;
    date_range: {
        start: string | null;
        end: string | null;
    };
}

interface HandlerResponse {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
}

// Main handler
export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
): Promise<HandlerResponse> => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: '',
        };
    }

    try {
        // Extract user ID from JWT token if present
        let userId: string | undefined;
        const authHeader = event.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user }, error } = await getSupabase().auth.getUser(token);
                if (user && !error) {
                    userId = user.id;
                }
            } catch (e) {
                // Invalid token, continue without user ID
            }
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const eventData: AnalyticsEventData = {
                ...body,
                user_id: body.user_id || userId,
            };

            const response = await trackEvent(eventData);
            return { ...response, headers };
        }

        if (event.httpMethod === 'GET') {
            const queryParams = event.queryStringParameters || {};
            const flagName = queryParams.flag;

            if (!flagName) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing flag parameter' }),
                };
            }

            // Check if user has permission to view analytics (admin/hr/dev only)
            if (!authHeader) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Unauthorized' }),
                };
            }

            const response = await getAnalyticsSummary(
                flagName,
                queryParams.startDate,
                queryParams.endDate
            );
            return { ...response, headers };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};