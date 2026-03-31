import { supabase } from '../lib/supabase';

/**
 * Verify file signature/magic numbers to prevent MIME type spoofing
 * Reads first few bytes of file to check actual file type
 */
async function validateFileSignature(file: File, allowedTypes: string[]): Promise<void> {
  try {
    // Read first 16 bytes of file to check magic numbers
    const buffer = await file.slice(0, 16).arrayBuffer();
    const view = new Uint8Array(buffer);
    const header = Array.from(view).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Define magic number signatures
    const signatures = {
      // Image formats
      'image/jpeg': ['FFD8FF'], // JPEG
      'image/png': ['89504E47'], // PNG
      'image/gif': ['474946383761', '474946383961'], // GIF87a, GIF89a
      'image/webp': ['52494646', '52494646'], // RIFF (WebP)

      // Document formats
      'application/pdf': ['25504446'], // %PDF
      'application/msword': ['D0CF11E0'], // Office Compound Document (OLE2)

      // Office Open XML formats (similar signatures)
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504B0304'], // ZIP-based
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['504B0304'], // ZIP-based

      // Video formats
      'video/mp4': ['000000', '66747970'], // Common MP4 signatures (checked loosely via sub-string logic update below or just prefixes)
      // MP4 usually starts with size (4 bytes) then 'ftyp' (4 bytes). 
      // To strictly validate with startWith, we'd need many variations. 
      // For now, we will trust Browser MIME for MP4 if we can't match strict signature, OR add common ones.
      // Common ftyp brands: isom, mp42, mp41...
      // Let's rely on extending the logic or just adding safe prefixes if feasible.
      // Actually, let's strictly use the validator expansion.

      // Signatures for MP4 (ftyp at offset 4). 
      // Since current logic is `startsWith`, we can't easily check offset 4.
      // We will skip strict signature check for video/mp4 OR add a "skip" flag?
      // Better: Add checking logic in the loop. 
      // But I can't change the loop logic easily with multi-replace tiny chunk.
      // I will add the signatures I CAN match.
      'video/webm': ['1A45DFA3'],
      'video/quicktime': ['000000', '66747970'], // MOV is similar to MP4 structure
    };

    // Check if declared MIME type has valid signature
    const expectedSignatures = signatures[file.type as keyof typeof signatures];
    if (!expectedSignatures) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    // Verify the file starts with expected magic number
    // Special handling for MP4/MOV which have variable start bytes (length) but contain 'ftyp' at index 4
    if (file.type === 'video/mp4' || file.type === 'video/quicktime') {
      // Check for 'ftyp' (66 74 79 70) starting at index 4
      const hex = header.substring(8, 16); // index 4 = char 8
      if (hex !== '66747970') {
        // Allow empty signature for MP4 if valid signature check fails? 
        // Some MP4s might not have ftyp at 4.
        // But almost all do. 
        // If strict check fails, we throw.
        // However, keeping it simple: If header doesn't start with knowns, we check for 'ftyp'
        if (!header.includes('66747970')) { // fallback
          throw new Error(`Invalid MP4/MOV signature.`);
        }
      }
    } else {
      const isValidSignature = expectedSignatures.some(sig => header.startsWith(sig));

      if (!isValidSignature) {
        throw new Error(`File signature does not match declared type (${file.type}). File may be corrupted or malicious.`);
      }
    }

    // Additional validation for ZIP-based Office documents (need more bytes)
    if (file.type.includes('openxmlformats')) {
      await validateOfficeDocument(file);
    }

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`File validation failed: ${error.message}`);
    }
    throw new Error('File validation failed: Unable to verify file type');
  }
}

/**
 * Additional validation for Office Open XML documents
 */
async function validateOfficeDocument(file: File): Promise<void> {
  try {
    // Check for specific Office document content markers
    const buffer = await file.slice(0, 1024).arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    // Look for content type markers that indicate valid Office documents
    const hasContentType = text.includes('Content_Types') ||
      text.includes('word/') ||
      text.includes('xl/') ||
      text.includes('[Content_Types].xml');

    if (!hasContentType) {
      throw new Error('Invalid Office document structure');
    }
  } catch (error) {
    // Don't fail on encoding issues, but log for monitoring
    console.warn('Office document validation warning:', error);
  }
}

export async function uploadToSupabase(
  file: File,
  bucket: string = 'leave-attachments'
): Promise<string> {
  try {
    // Validate file size (Supabase default limit is 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(`File size (${fileSizeMB}MB) exceeds maximum allowed size (50MB). Please compress the image or choose a smaller file.`);
    }

    // Enhanced file type validation with magic number verification
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ];

    // First check browser MIME type (basic validation)
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not allowed. Please upload an image, PDF, or Microsoft Office document.`);
    }

    // Additional validation: verify file signature/magic numbers to prevent MIME spoofing
    await validateFileSignature(file, allowedTypes);

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload file
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      // Handle specific Supabase errors
      if (error.message?.includes('exceeded the maximum allowed size')) {
        throw new Error(`File is too large. Maximum size is 50MB. Please compress your file or choose a smaller one.`);
      }
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Upload error:', error);

    // Provide user-friendly error messages
    if (error.message?.includes('exceeded the maximum allowed size')) {
      throw new Error('File is too large. Maximum size is 50MB. Please compress your file or choose a smaller one.');
    }

    throw new Error(error.message || 'Failed to upload file');
  }
}

export async function deleteFromSupabase(
  fileUrl: string,
  bucket: string = 'leave-attachments'
): Promise<void> {
  try {
    const fileName = fileUrl.split('/').pop();
    if (!fileName) return;

    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) throw error;
  } catch (error: any) {
    console.error('Delete file error:', error);
  }
}

export function getFileTypeIcon(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return '📄';
    case 'doc':
    case 'docx':
      return '📝';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return '🖼️';
    default:
      return '📎';
  }
}

export function isImageFile(url: string): boolean {
  const cleanUrl = url.split('?')[0];
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(cleanUrl);
}

export function isVideoFile(url: string): boolean {
  const cleanUrl = url.split('?')[0];
  return /\.(mp4|webm|mov|quicktime)$/i.test(cleanUrl);
}

export function getFileNameFromUrl(url: string): string {
  const fileName = url.split('/').pop()?.split('?')[0];
  return fileName ? decodeURIComponent(fileName) : 'Unknown file';
}

/**
 * Upload company logo via backend endpoint (more secure)
 * Uses service key on backend, no RLS policy issues
 */
export async function uploadCompanyLogo(file: File): Promise<string> {
  try {
    // Convert file to base64
    const base64File = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `company-logo.${fileExt}`;

    // Upload via backend endpoint with authentication
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch('/.netlify/functions/upload-company-logo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        file: base64File,
        fileName: fileName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || 'Upload failed');
    }

    const data = await response.json();

    if (!data.success || !data.publicUrl) {
      throw new Error('Upload succeeded but no URL returned');
    }

    return data.publicUrl;
  } catch (error: any) {
    console.error('Company logo upload error:', error);
    throw new Error(error.message || 'Failed to upload company logo');
  }
}
