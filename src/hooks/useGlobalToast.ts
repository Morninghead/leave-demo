import { useEffect } from 'react';
import { useToast } from './useToast';
import { setGlobalToast } from '../utils/alertToToast';

/**
 * Hook to initialize global toast function
 * This enables non-React components to show toast notifications
 */
export function useGlobalToast() {
  const { showToast } = useToast();

  useEffect(() => {
    // Set the global toast function when component mounts
    setGlobalToast(showToast);

    return () => {
      // Clear global toast function when component unmounts
      setGlobalToast(() => { });
    };
  }, [showToast]);
}