import { Handler } from '@netlify/functions';
import { createPerformanceIndexes, analyzeIndexUsage, verifyCriticalIndexes } from './utils/create-performance-indexes';
import { successResponse, errorResponse, handleCORS } from './utils/response';

/**
 * Performance Index Creation API
 *
 * POST /create-performance-indexes
 *
 * Usage:
 * - Creates database indexes for performance optimization
 * - Should be run during maintenance or deployment
 * - Requires admin privileges
 */
export const handler: Handler = async (event) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return handleCORS(event);
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    console.log('🚀 Starting performance index creation...');

    // Verify critical indexes first
    const indexesVerified = await verifyCriticalIndexes();
    if (indexesVerified) {
      console.log('✅ Critical indexes already exist');
      return successResponse({
        message: 'Critical indexes already exist',
        status: 'verified',
        action: 'none_needed'
      });
    }

    // Create all performance indexes
    const results = await createPerformanceIndexes();

    // Analyze index usage after creation
    const indexStats = await analyzeIndexUsage();

    // Calculate success metrics
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    const successRate = Math.round((successful / total) * 100);

    // Return comprehensive response
    return successResponse({
      message: 'Performance index creation completed',
      status: successRate === 100 ? 'success' : 'partial_success',
      metrics: {
        totalIndexes: total,
        successful: successful,
        failed: total - successful,
        successRate: `${successRate}%`
      },
      results: results,
      indexStats: indexStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error creating performance indexes:', error);

    return errorResponse(
      `Failed to create performance indexes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
};