import { ReactNode } from 'react';
import { ArrowLeft, Download, FileText, FileSpreadsheet, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onExportCSV?: () => void;
  onPrint?: () => void;
  loading?: boolean;
  filters?: ReactNode;
  showBackButton?: boolean;
}

export function ReportLayout({
  title,
  subtitle,
  children,
  onExportExcel,
  onExportPDF,
  onExportCSV,
  onPrint,
  loading = false,
  filters,
  showBackButton = true,
}: ReportLayoutProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {showBackButton && (
                <button
                  onClick={() => navigate('/reports')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
                )}
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              {onExportCSV && (
                <button
                  onClick={onExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  disabled={loading}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              )}
              {onExportExcel && (
                <button
                  onClick={onExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  disabled={loading}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              )}
              {onExportPDF && (
                <button
                  onClick={onExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  disabled={loading}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}
              {onPrint && (
                <button
                  onClick={onPrint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.print')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {filters && (
            <div className="pt-4 border-t border-gray-200">
              {filters}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">{children}</div>
        )}
      </div>
    </div>
  );
}
