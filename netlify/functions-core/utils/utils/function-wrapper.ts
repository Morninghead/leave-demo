import { Handler } from '@netlify/functions';
import { logger } from './logger';

/**
 * Simple function wrapper for logging and error handling
 */
export function createHandler(handler: Handler): Handler {
  return async (event) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      logger.log(`[${requestId}] Function started`, {
        method: event.httpMethod,
        path: event.path
      });

      const result = await handler(event);

      const duration = Date.now() - startTime;
      logger.log(`[${requestId}] Function completed`, { duration });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[${requestId}] Function error`, { error: error.message, duration });

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          message: 'Internal server error',
          requestId,
        }),
      };
    }
  };
}