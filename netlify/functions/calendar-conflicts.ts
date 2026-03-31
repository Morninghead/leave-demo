import { Handler } from '@netlify/functions';
import { successResponse, errorResponse, handleCORS } from './utils/response';

export const handler: Handler = async (event) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  // Redirect to the main duplicate checker function
  const calendarHandler = await import('./leave-request-check-duplicate');
  return calendarHandler.calendarHandler(event);
};