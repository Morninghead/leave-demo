import { useTranslation } from 'react-i18next';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // auto-dismiss time in ms
  persistent?: boolean; // don't auto-dismiss
  actions?: NotificationAction[];
  position?: 'top-right' | 'top-center' | 'bottom-right';
}

interface NotificationContextType {
  notifications: Notification[];
  showToast: (type: NotificationType, title: string, options?: Partial<Notification>) => void;
  showModal: (type: 'confirm' | 'error', title: string, options?: {
    message?: string;
    details?: string[];
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean>;
  hideNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modal, setModal] = useState<{
    type: 'confirm' | 'error';
    title: string;
    message?: string;
    details?: string[];
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    promise?: { resolve: (value: boolean) => void };
  } | null>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const hideNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showToast = useCallback((
    type: NotificationType,
    title: string,
    options: Partial<Notification> = {}
  ) => {
    const id = generateId();
    const notification: Notification = {
      id,
      type,
      title,
      duration: type === 'error' ? undefined : (options.duration ?? 3000), // Errors persist by default
      ...options
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-dismiss if not persistent and has duration
    if (!notification.persistent && notification.duration) {
      setTimeout(() => {
        hideNotification(id);
      }, notification.duration);
    }
  }, [hideNotification]);

  const showModal = useCallback((
    type: 'confirm' | 'error',
    title: string,
    options: {
      message?: string;
      details?: string[];
      onConfirm?: () => void;
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
    } = {}
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const modalData = {
        type,
        title,
        ...options,
        promise: { resolve }
      };
      setModal(modalData);
    });
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleModalConfirm = () => {
    if (modal?.onConfirm) {
      modal.onConfirm();
    }
    if (modal?.promise) {
      modal.promise.resolve(true);
    }
    setModal(null);
  };

  const handleModalCancel = () => {
    if (modal?.onCancel) {
      modal.onCancel();
    }
    if (modal?.promise) {
      modal.promise.resolve(false);
    }
    setModal(null);
  };

  const contextValue: NotificationContextType = {
    notifications,
    showToast,
    showModal,
    hideNotification,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onClose={() => hideNotification(notification.id)}
          />
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          type={modal.type}
          title={modal.title}
          message={modal.message}
          details={modal.details}
          confirmText={modal.confirmText}
          cancelText={modal.cancelText}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}
    </NotificationContext.Provider>
  );
};

// Toast Component
const Toast: React.FC<{
  notification: Notification;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  const getIcon = () => {
    const iconClass = "w-5 h-5 shrink-0";
    switch (notification.type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-500`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-500`} />;
      default:
        return <Info className={`${iconClass} text-gray-500`} />;
    }
  };

  const getBackgroundClass = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-2 fade-in
        ${getBackgroundClass()}
      `}
      role="alert"
      aria-live="polite"
    >
      {getIcon()}

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">
          {notification.title}
        </div>
        {notification.message && (
          <div className="text-sm mt-1 opacity-90">
            {notification.message}
          </div>
        )}

        {notification.actions && notification.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {notification.actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`
                  px-3 py-1 text-xs rounded font-medium transition-colors
                  ${action.variant === 'primary'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white/70 hover:bg-white/90 text-gray-700 border border-gray-300'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="shrink-0 p-1 rounded-md hover:bg-white/50 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 opacity-60 hover:opacity-100" />
      </button>
    </div>
  );
};

// Modal Component
const Modal: React.FC<{
  type: 'confirm' | 'error';
  title: string;
  message?: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ type, title, message, details, confirmText, cancelText, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const getIcon = () => {
    const iconClass = "w-6 h-6";
    switch (type) {
      case 'confirm':
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-600`} />;
      default:
        return <Info className={`${iconClass} text-blue-600`} />;
    }
  };

  const getButtonClass = (variant: 'confirm' | 'cancel') => {
    if (variant === 'confirm') {
      return type === 'error'
        ? 'bg-red-600 hover:bg-red-700 text-white'
        : 'bg-blue-600 hover:bg-blue-700 text-white';
    } else {
      return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 mb-4">
          {getIcon()}
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
        </div>

        {message && (
          <p className="text-gray-600 mb-4">
            {message}
          </p>
        )}

        {details && details.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 mb-6">
            <ul className="text-sm text-gray-700 space-y-1">
              {details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${getButtonClass('cancel')}`}
            >
              {cancelText || t("common.cancel")}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${getButtonClass('confirm')}`}
          >
            {confirmText || (type === 'error' ? t("common.ok") : t("common.confirm"))}
          </button>
        </div>
      </div>
    </div>
  );
};
