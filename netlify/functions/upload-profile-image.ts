import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Upload Profile Image
 * Allows users to upload their profile picture
 */
const uploadProfileImage = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const userId = event.user?.userId;
  const employeeCode = event.user?.employeeCode;

  if (!userId || !employeeCode) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
      keepExtensions: true
    });

    // Note: Netlify Functions receive the body as a base64-encoded string for binary data
    // We need to handle this differently in serverless environment

    // For simplicity, we'll expect the image to be sent as base64 in JSON
    const body = JSON.parse(event.body || '{}');
    const { imageData, fileName, mimeType } = body;

    if (!imageData) {
      return errorResponse('No image data provided', 400);
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData.split(',')[1] || imageData, 'base64');

    // Generate unique filename
    const fileExt = fileName?.split('.').pop() || 'jpg';
    const uniqueFileName = `profile-${employeeCode}-${Date.now()}.${fileExt}`;
    const filePath = `profile-images/${uniqueFileName}`;

    // Check environment variables first
    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Missing Supabase environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      });
      return errorResponse('Supabase configuration missing', 500);
    }

    logger.log('Uploading profile image for user:', employeeCode);

    // First, check if bucket exists and create if needed
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.find(b => b.name === 'profile-images');

      if (!bucketExists) {
        logger.log('Creating profile-images bucket...');
        const { error: createError } = await supabase.storage.createBucket('profile-images', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        });

        if (createError && !createError.message.includes('already exists')) {
          logger.error('Failed to create bucket:', createError);
          return errorResponse('Failed to create storage bucket: ' + createError.message, 500);
        }
      }
    } catch (bucketError: any) {
      logger.error('Error checking/creating bucket:', bucketError);
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, imageBuffer, {
        contentType: mimeType || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      logger.error('Supabase upload error:', {
        error: uploadError,
        message: uploadError.message,
        bucket: 'profile-images',
        filePath
      });

      // Check specific error types
      if (uploadError.message.includes('The resource was not found') ||
          uploadError.message.includes('no such bucket')) {
        return errorResponse('Profile images bucket does not exist. Please run bucket setup first.', 404);
      } else if (uploadError.message.includes('permission_denied') ||
                 uploadError.message.includes('Forbidden')) {
        return errorResponse('Permission denied. Please check bucket policies.', 403);
      }

      return errorResponse('Failed to upload image: ' + uploadError.message, 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    const profileImageUrl = urlData.publicUrl;

    // Update user profile with new image URL
    await query(
      `UPDATE employees
       SET profile_image_url = $1, updated_at = NOW()
       WHERE id = $2`,
      [profileImageUrl, userId]
    );

    logger.log('Profile image uploaded successfully:', profileImageUrl);

    return successResponse({
      message: 'Profile image uploaded successfully',
      profile_image_url: profileImageUrl
    });

  } catch (error: any) {
    logger.error('Error uploading profile image:', error);
    return errorResponse('Failed to upload profile image: ' + error.message, 500);
  }
};

export const handler: Handler = requireAuth(uploadProfileImage);
