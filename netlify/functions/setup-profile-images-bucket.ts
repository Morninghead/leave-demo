import { Handler } from '@netlify/functions';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent, isHROrAdmin } from './utils/auth-middleware';
import { createClient } from '@supabase/supabase-js';

/**
 * Setup Profile Images Bucket in Supabase
 * Creates the 'profile-images' bucket and sets up proper policies
 * Admin/HR only
 */

const setupProfileImagesBucket = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  // Only admin and hr can run setup
  if (!isHROrAdmin(event)) {
    return errorResponse('Only administrators and HR can setup storage buckets', 403);
  }

  if (event.httpMethod === 'GET') {
    // Check bucket status
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

      if (!supabaseUrl || !supabaseServiceKey) {
        return errorResponse('Supabase environment variables not configured', 500);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Try to list buckets (this will show if connection works)
      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) {
        return errorResponse('Failed to connect to Supabase Storage: ' + error.message, 500);
      }

      const profileImagesBucket = buckets?.find(b => b.name === 'profile-images');

      return successResponse({
        success: true,
        message: 'Supabase Storage connection successful',
        buckets: buckets,
        profileImagesBucketExists: !!profileImagesBucket,
        environmentConfigured: {
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey
        }
      });

    } catch (error: any) {
      return errorResponse('Error checking Supabase Storage: ' + error.message, 500);
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

      if (!supabaseUrl || !supabaseServiceKey) {
        return errorResponse('Supabase environment variables not configured', 500);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Create the profile-images bucket
      const { data, error } = await supabase.storage.createBucket('profile-images', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });

      if (error) {
        // Check if bucket already exists
        if (error.message.includes('already exists')) {
          return successResponse({
            message: 'Profile images bucket already exists',
            bucket: 'profile-images'
          });
        }
        return errorResponse('Failed to create bucket: ' + error.message, 500);
      }

      return successResponse({
        message: 'Profile images bucket created successfully',
        bucket: data,
        note: 'The bucket is now ready for profile image uploads'
      });

    } catch (error: any) {
      return errorResponse('Error creating bucket: ' + error.message, 500);
    }
  }

  return errorResponse('Method not allowed', 405);
};

export const handler: Handler = requireAuth(setupProfileImagesBucket);