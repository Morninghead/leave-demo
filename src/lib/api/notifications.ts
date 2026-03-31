// src/lib/api/notifications.ts
import { logger } from '../../utils/logger';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_DATABASE_URL);

// Get user from localStorage
const getUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error) {
    logger.error('Error getting user:', error);
    return null;
  }
};

// ✅ Get notifications
export const getNotifications = async (limit = 10) => {
  try {
    const user = getUser();

    if (!user || !user.id) {
      logger.warn('⚠️ No user found for notifications');
      return []; // ✅ Return empty array
    }

    logger.log('🔔 Fetching notifications for user:', user.id);

    const notifications = await sql`
      SELECT *
      FROM notifications
      WHERE recipient_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    logger.log(`✅ Loaded ${notifications.length} notifications`);
    return notifications;

  } catch (error) {
    logger.error('❌ getNotifications error:', error);
    return []; // ✅ Return empty array on error
  }
};

// ✅ Get unread count
export const getUnreadCount = async () => {
  try {
    const user = getUser();

    if (!user || !user.id) {
      logger.warn('⚠️ No user found for unread count');
      return 0; // ✅ Return 0
    }

    const result = await sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE recipient_id = ${user.id}
        AND is_read = false
    `;

    const count = Number(result[0]?.count) || 0;
    logger.log(`✅ Unread count: ${count}`);
    return count;

  } catch (error) {
    logger.error('❌ getUnreadCount error:', error);
    return 0; // ✅ Return 0 on error
  }
};

// ✅ Mark as read
export const markAsRead = async (notificationId: string) => {
  try {
    const user = getUser();

    if (!user || !user.id) {
      logger.warn('⚠️ No user found');
      return false;
    }

    await sql`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = ${notificationId}::uuid
        AND recipient_id = ${user.id}::uuid
    `;

    logger.log(`✅ Marked notification ${notificationId} as read`);
    return true;

  } catch (error) {
    logger.error('❌ markAsRead error:', error);
    return false;
  }
};

// ✅ Mark all as read
export const markAllAsRead = async () => {
  try {
    const user = getUser();

    if (!user || !user.id) {
      logger.warn('⚠️ No user found');
      return false;
    }

    await sql`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE recipient_id = ${user.id}::uuid
        AND is_read = false
    `;

    logger.log('✅ Marked all notifications as read');
    return true;

  } catch (error) {
    logger.error('❌ markAllAsRead error:', error);
    return false;
  }
};
