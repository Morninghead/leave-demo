import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoginMethodTabsProps {
  onMethodChange: (method: 'password' | 'scan_code') => void;
  currentMethod?: 'password' | 'scan_code';
}

export function LoginMethodTabs({ onMethodChange, currentMethod = 'password' }: LoginMethodTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex bg-white rounded-lg shadow-sm p-1 mb-6">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => onMethodChange('password')}
          className={`px-4 py-2 font-medium text-sm rounded-l-md border-b-2 ${
            currentMethod === 'password'
              ? 'border-blue-500 text-blue-600 bg-blue-50 border-blue-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l1.264 1.264m-7.071 7.071 1.264m0 8.586 0a6 6 0 0 0-8.486-8.486 8.486 8.486 0 0 0-3.515 3.515 0 0 0 0 0m1.5 0a.5.5.5 0 0 0-.5 0 0 0m0 0m-.5.5 0 0 0-.5 0 0 0m-1.5Z" />
          </svg>
          <span className="font-medium">
            {t('auth.usePasswordLogin')}
          </span>
        </button>

        <button
          onClick={() => onMethodChange('scan_code')}
          className={`px-4 py-2 font-medium text-sm rounded-r-md border-b-2 ${
            currentMethod === 'scan_code'
              ? 'border-blue-500 text-blue-600 bg-blue-50 border-blue-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l1.264 1.264m-7.071 7.071 1.264m0 8.586 0a6 6 0 0 0-8.486-8.486 8.486 8.486 0 0 0-3.515 3.515 0 0 0 0 0m1.5 0a.5.5.5 0 0 0-.5 0 0 0m0 0m-.5.5 0 0 0-.5 0 0 0m-1.5Z" />
          </svg>
          <span className="font-medium">
            {t('auth.useScanCodeLogin')}
          </span>
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        {currentMethod === 'password' && (
          <p>{t('auth.passwordLoginDescription')}</p>
        )}
        {currentMethod === 'scan_code' && (
          <p>{t('auth.scanCodeLoginDescription')}</p>
        )}
      </div>
    </div>
  );
}