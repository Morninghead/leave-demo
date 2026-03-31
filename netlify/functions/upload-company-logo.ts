import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const uploadCompanyLogo = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // Only HR and Admin can upload company logo
  const userRole = event.user?.role;
  if (!['hr', 'admin'].includes(userRole || '')) {
    return errorResponse('Permission denied. Only HR and Admin can upload company logo', 403);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { file, fileName } = body;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    // Validate file is base64
    if (!file.startsWith('data:image/')) {
      return errorResponse('Invalid file format. Must be an image', 400);
    }

    // Extract mime type and base64 data
    const matches = file.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return errorResponse('Invalid base64 file format', 400);
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 5MB)
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return errorResponse('File size must be less than 5MB', 400);
    }

    // Get file extension from mime type
    const ext = mimeType.split('/')[1] || 'png';
    const finalFileName = fileName || `company-logo.${ext}`;

    // Create Supabase client with service key (has full access)
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('Supabase configuration missing', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📤 Uploading company logo to Supabase...');
    console.log(`   File name: ${finalFileName}`);
    console.log(`   File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   MIME type: ${mimeType}`);

    // Upload file (upsert to replace existing)
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(finalFileName, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true, // Replace existing file
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return errorResponse(`Upload failed: ${uploadError.message}`, 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(finalFileName);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    console.log('✅ Upload successful!');
    console.log(`   Public URL: ${publicUrl}`);

    return successResponse({
      success: true,
      publicUrl,
      message: 'Company logo uploaded successfully'
    });

  } catch (error: any) {
    console.error('❌ Upload company logo error:', error);
    return errorResponse(error.message || 'Failed to upload company logo', 500);
  }
};

export const handler: Handler = requireAuth(uploadCompanyLogo);
