import { useState, useEffect, useRef, useCallback } from 'react';

interface ScrollTrackerOptions {
  onScrollComplete?: () => void;
  threshold?: number; // Percentage (0-100)
  debounceMs?: number;
}

interface ScrollTrackerResult {
  scrollPercentage: number;
  isScrollComplete: boolean;
  timeSpentSeconds: number;
  containerRef: React.RefObject<HTMLDivElement>;
  resetTracking: () => void;
}

export function useScrollTracker({
  onScrollComplete,
  threshold = 100,
  debounceMs = 300,
}: ScrollTrackerOptions = {}): ScrollTrackerResult {
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [isScrollComplete, setIsScrollComplete] = useState(false);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredComplete = useRef(false);
  const startTimeRef = useRef(Date.now());

  const calculateScrollPercentage = useCallback(() => {
    const container = containerRef.current;
    if (!container) return 0;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // If content is shorter than container, consider it 100% scrolled
    if (scrollHeight <= clientHeight) {
      return 100;
    }

    const scrollableHeight = scrollHeight - clientHeight;
    const percentage = (scrollTop / scrollableHeight) * 100;

    return Math.min(Math.round(percentage), 100);
  }, []);

  const handleScroll = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      const percentage = calculateScrollPercentage();
      setScrollPercentage(percentage);

      // Update time spent
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeSpentSeconds(elapsed);

      // Check if scroll is complete
      if (percentage >= threshold && !hasTriggeredComplete.current) {
        setIsScrollComplete(true);
        hasTriggeredComplete.current = true;
        onScrollComplete?.();
      }
    }, debounceMs);
  }, [calculateScrollPercentage, threshold, onScrollComplete, debounceMs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial check (for short content)
    const initialPercentage = calculateScrollPercentage();
    if (initialPercentage >= threshold) {
      setScrollPercentage(initialPercentage);
      setIsScrollComplete(true);
      hasTriggeredComplete.current = true;
      onScrollComplete?.();
    }

    // Add scroll listener
    container.addEventListener('scroll', handleScroll);

    // Track time spent
    const timeInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeSpentSeconds(elapsed);
    }, 1000);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearInterval(timeInterval);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [handleScroll, calculateScrollPercentage, threshold, onScrollComplete]);

  const resetTracking = useCallback(() => {
    setScrollPercentage(0);
    setIsScrollComplete(false);
    setTimeSpentSeconds(0);
    hasTriggeredComplete.current = false;
    startTimeRef.current = Date.now();
  }, []);

  return {
    scrollPercentage,
    isScrollComplete,
    timeSpentSeconds,
    containerRef,
    resetTracking,
  };
}
