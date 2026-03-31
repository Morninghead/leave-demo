import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { importEmployees, ImportResult, ImportError, DuplicateError } from '../../api/employeeImport';
import { downloadEmployeeTemplate } from '../../api/employeeTemplate';
import { useToast } from '../../hooks/useToast';

interface EmployeeImportModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function EmployeeImportModal({ onClose, onSuccess }: EmployeeImportModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      showToast(t('employee.importFileTypeError') || 'Please upload an Excel file (.xlsx or .xls)', 'error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast(t('employee.importFileSizeError') || 'File size must be less than 10MB', 'error');
      return;
    }

    setSelectedFile(file);
    setImportResult(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadEmployeeTemplate();
      showToast(t('message.templateDownloadSuccess'), 'success');
    } catch (error: any) {
      showToast(error.message || t('message.templateDownloadError'), 'error');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setImportProgress({ current: 0, total: 0, message: 'Starting import...' });

    try {
      const result = await importEmployees(selectedFile, (current, total, message) => {
        // Update progress during batch processing
        setImportProgress({ current, total, message });
      });

      setImportResult(result);
      setImportProgress(null);

      if (result.success) {
        showToast(result.message, 'success');
        if (onSuccess) onSuccess();
      } else if (result.step === 'validation') {
        showToast(t('employee.importValidationError') || 'Validation errors found', 'error');
      } else if (result.step === 'duplicate_check') {
        showToast(t('employee.importDuplicateError') || 'Duplicate records found', 'error');
      }
    } catch (error: any) {
      showToast(error.message || t('employee.importError'), 'error');
      setImportProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (importResult?.success && onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('employee.importEmployees')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!importResult ? (
            <>
              {/* Instructions */}
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">
                    {t('employee.importInstructions')}
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>{t('employee.importInstruction1')}</li>
                    <li>{t('employee.importInstruction2')}</li>
                    <li>{t('employee.importInstruction3')}</li>
                    <li>{t('employee.importInstruction4')}</li>
                  </ul>
                </div>
              </div>

              {/* Download Template */}
              <div className="mb-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">
                      {t('employee.needTemplate')}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('employee.downloadTemplateDescription')}
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t('employee.downloadTemplate')}
                  </button>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.selectFile')}
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver
                      ? 'border-blue-400 bg-blue-50'
                      : selectedFile
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <FileSpreadsheet className="w-12 h-12 text-green-600 mb-3" />
                      <p className="font-medium text-gray-900 mb-1">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleReset();
                        }}
                        className="mt-3 text-sm text-red-600 hover:text-red-700"
                      >
                        {t('common.remove')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="font-medium text-gray-900 mb-1">
                        {t('employee.dragDropFile')}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        {t('employee.orClickToBrowse')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('employee.supportedFormats')}: .xlsx, .xls
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Indicator */}
              {importProgress && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="mb-2 flex items-center justify-between text-sm font-medium text-blue-900">
                    <span>Importing employees...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-blue-700">{importProgress.message}</p>
                  <p className="text-xs text-blue-600 mt-1">Processing in batches of 20 employees with 5-second delays...</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={uploading}
                >
                  {t('common.cancel')}
                </button>

                <button
                  onClick={handleImport}
                  disabled={!selectedFile || uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? t('employee.importing') : t('employee.import')}
                </button>
              </div>
            </>
          ) : (
            /* Import Results */
            <ImportResults
              result={importResult}
              onReset={handleReset}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ImportResultsProps {
  result: ImportResult;
  onReset: () => void;
  onClose: () => void;
}

function ImportResults({ result, onReset, onClose }: ImportResultsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`p-4 rounded-lg border ${result.success
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
        }`}>
        <div className="flex items-center gap-3 mb-3">
          {result.success ? (
            <CheckCircle className="w-6 h-6 text-green-600" />
          ) : (
            <AlertCircle className="w-6 h-6 text-yellow-600" />
          )}
          <h3 className={`font-semibold ${result.success ? 'text-green-900' : 'text-yellow-900'
            }`}>
            {result.message}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">{t('employee.totalRows')}:</span>
            <span className="ml-2 font-medium">{result.totalRows}</span>
          </div>
          <div>
            <span className="text-gray-600">{t('employee.successCount')}:</span>
            <span className="ml-2 font-medium text-green-600">{result.successCount}</span>
          </div>
          <div>
            <span className="text-gray-600">{t('employee.errorCount')}:</span>
            <span className="ml-2 font-medium text-red-600">{result.errorCount}</span>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {result.errors.length > 0 && (
        <div>
          <h4 className="font-medium text-red-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {t('employee.validationErrors')} ({result.errors.length})
          </h4>
          <div className="max-h-60 overflow-y-auto border border-red-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-red-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-red-900 w-16">{t('employee.row')}</th>
                  <th className="px-4 py-2 text-left text-red-900 w-32">{t('employee.employeeInfo') || 'ข้อมูลพนักงาน'}</th>
                  <th className="px-4 py-2 text-left text-red-900">{t('employee.errorDetail') || 'รายละเอียดข้อผิดพลาด'}</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((error, index) => (
                  <tr key={index} className="border-t border-red-100 hover:bg-red-25">
                    <td className="px-4 py-3 text-gray-900 font-medium">{error.row}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{error.value || '-'}</div>
                      <div className="text-xs text-gray-500">{error.field}</div>
                    </td>
                    <td className="px-4 py-3 text-red-700">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duplicate Errors */}
      {result.duplicates.length > 0 && (
        <div>
          <h4 className="font-medium text-yellow-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {t('employee.duplicateErrors')} ({result.duplicates.length})
          </h4>
          <div className="max-h-60 overflow-y-auto border border-yellow-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-yellow-50">
                <tr>
                  <th className="px-4 py-2 text-left text-yellow-900">{t('employee.row')}</th>
                  <th className="px-4 py-2 text-left text-yellow-900">{t('employee.employeeCode')}</th>
                  <th className="px-4 py-2 text-left text-yellow-900">{t('employee.name')}</th>
                  <th className="px-4 py-2 text-left text-yellow-900">{t('employee.issue')}</th>
                </tr>
              </thead>
              <tbody>
                {result.duplicates.map((duplicate, index) => (
                  <tr key={index} className="border-t border-yellow-100">
                    <td className="px-4 py-2 text-gray-900">{duplicate.row}</td>
                    <td className="px-4 py-2 text-gray-900">{duplicate.employeeCode}</td>
                    <td className="px-4 py-2 text-gray-600">{duplicate.name}</td>
                    <td className="px-4 py-2 text-yellow-700">{duplicate.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        {!result.success && (
          <button
            onClick={onReset}
            className="px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            {t('employee.tryAgain')}
          </button>
        )}

        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
