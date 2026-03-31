import { getDaysInMonth } from 'date-fns';

// Helper function to convert Date to local date string (YYYY-MM-DD)
// Avoids timezone shift issues with toISOString()
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface DateSuggestion {
  date: string;
  score: number; // 0-100, higher is better
  reason: string;
  alternatives: {
    type: 'earlier_date' | 'later_date' | 'shorter_duration';
    suggestion: string;
    description: string;
  }[];
  conflictInfo?: {
    conflictingEmployees: string;
    conflictTypes: string[];
  };
}

/**
 * Calculate score for suggested alternative dates
 * Based on multiple factors: days until weekend, proximity to current date, etc.
 */
const calculateDateScore = (suggestedDate: Date, currentDate: Date = new Date()): number => {
  const daysDiff = Math.floor((currentDate.getTime() - suggestedDate.getTime()) / (1000 * 60 * 60));
  let score = Math.max(0, 100 - (daysDiff * 3)); // Further dates get lower scores

  // Bonus points for specific conditions
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Prefer weekdays over weekends
  const isWeekend = suggestedDate.getDay() === 0 || suggestedDate.getDay() === 6;
  if (!isWeekend) score += 15;

  // Prefer dates further in the future (more time to plan)
  if (daysDiff > 7) score += 10;
  else if (daysDiff > 14) score += 20; // Give extra points for far future dates

  // Penalize dates that are too close to current date
  if (daysDiff < 3) score -= 20; // Avoid very last-minute requests

  // Prefer same or next week for easier planning
  const currentWeek = Math.floor(currentDate.getDate() / 7);
  const suggestedWeek = Math.floor(suggestedDate.getDate() / 7);
  if (Math.abs(currentWeek - suggestedWeek) <= 1) score += 10;

  return Math.min(100, score);
};

/**
 * Generate smart suggestions for alternative dates
 */
export const generateDateSuggestions = (
  requestedDate: Date,
  conflictingEmployees: Array<{
    employee_firstname: string;
    employee_lastname: string;
    leave_type_name: string;
    status: string;
  }>,
  currentEmployeeId: string
): DateSuggestion[] => {
  const currentDate = new Date();
  const suggestions: DateSuggestion[] = [];

  // Generate alternative dates
  for (let daysAhead = 1; daysAhead <= 30; daysAhead++) {
    const suggestedDate = new Date(requestedDate);
    suggestedDate.setDate(suggestedDate.getDate() + daysAhead);

    // Skip weekends and holidays
    if (suggestedDate.getDay() === 0 || suggestedDate.getDay() === 6) continue;
    if (suggestedDate < currentDate) continue;

    const score = calculateDateScore(suggestedDate, requestedDate);

    if (score > 30) { // Only suggest decent alternatives
      const suggestionType: 'earlier_date' | 'later_date' = daysAhead <= 7 ? 'later_date' : 'earlier_date';
      const suggestion = daysAhead <= 7
        ? `Try ${daysAhead} ${daysAhead === 1 ? 'day' : 'days'} later`
        : `Request ${daysAhead} ${daysAhead === 1 ? 'day' : 'days'} earlier`;
      const description = daysAhead <= 7
        ? (daysAhead === 1
          ? 'More time to plan your leave, better availability'
          : `Further ahead gives more planning time and better chance of approval`)
        : (daysAhead === 1
          ? 'Request sooner for better approval chances'
          : `Move your request earlier to avoid conflicts`);

      const conflictInfo = conflictingEmployees.length > 0 ? {
        conflictingEmployees: conflictingEmployees.map(emp => `${emp.employee_firstname} ${emp.employee_lastname}`).slice(0, 3).join(', '),
        conflictTypes: [...new Set(conflictingEmployees.map(emp => emp.leave_type_name))],
      } : undefined;

      // ✅ FIX: Use toLocalDateString instead of toISOString to avoid timezone shift
      suggestions.push({
        date: toLocalDateString(suggestedDate),
        score,
        reason: `Date is ${daysAhead} ${daysAhead === 1 ? 'day' : 'days'} ${suggestionType.includes('earlier') ? 'before' : 'after'} requested date`,
        alternatives: [{
          type: suggestionType,
          suggestion,
          description
        }],
        conflictInfo
      });
    }
  }

  // Sort by score (highest first)
  return suggestions.sort((a, b) => b.score - a.score);
};

