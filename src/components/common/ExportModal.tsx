/**
 * Centralized Export Modal
 *
 * Modal สำหรับการส่งออกข้อมูลแบบรวมศูนย์
 * รองรับภาษาไทยอย่างสมบูรณ์
 *
 * Usage:
 * ```tsx
 * import { ExportModal } from '@components/common/ExportModal';
 *
 * <ExportModal
 *   isOpen={exportModalOpen}
 *   onClose={() => setExportModalOpen(false)}
 *   title="Export Leave Report"
 *   columns={columns}
 *   data={data}
 *   filename="leave_report"
 * />
 * ```
 */

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, FileText, FileSpreadsheet, Download, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportData, ExportFormat, ExportColumn, ExportOptions, PDFOrientation, PDFPageSize } from '../../services/exportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Required data
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  filename: string;

  // Optional customization
  defaultFormat?: ExportFormat;
  allowFormatSelection?: boolean;
  pdfOrientation?: PDFOrientation;
  pdfPageSize?: PDFPageSize;
  sheetName?: string;
  companyName?: string;
  generatedBy?: string;

  // Signatures for PDF
  signatures?: Array<{
    label: string;
    showDate: boolean;
  }>;
}

export function ExportModal({
  isOpen,
  onClose,
  title,
  subtitle,
  columns,
  data,
  filename,
  defaultFormat = 'excel',
  allowFormatSelection = true,
  pdfOrientation = 'landscape',
  pdfPageSize = 'a4',
  sheetName,
  companyName,
  generatedBy,
  signatures,
}: ExportModalProps) {
  const { t, i18n } = useTranslation();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const options: ExportOptions = {
        title,
        subtitle,
        filename,
        format: selectedFormat,
        columns,
        data,
        pdfOrientation,
        pdfPageSize,
        sheetName: sheetName || title,
        companyName,
        generatedBy,
        reportDate: new Date().toLocaleString(i18n.language === 'th' ? 'th-TH' : 'en-US'),
        signatures,
      };

      await exportData(options);

      setExportSuccess(true);
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1500);
    } catch (error: any) {
      setExportError(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    {i18n.language === 'th' ? 'ส่งออกรายงาน' : 'Export Report'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Report Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 mb-1">{title}</div>
                    {subtitle && <div className="text-gray-600 text-xs mb-2">{subtitle}</div>}
                    <div className="text-gray-500 text-xs">
                      {i18n.language === 'th' ? 'จำนวนแถว' : 'Rows'}: <span className="font-medium text-gray-700">{data.length}</span>
                      {' • '}
                      {i18n.language === 'th' ? 'คอลัมน์' : 'Columns'}: <span className="font-medium text-gray-700">{columns.length}</span>
                    </div>
                  </div>
                </div>

                {/* Format Selection */}
                {allowFormatSelection && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {i18n.language === 'th' ? 'เลือกรูปแบบ' : 'Select Format'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setSelectedFormat('pdf')}
                        disabled={isExporting}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          selectedFormat === 'pdf'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <FileText className="w-6 h-6" />
                        <span className="text-xs font-medium">PDF</span>
                      </button>

                      <button
                        onClick={() => setSelectedFormat('excel')}
                        disabled={isExporting}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          selectedFormat === 'excel'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <FileSpreadsheet className="w-6 h-6" />
                        <span className="text-xs font-medium">Excel</span>
                      </button>

                      <button
                        onClick={() => setSelectedFormat('both')}
                        disabled={isExporting}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          selectedFormat === 'both'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex gap-1">
                          <FileText className="w-4 h-4" />
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium">{i18n.language === 'th' ? 'ทั้งสอง' : 'Both'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Thai Support Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800">
                      {i18n.language === 'th' ? (
                        <span>✓ รองรับการแสดงผลภาษาไทยอย่างสมบูรณ์ รวมถึงสระและวรรณยุกต์</span>
                      ) : (
                        <span>✓ Full Thai language support including vowels and tone marks</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {exportError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="text-sm text-red-800">{exportError}</div>
                  </div>
                )}

                {/* Success Message */}
                {exportSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      {i18n.language === 'th' ? 'ส่งออกสำเร็จ!' : 'Export successful!'}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isExporting}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting || data.length === 0}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {i18n.language === 'th' ? 'กำลังส่งออก...' : 'Exporting...'}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {i18n.language === 'th' ? 'ส่งออก' : 'Export'}
                      </>
                    )}
                  </button>
                </div>

                {/* File Info */}
                <div className="mt-4 text-xs text-gray-500 text-center">
                  {i18n.language === 'th' ? 'ชื่อไฟล์' : 'Filename'}: <span className="font-mono">{filename}</span>
                  {selectedFormat === 'both' && (
                    <span> (.pdf {i18n.language === 'th' ? 'และ' : 'and'} .xlsx)</span>
                  )}
                  {selectedFormat === 'pdf' && <span>.pdf</span>}
                  {selectedFormat === 'excel' && <span>.xlsx</span>}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}


