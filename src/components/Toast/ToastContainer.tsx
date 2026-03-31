import { useTranslation } from 'react-i18next';
import { useToast } from '../../hooks/useToast';
import { CheckCircle, XCircle, Info, X, AlertTriangle } from 'lucide-react';
import { ToastAction } from '../../contexts/ToastContext';

export function ToastContainer() {
  const { t } = useTranslation();
  const { toasts, removeToast, modal, hideModal } = useToast();

  const getIcon = (type: string) => {
    const iconClass = "w-5 h-5 shrink-0";
    switch (type) {
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

  const getBackgroundClass = (type: string) => {
    switch (type) {
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

  // Render enhanced toasts with titles and actions
  const renderEnhancedToast = (toast: any) => (
    <div
      key={toast.id}
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-2 fade-in
        max-w-sm w-full
        ${getBackgroundClass(toast.type)}
      `}
      role="alert"
      aria-live="polite"
    >
      {getIcon(toast.type)}

      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-semibold text-sm mb-1">
            {toast.title}
          </div>
        )}
        <div className="text-sm opacity-90">
          {toast.message}
        </div>

        {toast.actions && toast.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {toast.actions.map((action: ToastAction, index: number) => (
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
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-1 rounded-md hover:bg-white/50 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 opacity-60 hover:opacity-100" />
      </button>
    </div>
  );

  // Render simple toasts (backward compatibility)
  const renderSimpleToast = (toast: any) => (
    <div
      key={toast.id}
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-2 fade-in
        max-w-sm w-full
        ${getBackgroundClass(toast.type)}
      `}
      role="alert"
      aria-live="polite"
    >
      {getIcon(toast.type)}
      <div className="flex-1 text-sm font-medium">{toast.message}</div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-1 rounded-md hover:bg-white/50 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 opacity-60 hover:opacity-100" />
      </button>
    </div>
  );

  // Modal component
  const Modal = () => {
    if (!modal) return null;

    const getModalIcon = () => {
      const iconClass = "w-6 h-6";
      switch (modal.type) {
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
        return modal.type === 'error'
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white';
      } else {
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[11000] p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3 mb-4">
            {getModalIcon()}
            <h3 className="text-lg font-semibold text-gray-900">
              {modal.title}
            </h3>
          </div>

          {modal.message && (
            <p className="text-gray-600 mb-4">
              {modal.message}
            </p>
          )}

          {modal.customContent && (
            <div className="mb-4">
              {modal.customContent instanceof HTMLElement ? (
                <div ref={(ref) => {
                  if (ref && modal.customContent instanceof HTMLElement) {
                    ref.appendChild(modal.customContent);
                  }
                }} />
              ) : (
                modal.customContent
              )}
            </div>
          )}

          {modal.details && modal.details.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <ul className="text-sm text-gray-700 space-y-1">
                {modal.details.map((detail, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            {modal.type === 'confirm' && (
              <button
                onClick={hideModal}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${getButtonClass('cancel')}`}
              >
                {modal.cancelText || t("common.cancel")}
              </button>
            )}
            <button
              onClick={() => {
                if (modal.onConfirm) modal.onConfirm();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${getButtonClass('confirm')}`}
            >
              {modal.confirmText || (modal.type === 'error' ? t("common.ok") : t("common.confirm"))}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {toasts.map((toast) =>
          toast.title || toast.actions ? renderEnhancedToast(toast) : renderSimpleToast(toast)
        )}
      </div>

      {/* Modal */}
      <Modal />
    </>
  );
}

