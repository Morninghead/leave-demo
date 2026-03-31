// netlify/functions/notifications.ts
import { Handler } from '@netlify/functions';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { query } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';

export const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const user = event.user!;
  const method = event.httpMethod;
  const path = event.path.replace('/.netlify/functions/notifications', '');

  try {
    // GET /notifications
    if (method === 'GET' && path === '') {
      const limit = Number(event.queryStringParameters?.limit) || 20;
      
      const notifications = await query(
        `
        SELECT 
          n.*,
          e.first_name_th,
          e.last_name_th,
          e.first_name_en,
          e.last_name_en,
          e.employee_code
        FROM notifications n
        LEFT JOIN employees e ON n.sender_id = e.id
        WHERE n.recipient_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2
        `,
        [user.userId, limit]
      );

      return successResponse({ notifications });
    }

    // GET /notifications/unread-count
    if (method === 'GET' && path === '/unread-count') {
      const result = await query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE recipient_id = $1 AND is_read = false`,
        [user.userId]
      );

      return successResponse({ count: parseInt(result[0].count) || 0 });
    }

    // PUT /notifications/:id/read
    if (method === 'PUT' && path.match(/^\/[^/]+\/read$/)) {
      const notificationId = path.split('/')[1];

      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = NOW()
         WHERE id = $1 AND recipient_id = $2`,
        [notificationId, user.userId]
      );

      return successResponse({ success: true });
    }

    // PUT /notifications/read-all
    if (method === 'PUT' && path === '/read-all') {
      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = NOW()
         WHERE recipient_id = $1 AND is_read = false`,
        [user.userId]
      );

      return successResponse({ success: true });
    }

    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error('❌ Notifications API error:', error);
    return errorResponse(error.message, 500);
  }
});
