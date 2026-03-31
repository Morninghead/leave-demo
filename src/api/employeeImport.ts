import { logger } from '../utils/logger';

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface DuplicateError {
  row: number;
  employeeCode: string;
  name: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  step?: 'validation' | 'duplicate_check' | 'completed';
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportError[];
  duplicates: DuplicateError[];
  syncResult?: {
    balancesCreated: number;
    balancesUpdated: number;
    employeesProcessed: number;
  } | null;
  batch?: {
    start: number;
    end: number;
    size: number;
    hasMore: boolean;
    nextStart: number | null;
    totalProcessed: number;
    totalRemaining: number;
  };
}

// Helper function to wait/sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Transient error codes that should be retried
const TRANSIENT_ERRORS = [502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// Import a single batch with retry logic
const importBatch = async (file: File, batchStart: number = 0): Promise<ImportResult> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  // Convert file to base64 (only on first batch to avoid re-reading)
  const base64File = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const url = batchStart > 0
    ? `/.netlify/functions/employee-import?batch_start=${batchStart}`
    : '/.netlify/functions/employee-import';

  // ============================================================================
  // RETRY LOGIC: Retry transient errors (502, 503, 504) up to 3 times
  // ============================================================================
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ file: base64File }),
      });

      // Check if this is a transient error that should be retried
      if (TRANSIENT_ERRORS.includes(response.status) && attempt < MAX_RETRIES) {
        logger.log(`[IMPORT] Transient error ${response.status} on attempt ${attempt}/${MAX_RETRIES}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      // Process the response
      return await processImportResponse(response);
    } catch (fetchError: any) {
      // Network error - retry
      lastError = fetchError;
      if (attempt < MAX_RETRIES) {
        logger.log(`[IMPORT] Network error on attempt ${attempt}/${MAX_RETRIES}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Import failed after multiple retries');
};

// Process the fetch response
const processImportResponse = async (response: Response): Promise<ImportResult> => {

  // ============================================================================
  // FIX: Handle non-JSON responses (HTML error pages from 504/502/500 etc)
  // ============================================================================
  const contentType = response.headers.get('content-type') || '';
  let data: any;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    // Non-JSON response - likely HTML error page from gateway timeout/error
    const textBody = await response.text();
    logger.error(`[IMPORT] Non-JSON response (${response.status}):`, textBody.substring(0, 200));

    const errorMessage = (() => {
      switch (response.status) {
        case 504:
          return 'Gateway Timeout - เซิร์ฟเวอร์ใช้เวลาตอบกลับนานเกินไป กรุณาลองใหม่อีกครั้ง / Server took too long to respond. Please try again.';
        case 502:
          return 'Bad Gateway - ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ / Could not connect to server.';
        case 500:
          return 'Internal Server Error - เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ / Internal server error occurred.';
        case 503:
          return 'Service Unavailable - บริการไม่พร้อมใช้งานชั่วคราว / Service temporarily unavailable.';
        default:
          return `HTTP Error ${response.status} - เกิดข้อผิดพลาด กรุณาลองใหม่ / An error occurred. Please try again.`;
      }
    })();

    throw new Error(errorMessage);
  }

  // Handle different response status codes
  // 400 = validation errors, 409 = duplicates - these are expected responses with detailed error info
  if (response.status === 400 || response.status === 409) {
    // Return the data as ImportResult - it contains detailed error information
    logger.log(`[IMPORT] Received status ${response.status}:`, data.step || 'unknown step');
    return data as ImportResult;
  }

  // For other error status codes (401, 403, 500, etc.), throw an error
  if (!response.ok) {
    throw new Error(data.message || `HTTP error! status: ${response.status}`);
  }

  return data;
};

// Main import function with batch processing and 5-second delays
export const importEmployees = async (
  file: File,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ImportResult> => {
  try {
    let batchStart = 0;
    let hasMore = true;
    let totalSuccess = 0;
    let totalFailed = 0;
    const allErrors: ImportError[] = [];
    let lastResult: ImportResult | null = null;

    while (hasMore) {
      logger.log(`[IMPORT] Processing batch starting at ${batchStart}...`);

      // Call API for this batch
      const result = await importBatch(file, batchStart);
      lastResult = result;

      // Exit early if validation or duplicate check failed (only happens on first batch)
      if (result.step === 'validation' || result.step === 'duplicate_check') {
        logger.log(`[IMPORT] Import stopped at step: ${result.step}`);
        return result;
      }

      // Accumulate results
      totalSuccess += result.successCount;
      totalFailed += result.errorCount;
      allErrors.push(...result.errors);

      // Update progress
      if (onProgress && result.batch) {
        onProgress(
          result.batch.totalProcessed,
          result.totalRows,
          result.message
        );
      }

      // Check if there are more batches
      hasMore = result.batch?.hasMore || false;
      batchStart = result.batch?.nextStart || 0;

      // Wait 5 seconds before next batch (to avoid overwhelming the server)
      if (hasMore) {
        logger.log(`[IMPORT] Waiting 5 seconds before next batch...`);
        await sleep(5000);
      }
    }

    // Return final aggregated result
    return {
      ...lastResult!,
      successCount: totalSuccess,
      errorCount: totalFailed,
      errors: allErrors,
      message: `Import complete! Successfully imported ${totalSuccess} employees with leave balances.${totalFailed > 0 ? ` ${totalFailed} failed.` : ''}`
    };

  } catch (error: any) {
    logger.error('Import employees error:', error);
    throw new Error(error.message || 'Failed to import employees');
  }
};
