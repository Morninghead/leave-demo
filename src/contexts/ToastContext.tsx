import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;           // NEW: Optional title
  actions?: ToastAction[];   // NEW: Optional action buttons
  persistent?: boolean;      // NEW: Don't auto-dismiss
  details?: string[];        // NEW: Detailed error/info list
}

interface ToastModal {
  type: 'confirm' | 'error';
  title: string;
  message?: string;
  details?: string[];
  customContent?: HTMLElement | React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ToastContextType {
  toasts: Toast[];
  modal: ToastModal | null;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showAdvancedToast: (title: string, message: string, type?: ToastType, options?: {
    duration?: number;
    persistent?: boolean;
    actions?: ToastAction[];
  }) => void;
  showModal: (type: 'confirm' | 'error', title: string, options?: {
    message?: string;
    details?: string[];
    customContent?: HTMLElement | React.ReactNode;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean>;
  removeToast: (id: string) => void;
  hideModal: () => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ToastModal | null>(null);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = generateId();
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showAdvancedToast = useCallback((
    title: string,
    message: string,
    type: ToastType = 'info',
    options: {
      duration?: number;
      persistent?: boolean;
      actions?: ToastAction[];
    } = {}
  ) => {
    const id = generateId();
    const newToast: Toast = {
      id,
      title,
      message,
      type,
      duration: options.persistent ? undefined : (options.duration ?? 4000),
      persistent: options.persistent ?? false,
      actions: options.actions
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss if not persistent and has duration
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, [removeToast]);

  const showModal = useCallback((
    type: 'confirm' | 'error',
    title: string,
    options: {
      message?: string;
      details?: string[];
      customContent?: HTMLElement | React.ReactNode;
      onConfirm?: () => void;
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
    } = {}
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const modalData: ToastModal = {
        type,
        title,
        ...options,
        // Store promise resolver to handle modal result
        onConfirm: () => {
          if (options.onConfirm) options.onConfirm();
          resolve(true);
          setModal(null);
        },
        onCancel: () => {
          if (options.onCancel) options.onCancel();
          resolve(false);
          setModal(null);
        }
      };
      setModal(modalData);
    });
  }, []);

  const hideModal = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      modal,
      showToast,
      showAdvancedToast,
      showModal,
      removeToast,
      hideModal
    }}>
      {children}
    </ToastContext.Provider>
  );
}

// Custom hook to use Toast context
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
