// src/components/notifications/NotificationDropdown.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDevice } from '../../contexts/DeviceContext';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  NotificationWithSender
} from '../../api/notifications';
import { NotificationItem } from './NotificationItem';
import { canApprove } from '../../utils/permissions';

export function NotificationDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ Get user from AuthContext
  const { isMobile } = useDevice();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationWithSender[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const notificationsRequestIdRef = useRef(0);
  const unreadRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async (limit = 20) => {
    if (!user) return;

    const requestId = ++notificationsRequestIdRef.current;
    setLoading(true);
    try {
      const data = await getNotifications(limit);
      if (!mountedRef.current || requestId !== notificationsRequestIdRef.current) {
        return;
      }
      setNotifications(data);
    } catch (error) {
      if (mountedRef.current && requestId === notificationsRequestIdRef.current) {
        console.error('Failed to load notifications:', error);
      }
    } finally {
      if (mountedRef.current && requestId === notificationsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;

    const requestId = ++unreadRequestIdRef.current;
    try {
      const count = await getUnreadCount();
      if (!mountedRef.current || requestId !== unreadRequestIdRef.current) {
        return;
      }
      setUnreadCount(count);
    } catch (error) {
      if (mountedRef.current && requestId === unreadRequestIdRef.current) {
        console.error('Failed to load unread count:', error);
      }
    }
  }, [user]);

  // ✅ Load notifications when user is authenticated
  useEffect(() => {
    // Guard: Only load if user is authenticated
    if (!user) {
      console.log('⚠️ User not authenticated, skipping notification load');
      return;
    }

    loadNotifications();
    loadUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      if (user) {
        Promise.all([
          loadUnreadCount(),
          ...(isOpen ? [loadNotifications()] : []),
        ]).catch(() => undefined);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, isOpen, loadNotifications, loadUnreadCount]); // ✅ Re-run when user changes

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: NotificationWithSender) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      await loadNotifications();
      await loadUnreadCount();
    }

    // Navigate based on notification type and user permissions
    if (notification.reference_type === 'leave_request' && notification.type.includes('request')) {
      // Only navigate to approval if user has approval permissions
      if (canApprove(user)) {
        navigate('/approval'); // Navigate to unified approval dashboard
      } else {
        navigate('/leave'); // Navigate to their own leave requests
      }
    } else if (notification.reference_type === 'shift_request' && notification.type.includes('request')) {
      // Only navigate to approval if user has approval permissions
      if (canApprove(user)) {
        navigate('/approval'); // Navigate to unified approval dashboard
      } else {
        navigate('/shift'); // Navigate to their own shift requests
      }
    } else if (notification.reference_type === 'probation_evaluation') {
      if (notification.reference_id) {
        navigate(`/probation-evaluations/${notification.reference_id}`);
      } else {
        navigate('/probation-evaluations');
      }
    } else if (notification.reference_type === 'leave_request') {
      navigate('/leave');
    } else if (notification.reference_type === 'shift_request') {
      navigate('/shift');
    }

    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // ✅ Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {isMobile && (
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setIsOpen(false)}
            />
          )}
          <div
            className={`z-50 overflow-hidden border border-gray-200 bg-white shadow-lg ${
              isMobile
                ? 'fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] max-h-[calc(100vh-6rem-env(safe-area-inset-bottom,0px))] rounded-2xl'
                : 'absolute right-0 mt-2 w-96 rounded-lg'
            }`}
          >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('notifications.title')}
              </h3>
              {notifications.length > 0 && (
                <p className="text-xs text-gray-500">
                  {unreadCount > notifications.length
                    ? `${notifications.length} latest items`
                    : `${notifications.length} items`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('notifications.markAllRead')}</span>
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className={`${isMobile ? 'max-h-[calc(100vh-12rem)]' : 'max-h-96'} overflow-y-auto`}>
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('notifications.empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('notifications.viewAll')}
              </button>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}
