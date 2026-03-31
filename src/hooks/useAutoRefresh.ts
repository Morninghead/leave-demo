import { useEffect, useRef, useState } from 'react';
import { RefreshIntervals, getAdaptiveInterval, shouldAutoRefresh } from '../config/refreshIntervals';

interface UseAutoRefreshOptions {
  /**
   * The category of data being refreshed (e.g., 'DASHBOARD', 'LEAVE_REQUESTS')
   */
  category: keyof typeof RefreshIntervals;

  /**
   * The specific data type within the category (e.g., 'ACTIVE', 'PENDING')
   */
  dataType: string;

  /**
   * Callback function to execute on refresh
   */
  onRefresh: () => void | Promise<void>;

  /**
   * Whether the page is currently enabled (default: true)
   * Set to false to disable all auto-refresh
   */
  enabled?: boolean;

  /**
   * Whether the page has a form that user might be filling
   * If true, auto-refresh will be disabled when form is being edited
   */
  hasForm?: boolean;

  /**
   * Custom interval in milliseconds (overrides category/dataType lookup)
   */
  customInterval?: number;
}

/**
 * Custom hook for managing auto-refresh with adaptive intervals
 * and form protection
 *
 * Features:
 * - Adaptive intervals based on page visibility and user activity
 * - Form protection: prevents refresh when user is editing
 * - Respects prefers-reduced-motion
 * - Tracks page visibility (Page Visibility API)
 * - Tracks user activity for idle detection
 *
 * @example
 * ```tsx
 * // Simple usage for data display page
 * useAutoRefresh({
 *   category: 'LEAVE_REQUESTS',
 *   dataType: 'PENDING',
 *   onRefresh: loadData
 * });
 *
 * // With form protection
 * const { markFormDirty, markFormClean } = useAutoRefresh({
 *   category: 'LEAVE_REQUESTS',
 *   dataType: 'DETAIL',
 *   onRefresh: loadData,
 *   hasForm: true
 * });
 *
 * // Call markFormDirty() when user starts editing
 * // Call markFormClean() when form is submitted/cancelled
 * ```
 */
export function useAutoRefresh({
  category,
  dataType,
  onRefresh,
  enabled = true,
  hasForm = false,
  customInterval,
}: UseAutoRefreshOptions) {
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastRefreshRef = useRef<number>(Date.now());
  const isRefreshingRef = useRef<boolean>(false);

  // ✅ FIX: Use ref for onRefresh to avoid stale closure issues
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Get the base interval from config or use custom
  const getBaseInterval = (): number => {
    if (customInterval !== undefined) {
      return customInterval;
    }

    const config = RefreshIntervals[category];
    if (typeof config === 'object' && dataType in config) {
      return (config as any)[dataType];
    }

    // Default fallback: 5 minutes
    return 5 * 60 * 1000;
  };

  // Handle refresh execution - uses ref to always get latest callback
  const handleRefresh = async () => {
    if (isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
      lastRefreshRef.current = Date.now();
      // ✅ Use ref to always call the latest version of onRefresh
      await onRefreshRef.current();
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      // We no longer trigger refresh on visibility change to prevent flickering
      // The background interval will handle updates eventually
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Track user activity for idle detection
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, updateActivity, { passive: true }));

    return () => {
      events.forEach(event => document.removeEventListener(event, updateActivity));
    };
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    // Don't set up auto-refresh if disabled or if it's a manual-only page
    if (!enabled || !shouldAutoRefresh(category, dataType)) {
      return;
    }

    const baseInterval = getBaseInterval();

    // If interval is 0, it means manual refresh only
    if (baseInterval === 0) {
      return;
    }

    const checkAndRefresh = async () => {
      // Don't refresh if form is being edited
      if (hasForm && isFormDirty) {
        console.log(`[useAutoRefresh] Skipping refresh - form is dirty`);
        return;
      }

      // Don't refresh if already refreshing
      if (isRefreshingRef.current) {
        return;
      }

      // Check if user has been idle for more than 5 minutes
      const isIdle = Date.now() - lastActivityRef.current > 5 * 60 * 1000;

      // Get adaptive interval
      const adaptiveInterval = getAdaptiveInterval(baseInterval, isPageVisible, isIdle);

      // Only refresh if enough time has passed since last refresh
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh >= adaptiveInterval) {
        console.log(`[useAutoRefresh] Refreshing ${category}.${dataType} (interval: ${adaptiveInterval / 1000}s)`);
        await handleRefresh();
      }
    };

    // Run check at the base interval
    const interval = setInterval(checkAndRefresh, baseInterval);

    return () => clearInterval(interval);
  }, [enabled, category, dataType, onRefresh, hasForm, isFormDirty, isPageVisible, customInterval]);

  // Form state management
  const markFormDirty = () => {
    console.log(`[useAutoRefresh] Form marked as dirty - auto-refresh disabled`);
    setIsFormDirty(true);
  };

  const markFormClean = () => {
    console.log(`[useAutoRefresh] Form marked as clean - auto-refresh re-enabled`);
    setIsFormDirty(false);
    // Refresh immediately when form is cleaned (submitted/cancelled)
    handleRefresh();
  };

  return {
    /**
     * Mark form as dirty (being edited) - disables auto-refresh
     * Call this when user starts editing the form
     */
    markFormDirty,

    /**
     * Mark form as clean (submitted/cancelled) - re-enables auto-refresh
     * Call this when form is submitted or cancelled
     * This will trigger an immediate refresh
     */
    markFormClean,

    /**
     * Whether the form is currently dirty (being edited)
     */
    isFormDirty,

    /**
     * Whether the page is currently visible
     */
    isPageVisible,

    /**
     * Manually trigger a refresh
     */
    refresh: handleRefresh,
  };
}
