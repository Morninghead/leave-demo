import { useTranslation } from 'react-i18next';



interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'blue' | 'white' | 'gray';
  className?: string;
}

export function LoadingSpinner({ 
  size = 'medium', 
  color = 'blue',
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'h-5 w-5 border-2',
    medium: 'h-10 w-10 border-3',
    large: 'h-16 w-16 border-4',
  };

  const colorClasses = {
    blue: 'border-blue-600 border-t-transparent',
    white: 'border-white border-t-transparent',
    gray: 'border-gray-600 border-t-transparent',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

// Page Loading Overlay
export function PageLoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-700 font-medium">กำลังโหลด...</p>
      </div>
    </div>
  );
}

// Inline Loading
export function InlineLoading({ message = 'กำลังโหลด...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="medium" />
      <span className="ml-3 text-gray-600">{message}</span>
    </div>
  );
}

