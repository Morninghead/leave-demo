import { supabase } from './db';
import { logger } from './logger';

/**
 * Delete leave request attachments from Supabase Storage
 * 
 * @param attachmentUrls - Array of full URLs to attachments
 * @returns Object with success status and deleted/failed files
 */
export async function deleteLeaveAttachments(attachmentUrls: string[]): Promise<{
    success: boolean;
    deleted: string[];
    failed: string[];
}> {
    const result = {
        success: true,
        deleted: [] as string[],
        failed: [] as string[],
    };

    if (!attachmentUrls || attachmentUrls.length === 0) {
        logger.log('📎 No attachments to delete');
        return result;
    }

    logger.log(`🗑️ Deleting ${attachmentUrls.length} attachment(s) from storage...`);

    // Extract file paths from full URLs
    // URL format: https://xxx.supabase.co/storage/v1/object/public/leave-attachments/path/to/file.jpg
    const filePaths: string[] = [];

    for (const url of attachmentUrls) {
        try {
            const match = url.match(/\/storage\/v1\/object\/public\/leave-attachments\/(.+)$/);
            if (match && match[1]) {
                filePaths.push(match[1]);
            } else {
                // Try alternative pattern (without /public/)
                const altMatch = url.match(/\/leave-attachments\/(.+)$/);
                if (altMatch && altMatch[1]) {
                    filePaths.push(altMatch[1]);
                } else {
                    logger.warn(`⚠️ Could not extract file path from URL: ${url}`);
                    result.failed.push(url);
                }
            }
        } catch (err) {
            logger.warn(`⚠️ Error parsing URL: ${url}`, err);
            result.failed.push(url);
        }
    }

    if (filePaths.length === 0) {
        logger.log('📎 No valid file paths extracted for deletion');
        return result;
    }

    logger.log('📁 File paths to delete:', filePaths);

    // Delete files from Supabase Storage
    try {
        const { data, error } = await supabase.storage
            .from('leave-attachments')
            .remove(filePaths);

        if (error) {
            logger.error('❌ Storage deletion error:', error);
            result.success = false;
            result.failed.push(...filePaths);
        } else {
            logger.log('✅ Successfully deleted files:', data);
            result.deleted.push(...filePaths);
        }
    } catch (err: any) {
        logger.error('❌ Exception during storage cleanup:', err.message);
        result.success = false;
        result.failed.push(...filePaths);
    }

    logger.log(`🗑️ Cleanup complete - Deleted: ${result.deleted.length}, Failed: ${result.failed.length}`);

    return result;
}

/**
 * Get attachment URLs from leave request by ID
 * 
 * @param requestId - Leave request ID
 * @param query - Database query function
 * @returns Array of attachment URLs
 */
export async function getLeaveAttachmentUrls(
    requestId: string,
    queryFn: (sql: string, params: any[]) => Promise<any[]>
): Promise<string[]> {
    try {
        const result = await queryFn(
            `SELECT attachment_urls FROM leave_requests WHERE id = $1`,
            [requestId]
        );

        if (result.length > 0 && result[0].attachment_urls) {
            return result[0].attachment_urls as string[];
        }
    } catch (err: any) {
        logger.warn('⚠️ Error fetching attachment URLs:', err.message);
    }

    return [];
}
