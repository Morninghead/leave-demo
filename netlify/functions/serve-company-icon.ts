import { Handler } from '@netlify/functions';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { supabase } from './utils/db';
import { generateIconSVG, generateIconPNG } from '../../src/utils/generateFavicons';

export const handler: Handler = async (event) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    const { type, iconName, backgroundColor, width, height, size } = JSON.parse(event.body || '{}');
    const requestedPath = event.path.split('/').pop();

    console.log('🎨 Company icon request:', { type, iconName, requestedPath, width, height, size });

    if (type === 'svg') {
      // Generate SVG icon
      const svgContent = generateIconSVG(iconName || 'Calendar', size || 32, backgroundColor || '#2563eb');

      return new Response(svgContent, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400', // 1 day cache
        }
      });
    } else if (type === 'png') {
      // Generate PNG placeholder
      const pngBase64 = generateIconPNG(width || 32, height || 32);

      return new Response(Buffer.from(pngBase64, 'base64'), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400', // 1 day cache
        }
      });
    } else {
      // Get company logo from Supabase storage
      const { data, error } = await supabase.storage
        .from('company-logo')
        .getPublicUrl('company-logo.png');

      if (error) {
        console.error('❌ Error fetching company logo from Supabase:', error);
        return errorResponse('Company logo not found', 404);
      }

      // Return redirect to Supabase URL
      return new Response('', {
        status: 302,
        headers: {
          'Location': data.publicUrl,
          'Cache-Control': 'public, max-age=86400', // 1 day cache
        }
      });
    }

  } catch (error: any) {
    console.error('❌ Company icon error:', error);
    return errorResponse('Failed to serve company icon', 500);
  }
};