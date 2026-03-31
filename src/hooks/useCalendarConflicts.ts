import { useState, useCallback, useEffect } from 'react';
import { checkCalendarConflicts, CalendarConflictResponse } from '../api/leaveDuplicates';
import { CalendarConflictData } from '../types/leave';
import { toLocalDateString } from '../utils/dateUtils';

export const useCalendarConflicts = (
  employeeId: string,
  month: string,
  year: string
) => {
  const [conflicts, setConflicts] = useState<CalendarConflictResponse['conflicts']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConflicts = useCallback(async () => {
    if (!employeeId || !month || !year) return;

    setLoading(true);
    setError(null);

    try {
      const response = await checkCalendarConflicts({
        checkType: 'calendar_month',
        month,
        year,
        employee_id: employeeId
      });

      setConflicts(response.conflicts);
    } catch (err: any) {
      setError(err.message || 'Failed to load calendar conflicts');
    } finally {
      setLoading(false);
    }
  }, [employeeId, month, year]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  // ✅ FIX: Use toLocalDateString instead of toISOString to avoid timezone shift
  const getDateConflictStatus = useCallback((date: Date) => {
    const dateStr = toLocalDateString(date);
    const conflict = conflicts.find(c => c.date === dateStr);
    return conflict?.status || 'available';
  }, [conflicts]);

  return {
    conflicts,
    loading,
    error,
    loadConflicts,
    getDateConflictStatus
  };
};