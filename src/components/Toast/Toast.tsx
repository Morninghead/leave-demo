import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { ToastType } from './ToastProvider';

interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  onClose: () => void;
}

export function Toast({ type, title, message, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const configs = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-500',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div
      className={`
        ${config.bgColor} ${config.borderColor}
        border-l-4 rounded-lg shadow-lg p-4 min-w-[320px] max-w-md
        transform transition-all duration-300
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-6 h-6 ${config.iconColor} shrink-0 mt-0.5`} />
        
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${config.titleColor}`}>
            {title}
          </h4>
          {message && (
            <p className="text-sm text-gray-600 mt-1">
              {message}
            </p>
          )}
        </div>

        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

