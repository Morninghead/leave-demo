// src/hooks/useSettings.ts
import { useState, useEffect, useContext } from 'react';
import { getSettings, Settings } from '../api/settings';
import { AuthContext } from '../contexts/AuthContext';

// Simple in-memory cache to prevent duplicate requests
let settingsCache: Settings | null = null;
let settingsPromise: Promise<Settings | null> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useSettings() {
  const { user } = useContext(AuthContext);
  const [settings, setSettings] = useState<Settings | null>(settingsCache);
  const [loading, setLoading] = useState(!settingsCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If there's no user, don't fetch settings and clear cache
    if (!user) {
      setSettings(null);
      setLoading(false);
      setError(null);
      settingsCache = null;
      cacheTimestamp = 0;
      return;
    }

    // If we have valid cache, return it
    if (settingsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setSettings(settingsCache);
      setLoading(false);
      return;
    }

    // If there's already a pending request, reuse it
    if (settingsPromise) {
      settingsPromise
        .then(data => {
          if (data) {
            setSettings(data);
            settingsCache = data;
            cacheTimestamp = Date.now();
          }
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
      return;
    }

    // Otherwise, make a new request
    const fetchSettings = async () => {
      try {
        settingsPromise = getSettings();
        const data = await settingsPromise;

        if (data) {
          setSettings(data);
          settingsCache = data;
          cacheTimestamp = Date.now();
        }
        setLoading(false);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        setError(err.message || 'Failed to load settings');
        setLoading(false);
      } finally {
        settingsPromise = null;
      }
    };

    fetchSettings();
  }, [user?.id]); // More stable dependency - only refetch when actual user changes

  return { settings, loading, error, refetch: () => {
    // Force refetch by clearing cache
    settingsCache = null;
    settingsPromise = null;
    cacheTimestamp = 0;

    // Trigger a refetch
    getSettings()
      .then(data => {
        if (data) {
          setSettings(data);
          settingsCache = data;
          cacheTimestamp = Date.now();
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }};
}