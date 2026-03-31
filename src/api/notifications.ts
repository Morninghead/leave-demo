// src/api/notifications.ts
import { logger } from '../utils/logger';
import axios from 'axios';

const api = axios.create({
  baseURL: '/.netlify/functions',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  title_th: string;
  title_en: string;
  message_th: string;
  message_en: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationWithSender extends Notification {
  sender?: {
    first_name_th: string;
    last_name_th: string;
    employee_code: string;
  };
}

export async function getNotifications(limit = 20): Promise<NotificationWithSender[]> {
  try {
    const response = await api.get(`/notifications?limit=${limit}`);
    return response.data.notifications || [];
  } catch (error: any) {
    logger.error('❌ getNotifications error:', error);
    return [];
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const response = await api.get('/notifications/unread-count');
    return response.data.count || 0;
  } catch (error: any) {
    logger.error('❌ getUnreadCount error:', error);
    return 0;
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await api.put(`/notifications/${notificationId}/read`);
  } catch (error: any) {
    logger.error('❌ markAsRead error:', error);
  }
}

export async function markAllAsRead(): Promise<void> {
  try {
    await api.put('/notifications/read-all');
  } catch (error: any) {
    logger.error('❌ markAllAsRead error:', error);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await api.delete(`/notifications/${notificationId}`);
  } catch (error: any) {
    logger.error('❌ deleteNotification error:', error);
  }
}
