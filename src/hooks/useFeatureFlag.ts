import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import api from '../api/auth';

export interface FeatureFlagConfig {
    flag_name: string;
    enabled: boolean;
    rollout_percentage: number;
    target_roles: string[];
    allow_opt_in: boolean;
}

export interface UserFeaturePreference {
    flag_name: string;
    opted_in: boolean;
}

// Cache for feature flags to reduce API calls
const flagCache: Map<string, { config: FeatureFlagConfig; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Check if user should see mobile UX V2 based on feature flags
 * This implements consistent hashing for stable user experience
 */
export function useMobileUXV2(): boolean {
    const { user } = useAuth();
    const { deviceType } = useDevice();
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        // Desktop always uses v1
        if (deviceType === 'desktop') {
            setIsEnabled(false);
            return;
        }

        // Check localStorage for opt-in first (fastest)
        const optIn = localStorage.getItem('mobileUXV2_optIn') === 'true';
        if (optIn) {
            setIsEnabled(true);
            return;
        }

        // If no user, default to false
        if (!user?.id) {
            setIsEnabled(false);
            return;
        }

        // Check feature flag from server
        const checkFeatureFlag = async () => {
            try {
                const shouldShow = await fetchFeatureFlagStatus(user.id, 'mobileUXV2');
                setIsEnabled(shouldShow);
            } catch (error) {
                console.error('Failed to check feature flag:', error);
                setIsEnabled(false);
            }
        };

        checkFeatureFlag();
    }, [user?.id, deviceType]);

    return isEnabled;
}

/**
 * Generic hook for checking any feature flag
 */
export function useFeatureFlag(flagName: string): boolean {
    const { user } = useAuth();
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsEnabled(false);
            setIsLoading(false);
            return;
        }

        const checkFlag = async () => {
            try {
                const shouldShow = await fetchFeatureFlagStatus(user.id, flagName);
                setIsEnabled(shouldShow);
            } catch (error) {
                console.error(`Failed to check feature flag ${flagName}:`, error);
                setIsEnabled(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkFlag();
    }, [user?.id, flagName]);

    return isEnabled;
}

/**
 * Hook to manage user opt-in preferences
 */
export function useFeatureFlagPreference(flagName: string) {
    const { user } = useAuth();
    const [isOptedIn, setIsOptedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial preference
    useEffect(() => {
        const loadPreference = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                // Check localStorage first
                const localPref = localStorage.getItem(`${flagName}_optIn`);
                if (localPref !== null) {
                    setIsOptedIn(localPref === 'true');
                }

                // Then fetch from server to sync
                const response = await api.get(`/user-feature-preferences?flag_name=${flagName}`);
                if (response.data?.opted_in !== undefined) {
                    setIsOptedIn(response.data.opted_in);
                    localStorage.setItem(`${flagName}_optIn`, String(response.data.opted_in));
                }
            } catch (error) {
                console.error('Failed to load preference:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPreference();
    }, [user?.id, flagName]);

    const setPreference = useCallback(async (optIn: boolean) => {
        if (!user?.id) return;

        try {
            setIsOptedIn(optIn);
            localStorage.setItem(`${flagName}_optIn`, String(optIn));

            await api.post('/user-feature-preferences', {
                flag_name: flagName,
                opted_in: optIn,
            });
        } catch (error) {
            console.error('Failed to save preference:', error);
            // Revert on error
            setIsOptedIn(!optIn);
            localStorage.setItem(`${flagName}_optIn`, String(!optIn));
        }
    }, [user?.id, flagName]);

    return { isOptedIn, setPreference, isLoading };
}

/**
 * Fetch feature flag status from server with caching
 */
async function fetchFeatureFlagStatus(userId: string, flagName: string): Promise<boolean> {
    // Check cache first
    const cached = flagCache.get(flagName);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return calculateUserInRollout(userId, cached.config);
    }

    try {
        const response = await api.get(`/feature-flags/${flagName}`);
        const config: FeatureFlagConfig = response.data;

        // Update cache
        flagCache.set(flagName, { config, timestamp: Date.now() });

        return calculateUserInRollout(userId, config);
    } catch (error) {
        console.error('Failed to fetch feature flag:', error);
        return false;
    }
}

/**
 * Calculate if user should see feature based on consistent hashing
 */
function calculateUserInRollout(userId: string, config: FeatureFlagConfig): boolean {
    // If flag is disabled, return false
    if (!config.enabled) {
        return false;
    }

    // If rollout is 100%, always show
    if (config.rollout_percentage >= 100) {
        return true;
    }

    // If rollout is 0%, never show
    if (config.rollout_percentage <= 0) {
        return false;
    }

    // Consistent hashing based on user_id
    const hash = hashUserId(userId);
    return (hash % 100) < config.rollout_percentage;
}

/**
 * Simple hash function for consistent user bucketing
 */
function hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Track analytics event for A/B testing
 */
export async function trackFeatureFlagEvent(
    eventName: string,
    flagName: string,
    variant: 'control' | 'treatment',
    metadata: Record<string, any> = {}
): Promise<void> {
    try {
        await api.post('/analytics-events', {
            event_name: eventName,
            feature_flag: flagName,
            variant,
            metadata,
            device_info: {
                userAgent: navigator.userAgent,
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
            },
        });
    } catch (error) {
        // Silently fail - analytics should not break the app
        console.warn('Failed to track analytics event:', error);
    }
}

/**
 * Clear feature flag cache (useful for testing or after updates)
 */
export function clearFeatureFlagCache(): void {
    flagCache.clear();
}

/**
 * Hook to get all available feature flags for the current user
 */
export function useAvailableFeatureFlags(): {
    flags: FeatureFlagConfig[];
    isLoading: boolean;
} {
    const { user } = useAuth();
    const [flags, setFlags] = useState<FeatureFlagConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        const fetchFlags = async () => {
            try {
                const response = await api.get('/feature-flags');
                setFlags(response.data || []);
            } catch (error) {
                console.error('Failed to fetch feature flags:', error);
                setFlags([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFlags();
    }, [user?.id]);

    return { flags, isLoading };
}