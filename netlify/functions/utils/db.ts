import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

// Initialize Neon database client
// Return a safe default that will throw helpful errors at runtime, not module load time
let sql: ReturnType<typeof neon>;
try {
  if (!process.env.NEON_DATABASE_URL) {
    console.error('❌ Missing NEON_DATABASE_URL environment variable');
    // Create a placeholder that will throw at query time, not module load time
    sql = (() => {
      throw new Error('NEON_DATABASE_URL environment variable is not set');
    }) as any;
  } else {
    sql = neon(process.env.NEON_DATABASE_URL);
  }
} catch (error) {
  console.error('❌ Failed to initialize Neon client:', error);
  sql = (() => {
    throw new Error('Failed to initialize database client');
  }) as any;
}

export { sql };

// Initialize Supabase client for storage operations
// Handle missing env vars gracefully - log warning but don't throw at module load
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Missing Supabase environment variables - storage operations will fail:', {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY
  });
  // Create a placeholder client that will throw helpful errors at usage time
  supabase = {
    storage: {
      from: () => {
        throw new Error('Supabase not configured - missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      }
    }
  } as any;
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  try {
    const result = await sql(text, params);
    return result as T[];
  } catch (error: any) {
    // Log detailed error for debugging
    console.error('Database query error:', {
      error: error.message,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      // Don't log full params in production for security
      paramCount: params?.length || 0
    });

    // Don't expose sensitive database details to clients
    // Create safe error messages based on common database errors
    let safeErrorMessage = 'Database operation failed';

    if (error.code === '23505') {
      // Unique constraint violation - extract detailed information
      // PostgreSQL detail format: Key (column_name)=(value) already exists.
      let fieldInfo = '';
      const detail = error.detail || '';
      const constraint = error.constraint || '';

      // Try to extract field name and value from detail
      const detailMatch = detail.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
      if (detailMatch) {
        const fieldName = detailMatch[1];
        const fieldValue = detailMatch[2];
        fieldInfo = ` (${fieldName}: ${fieldValue})`;
      } else if (constraint) {
        // Fall back to constraint name if detail parsing fails
        // Common patterns: employees_employee_code_key, employees_email_key
        const constraintMatch = constraint.match(/([a-z_]+)_key$/);
        if (constraintMatch) {
          fieldInfo = ` (${constraintMatch[1]})`;
        } else {
          fieldInfo = ` (${constraint})`;
        }
      }

      safeErrorMessage = `Record already exists${fieldInfo}`;
    } else if (error.code === '23503') {
      safeErrorMessage = 'Referenced record does not exist';
    } else if (error.code === '23502') {
      safeErrorMessage = 'Required field is missing';
    } else if (error.code === '23514') {
      safeErrorMessage = 'Data validation failed';
    } else if (error.code?.startsWith('28')) {
      safeErrorMessage = 'Authentication error';
    } else if (error.code?.startsWith('40')) {
      safeErrorMessage = 'Database connection error';
    } else if (process.env.NODE_ENV !== 'production') {
      // In development, provide more context but still safe
      safeErrorMessage = `Database error: ${error.message}`;
    }

    // Throw a safe error that won't expose sensitive information
    const safeError = new Error(safeErrorMessage);
    (safeError as any).originalError = error; // Keep original for debugging
    (safeError as any).isDatabaseError = true;
    throw safeError;
  }
}
