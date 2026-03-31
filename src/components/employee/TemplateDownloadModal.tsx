import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { downloadEmployeeTemplate } from '../../api/employeeTemplate';
import { useToast } from '../../hooks/useToast';

interface TemplateDownloadModalProps {
  onClose: () => void;
}

export function TemplateDownloadModal({ onClose }: TemplateDownloadModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadEmployeeTemplate();
      showToast(t('message.templateDownloadSuccess'), 'success');
      onClose();
    } catch (error: any) {
      console.error('Download template error:', error);
      showToast(error.message || 'Failed to download template', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('employee.downloadTemplate')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              {t('employee.templateDescription')}
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                {t('employee.templateInstructions')}
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>{t('employee.templateInstruction1')}</li>
                <li>{t('employee.templateInstruction2')}</li>
                <li>{t('employee.templateInstruction3')}</li>
                <li>{t('employee.templateInstruction4')}</li>
              </ul>
            </div>
          </div>

          {/* Template Information */}
          <div className="mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">
                {t('employee.singleTemplateInfo')}
              </h4>
              <p className="text-sm text-green-800">
                {t('employee.singleTemplateDescription')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={downloading}
            >
              {t('common.cancel')}
            </button>
            
            <button
              onClick={handleDownloadTemplate}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              {downloading ? t('common.downloading') : t('employee.downloadTemplate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
