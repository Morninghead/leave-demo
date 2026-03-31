// src/components/notifications/NotificationItem.tsx
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { Bell, CheckCircle, XCircle, Calendar, Users, ClipboardCheck } from 'lucide-react';
import { NotificationWithSender } from '../../api/notifications';

interface NotificationItemProps {
  notification: NotificationWithSender;
  onClick?: () => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  
  const title = isEnglish ? notification.title_en : notification.title_th;
  const message = isEnglish ? notification.message_en : notification.message_th;
  
  const getIcon = () => {
    if (notification.reference_type === 'probation_evaluation') {
      return <ClipboardCheck className="w-5 h-5 text-indigo-600" />;
    }

    switch (notification.type) {
      case 'leave_approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'leave_rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'shift_approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'shift_rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'leave_request':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'shift_request':
        return <Users className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: isEnglish ? enUS : th,
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
        !notification.is_read ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-1">{getIcon()}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium text-gray-900 ${!notification.is_read ? 'font-semibold' : ''}`}>
              {title}
            </p>
            {!notification.is_read && (
              <span className="shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1"></span>
            )}
          </div>
          
          <p className="mt-1 text-sm leading-6 text-gray-600 line-clamp-4 sm:line-clamp-2">
            {message}
          </p>
          
          <p className="text-xs text-gray-500 mt-2">
            {timeAgo}
          </p>
        </div>
      </div>
    </button>
  );
}

