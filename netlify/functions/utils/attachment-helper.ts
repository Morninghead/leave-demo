/**
 * Attachment Helper Functions
 * 
 * Utilities for processing attachment data from leave requests
 */

/**
 * Get attachment count from various data formats
 * Handles both Array and JSON string formats from database
 */
export function getAttachmentCount(attachmentUrls: any): number {
    if (!attachmentUrls) return 0;

    if (Array.isArray(attachmentUrls)) {
        return attachmentUrls.length;
    }

    if (typeof attachmentUrls === 'string') {
        try {
            const parsed = JSON.parse(attachmentUrls);
            return Array.isArray(parsed) ? parsed.length : 0;
        } catch (e) {
            return 0;
        }
    }

    return 0;
}

/**
 * Check if leave request has attachments
 */
export function hasAttachments(attachmentUrls: any): boolean {
    return getAttachmentCount(attachmentUrls) > 0;
}

/**
 * Get attachment URLs as array
 */
export function getAttachmentUrls(attachmentUrls: any): string[] {
    if (!attachmentUrls) return [];

    if (Array.isArray(attachmentUrls)) {
        return attachmentUrls;
    }

    if (typeof attachmentUrls === 'string') {
        try {
            const parsed = JSON.parse(attachmentUrls);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    return [];
}