/**
 * Generate shorter duration alternatives
 * For when user can only take partial leave
 */
export const generateDurationAlternatives = (
  requestedStartDate: Date,
  requestedEndDate: Date,
  conflictingRequests: Array<any>
): DateSuggestion[] => {
  const alternatives: DateSuggestion[] = [];

  // Suggest splitting long requests into shorter ones
  const totalDays = Math.ceil((requestedEndDate.getTime() - requestedStartDate.getTime()) / (1000 * 60 * 60 * 24));

  if (totalDays > 1) {
    const halfDay1 = new Date(requestedStartDate);
    const halfDay2 = new Date(requestedStartDate);
    halfDay2.setDate(halfDay2.getDate() + Math.ceil(totalDays / 2));

    [halfDay1, halfDay2].forEach((date, index) => {
      const score = 80 - index; // Earlier dates get slightly better scores

      const conflictInfo = conflictingRequests.length > 0 ? {
        conflictingEmployees: conflictingRequests.slice(0, 3).map(emp => `${emp.employee_firstname} ${emp.employee_lastname}`).join(', '),
        conflictTypes: [...new Set(conflictingRequests.map(req => req.leave_type_name))],
      } : undefined;

      alternatives.push({
        // ✅ FIX: Use toLocalDateString instead of toISOString to avoid timezone shift
        date: toLocalDateString(date),
        score,
        reason: `Split request into ${Math.ceil(totalDays / 2)}-day periods (${index + 1}/${Math.ceil(totalDays / 2)})`,
        alternatives: [{
          type: 'shorter_duration',
          suggestion: `${Math.ceil(totalDays / 2)} ${Math.ceil(totalDays / 2)}-day leave request`,
          description: `More manageable duration, easier approval, fewer conflicts with other requests`
        }],
        conflictInfo
      });
    });
  }

  return alternatives.sort((a, b) => b.score - a.score);
};

/**
 * Find optimal dates based on team availability
 * Checks for dates with minimal conflicts across the team
 */
export const findOptimalDates = (
  teamSize: number,
  requestedDuration: number,
  minNoticeDays: number = 3,
  existingRequests: Array<any>
): { optimalDates: Date[], recommendations: string[] } => {
  const optimalDates: Date[] = [];
  const recommendations: string[] = [];

  // Simple algorithm: check dates starting from min notice period
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + minNoticeDays);

  // Check the next 60 days
  for (let daysOffset = 0; daysOffset < 60; daysOffset++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(startDate.getDate() + daysOffset);

    // Count how many team members would be on leave
    const conflictsOnDate = existingRequests.filter(req => {
      const reqStart = new Date(req.start_date);
      const reqEnd = new Date(req.end_date);
      return checkDate >= reqStart && checkDate <= reqEnd;
    }).length;

    // Date is optimal if conflicts are minimal
    const maxConflicts = Math.max(1, Math.floor(teamSize * 0.2)); // Allow 20% of team to be on leave
    if (conflictsOnDate <= maxConflicts) {
      optimalDates.push(checkDate);
    }
  }

  // Sort by score and take top 5
  optimalDates.sort((a, b) => {
    return b.getTime() - a.getTime();
  });

  if (optimalDates.length === 0) {
    recommendations.push('No optimal dates found in the next 60 days. Consider requesting further in advance.');
  } else {
    recommendations.push(`Best dates: ${optimalDates.slice(0, 5).map(d => d.toLocaleDateString()).join(', ')}`);
  }

  return { optimalDates, recommendations };
};
