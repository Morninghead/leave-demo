import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Key } from 'lucide-react';

interface ScanCodeTabProps {
  onLogin: (credentials: any) => void;
  isLoading?: boolean;
}

export function ScanCodeTab({ onLogin, isLoading = false }: ScanCodeTabProps) {
  const { t } = useTranslation();
  const [scanCode, setScanCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanCode.trim()) {
      onLogin({ scan_code: scanCode.trim() });
    }
  };

  return (
    <div className="space-y-6">
      {/* Scan Code Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('auth.scanCode')}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder={t('auth.scanCodePlaceholder')}
            className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            autoFocus
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Key className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!scanCode.trim() || isLoading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isLoading ? (
          <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full mr-2" />
        ) : (
          <CreditCard className="h-5 w-5 mr-2" />
        )}
        {isLoading ? t('auth.loggingIn') : t('auth.login')}
      </button>

      {/* Help Text */}
      <div className="text-sm text-gray-600 text-center">
        <p>{t('auth.scanCodeHelp')}</p>
      </div>

      {/* Format Help */}
      <div className="text-xs text-gray-500 text-center">
        <p>{t('auth.scanCodeFormat')}</p>
      </div>
    </div>
  );
}