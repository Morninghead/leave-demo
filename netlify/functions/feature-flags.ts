import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (lazy initialization to prevent module load failures)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Create client only if env vars are present
const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Helper to check if Supabase is configured
function getSupabase() {
    if (!supabase) {
        throw new Error('Supabase not configured - missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    return supabase;
}

/**
 * Get all feature flags
 * GET /.netlify/functions/feature-flags
 */
async function getAllFeatureFlags(): Promise<HandlerResponse> {
    try {
        const { data, error } = await getSupabase()
            .from('feature_flags')
            .select('*')
            .order('flag_name');

        if (error) {
            console.error('Error fetching feature flags:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to fetch feature flags' }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data),
            headers: {
                'Cache-Control': 'public, max-age=60', // 1 minute cache
            },
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
 * Get specific feature flag status for a user
 * GET /.netlify/functions/feature-flags/:flagName?userId=:userId
 */
async function getFeatureFlag(
    flagName: string,
    userId?: string
): Promise<HandlerResponse> {
    try {
        // Get flag configuration
        const { data: flag, error: flagError } = await getSupabase()
            .from('feature_flags')
            .select('*')
            .eq('flag_name', flagName)
            .single();

        if (flagError || !flag) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Feature flag not found' }),
            };
        }

        // If no userId provided, return flag config only
        if (!userId) {
            return {
                statusCode: 200,
                body: JSON.stringify(flag),
            };
        }

        // Check if user has opted in
        const { data: preference } = await getSupabase()
            .from('user_feature_preferences')
            .select('opted_in')
            .eq('user_id', userId)
            .eq('flag_name', flagName)
            .single();

        const isOptedIn = preference?.opted_in || false;

        // Calculate if user should see feature
        const shouldShow = calculateUserInRollout(userId, flag, isOptedIn);

        return {
            statusCode: 200,
            body: JSON.stringify({
                ...flag,
                should_show: shouldShow,
                is_opted_in: isOptedIn,
            }),
            headers: {
                'Cache-Control': 'private, max-age=60', // 1 minute cache, private per user
            },
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
 * Update feature flag (admin only)
 * PUT /.netlify/functions/feature-flags/:flagName
 */
async function updateFeatureFlag(
    flagName: string,
    updates: Partial<FeatureFlag>
): Promise<HandlerResponse> {
    try {
        const { data, error } = await getSupabase()
            .from('feature_flags')
            .update(updates)
            .eq('flag_name', flagName)
            .select()
            .single();

        if (error) {
            console.error('Error updating feature flag:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to update feature flag' }),
            };
        }

        return {
            statusCode: 200,
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
 * Get or set user feature preference
 * GET/POST /.netlify/functions/user-feature-preferences
 */
async function handleUserPreference(
    method: string,
    userId: string,
    body?: { flag_name: string; opted_in: boolean }
): Promise<HandlerResponse> {
    try {
        if (method === 'GET') {
            const { data, error } = await getSupabase()
                .from('user_feature_preferences')
                .select('*')
                .eq('user_id', userId);

            if (error) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'Failed to fetch preferences' }),
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(data),
            };
        }

        if (method === 'POST' && body) {
            const { data, error } = await getSupabase()
                .from('user_feature_preferences')
                .upsert(
                    {
                        user_id: userId,
                        flag_name: body.flag_name,
                        opted_in: body.opted_in,
                    },
                    { onConflict: 'user_id,flag_name' }
                )
                .select()
                .single();

            if (error) {
                console.error('Error saving preference:', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'Failed to save preference' }),
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(data),
            };
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' }),
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
 * Calculate if user should see feature based on consistent hashing
 */
function calculateUserInRollout(
    userId: string,
    flag: FeatureFlag,
    isOptedIn: boolean
): boolean {
    // If user opted in, always show
    if (isOptedIn) return true;

    // If flag is disabled, return false
    if (!flag.enabled) return false;

    // If rollout is 100%, always show
    if (flag.rollout_percentage >= 100) return true;

    // If rollout is 0%, never show
    if (flag.rollout_percentage <= 0) return false;

    // Consistent hashing based on user_id
    const hash = hashUserId(userId);
    return (hash % 100) < flag.rollout_percentage;
}

/**
 * Simple hash function for consistent user bucketing
 */
function hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Types
interface FeatureFlag {
    id: string;
    flag_name: string;
    description: string;
    enabled: boolean;
    rollout_percentage: number;
    target_roles: string[];
    target_departments: string[];
    allow_opt_in: boolean;
    created_at: string;
    updated_at: string;
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: '',
        };
    }

    const path = event.path.replace('/.netlify/functions/', '');
    const segments = path.split('/').filter(Boolean);

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

        // Route requests
        if (segments[0] === 'feature-flags') {
            if (segments.length === 1) {
                // /feature-flags
                if (event.httpMethod === 'GET') {
                    const response = await getAllFeatureFlags();
                    return { ...response, headers: { ...headers, ...response.headers } };
                }
            } else if (segments.length === 2) {
                // /feature-flags/:flagName
                const flagName = segments[1];
                const queryParams = event.queryStringParameters || {};

                if (event.httpMethod === 'GET') {
                    const response = await getFeatureFlag(flagName, queryParams.userId || userId);
                    return { ...response, headers: { ...headers, ...response.headers } };
                }

                if (event.httpMethod === 'PUT') {
                    const body = JSON.parse(event.body || '{}');
                    const response = await updateFeatureFlag(flagName, body);
                    return { ...response, headers };
                }
            }
        }

        if (segments[0] === 'user-feature-preferences') {
            if (event.httpMethod === 'GET') {
                if (!userId) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ error: 'Unauthorized' }),
                    };
                }
                const response = await handleUserPreference('GET', userId);
                return { ...response, headers };
            }

            if (event.httpMethod === 'POST') {
                if (!userId) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ error: 'Unauthorized' }),
                    };
                }
                const body = JSON.parse(event.body || '{}');
                const response = await handleUserPreference('POST', userId, body);
                return { ...response, headers };
            }
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' }),
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