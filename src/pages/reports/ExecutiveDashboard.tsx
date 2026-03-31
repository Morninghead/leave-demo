import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  FileText,
  Clock,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Shield,
  Activity,
  Building2,
  TrendingUp,
  Target,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getExecutiveDashboardData, ExecutiveDashboardData, DashboardFilters } from '../../api/executiveDashboard';
import { useDevice } from '../../contexts/DeviceContext';
import { useAuth } from '../../hooks/useAuth';
import { exportMultipleSheets } from '../../utils/exportToExcel';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { Pagination } from '../../components/reports/Pagination';
import { MonthlyTrendsChart } from '../../components/reports/charts/MonthlyTrendsChart';
import { LeaveTypeDistributionChart } from '../../components/reports/charts/LeaveTypeDistributionChart';
import { DepartmentStatsChart } from '../../components/reports/charts/DepartmentStatsChart';
import { exportExecutiveDashboardToPDF } from '../../utils/reportPDFExport';

// Device-specific layout functions moved outside component to prevent hoisting issues
const getContainerClass = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile':
      return 'px-4 py-3 space-y-4';
    case 'tablet':
      return 'px-6 py-4 space-y-5';
    case 'desktop':
    default:
      return 'p-6 space-y-6';
  }
};

const getMaxWidthClass = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile':
      return 'max-w-full';
    case 'tablet':
      return 'max-w-6xl';
    case 'desktop':
    default:
      return 'max-w-7xl';
  }
};

const getKpiGridClass = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile':
      return 'grid grid-cols-1 gap-4';
    case 'tablet':
      return 'grid grid-cols-2 gap-5';
    case 'desktop':
    default:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6';
  }
};

const getChartsGridClass = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile':
      return 'space-y-4';
    case 'tablet':
      return 'space-y-5';
    case 'desktop':
    default:
      return 'grid grid-cols-1 lg:grid-cols-2 gap-8';
  }
};

const getDepartmentGridClass = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile':
      return 'space-y-3';
    case 'tablet':
      return 'grid grid-cols-1 md:grid-cols-2 gap-4';
    case 'desktop':
    default:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
  }
};

// Color utility functions moved outside component
const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'error': return 'bg-red-50 border-red-500 text-red-800 bg-red-100';
    case 'warning': return 'bg-yellow-50 border-yellow-500 text-yellow-800 bg-yellow-100';
    case 'info': return 'bg-blue-50 border-blue-500 text-blue-800 bg-blue-100';
    default: return 'bg-gray-50 border-gray-500 text-gray-800 bg-gray-100';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return 'text-green-600';
    case 'rejected': return 'text-red-600';
    case 'pending': return 'text-yellow-600';
    default: return 'text-gray-600';
  }
};

// Date formatting utilities moved outside component
const formatDateToDDMMYYYY = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getCurrentDateDDMMYYYY = (): string => {
  return formatDateToDDMMYYYY(new Date());
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ExecutiveDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { deviceType, isMobile, isTablet } = useDevice();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);

  const loadDashboardData = useCallback(async (currentFilters?: DashboardFilters, isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const dashboardData = await getExecutiveDashboardData(currentFilters || filters);
      setData(dashboardData);
    } catch (error: any) {
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Auto-refresh every 2 minutes for executive dashboard
  // This provides real-time business intelligence for decision-making
  useAutoRefresh({
    category: 'DASHBOARD',
    dataType: 'ACTIVE',
    onRefresh: () => loadDashboardData(undefined, true),
  });

  const handleExport = useCallback(() => {
    if (!data) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const isThai = i18n.language === 'th';

    const summaryData = [
      { Metric: isThai ? 'ข้อมูลบุคลากร' : 'Workforce Metrics', Value: '', Category: isThai ? 'สรุป' : 'Summary' },
      { Metric: isThai ? 'พนักงานทั้งหมด' : 'Total Employees', Value: data.kpis.totalEmployees, Category: isThai ? 'บุคลากร' : 'Workforce' },
      { Metric: isThai ? 'คำขอลาทั้งหมด' : 'Total Leave Requests', Value: data.kpis.totalRequests, Category: isThai ? 'บุคลากร' : 'Workforce' },
      { Metric: isThai ? 'เฉลี่ยวันต่อคำขอ' : 'Average Days per Request', Value: data.kpis.avgDaysPerRequest.toFixed(1), Category: isThai ? 'บุคลากร' : 'Workforce' },
      { Metric: isThai ? 'อัตราการอนุมัติ' : 'Approval Rate', Value: `${data.kpis.approvalRate}%`, Category: isThai ? 'บุคลากร' : 'Workforce' },
      { Metric: '', Value: '', Category: '' },
      { Metric: isThai ? 'สถิติแผนก' : 'Department Statistics', Value: '', Category: isThai ? 'สรุป' : 'Summary' },
    ];

    // Add department stats
    data.departmentStats.forEach(dept => {
      summaryData.push({
        Metric: dept.department,
        Value: `${dept.requests} requests, ${dept.days} days`,
        Category: 'Departments'
      });
    });

    exportMultipleSheets([
      { name: isThai ? 'บทสรุปผู้บริหาร' : 'Executive Summary', data: summaryData },
      { name: isThai ? 'แนวโน้มรายเดือน' : 'Monthly Trends', data: data.monthlyTrends },
      { name: isThai ? 'สัดส่วนประเภทการลา' : 'Leave Type Distribution', data: data.leaveTypeDistribution },
      { name: isThai ? 'สถิติแผนก' : 'Department Statistics', data: data.departmentStats },
      { name: isThai ? 'กิจกรรมล่าสุด' : 'Recent Activity', data: data.recentActivity },
      { name: isThai ? 'การแจ้งเตือนระบบ' : 'System Alerts', data: data.alerts },
    ], `Executive_Dashboard_${timestamp}`);
  }, [data, i18n.language]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    const isThai = i18n.language === 'th';

    const pdfData = {
      kpis: [
        { label: isThai ? 'พนักงานทั้งหมด' : 'Total Employees', value: data.kpis.totalEmployees },
        { label: isThai ? 'คำขอลาทั้งหมด' : 'Total Requests', value: data.kpis.totalRequests },
        { label: isThai ? 'เฉลี่ยวัน/คำขอ' : 'Avg Days/Request', value: data.kpis.avgDaysPerRequest.toFixed(1) },
        { label: isThai ? 'อัตราการอนุมัติ' : 'Approval Rate', value: `${data.kpis.approvalRate}%` },
      ],
      monthlyTrends: data.monthlyTrends,
      leaveTypes: data.leaveTypeDistribution,
      departments: data.departmentStats,
      alerts: data.alerts,
    };

    exportExecutiveDashboardToPDF(pdfData, {
      title: isThai ? 'แดชบอร์ดผู้บริหาร' : 'Executive Dashboard',
      subtitle: isThai ? 'การวิเคราะห์ทรัพยากรบุคคลเชิงกลยุทธ์' : 'Strategic HR Analytics & Business Intelligence',
      orientation: 'landscape',
    });
  }, [data, i18n.language]);

  // Filter helper functions
  const applyFilters = useCallback(() => {
    loadDashboardData(filters);
  }, [loadDashboardData, filters]);

  const clearFilters = useCallback(() => {
    setFilters({});
    loadDashboardData({});
  }, [loadDashboardData]);

  // Memoized device-specific classes
  const containerClass = useMemo(() => getContainerClass(deviceType), [deviceType]);
  const maxWidthClass = useMemo(() => getMaxWidthClass(deviceType), [deviceType]);
  const kpiGridClass = useMemo(() => getKpiGridClass(deviceType), [deviceType]);
  const chartsGridClass = useMemo(() => getChartsGridClass(deviceType), [deviceType]);
  const departmentGridClass = useMemo(() => getDepartmentGridClass(deviceType), [deviceType]);

  // Paginated data
  const paginatedDepartments = useMemo(() => {
    if (!data) return [];
    const start = (currentPage - 1) * pageSize;
    return data.departmentStats.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const paginatedActivity = useMemo(() => {
    if (!data) return [];
    const start = (activityPage - 1) * activityPageSize;
    return data.recentActivity.slice(start, start + activityPageSize);
  }, [data, activityPage, activityPageSize]);

  const totalDeptPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.departmentStats.length / pageSize);
  }, [data, pageSize]);

  const totalActivityPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.recentActivity.length / activityPageSize);
  }, [data, activityPageSize]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`${maxWidthClass} mx-auto ${containerClass}`}>
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {isMobile && (
                <button
                  onClick={() => navigate('/reports')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Back to Reports"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <h1 className={`${isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>
                  {i18n.language === 'th' ? 'แดชบอร์ดผู้บริหาร' : 'Executive Dashboard'}
                </h1>
                {!isMobile && (
                  <p className="text-sm text-gray-600 mt-1">
                    {i18n.language === 'th' ? 'การวิเคราะห์ทรัพยากรบุคคลเชิงกลยุทธ์' : 'Strategic HR Analytics & Business Intelligence'}
                  </p>
                )}
              </div>
            </div>

            {/* Export Actions - Hide on mobile, show floating button instead */}
            {!isMobile && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className={`${isTablet ? 'inline' : 'hidden sm:inline'}`}>Excel</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span className={`${isTablet ? 'inline' : 'hidden sm:inline'}`}>PDF</span>
                </button>
                <button
                  onClick={handlePrint}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  <span className={`${isTablet ? 'inline' : 'hidden sm:inline'}`}>
                    {i18n.language === 'th' ? 'พิมพ์' : 'Print'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {i18n.language === 'th' ? 'ตัวกรอง' : 'Filters'}
              </h3>
              {(filters.startDate || filters.endDate || filters.month || filters.year) && (
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                {showFilters
                  ? (i18n.language === 'th' ? 'ซ่อนตัวกรอง' : 'Hide Filters')
                  : (i18n.language === 'th' ? 'แสดงตัวกรอง' : 'Show Filters')}
              </button>
              {(filters.startDate || filters.endDate || filters.month || filters.year) && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                >
                  <X className="w-4 h-4" />
                  {i18n.language === 'th' ? 'ล้างค่า' : 'Clear'}
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="space-y-4">
              {/* Filter Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range Filter */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {i18n.language === 'th' ? 'ช่วงวันที่' : 'Date Range'}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={filters.startDate || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Validate DD/MM/YYYY format
                          if (value && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                            setFilters({
                              ...filters,
                              startDate: value,
                              month: undefined,
                              year: undefined,
                              endDate: filters.endDate // Keep existing end date if start date is valid
                            });
                          } else if (!value) {
                            setFilters({
                              ...filters,
                              startDate: undefined,
                              month: undefined,
                              year: undefined
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">{i18n.language === 'th' ? 'รูปแบบ DD/MM/YYYY' : 'DD/MM/YYYY format'}</p>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={filters.endDate || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Validate DD/MM/YYYY format
                          if (value && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                            setFilters({
                              ...filters,
                              endDate: value,
                              month: undefined,
                              year: undefined,
                              startDate: filters.startDate // Keep existing start date if end date is valid
                            });
                          } else if (!value) {
                            setFilters({
                              ...filters,
                              endDate: undefined,
                              month: undefined,
                              year: undefined
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">{i18n.language === 'th' ? 'รูปแบบ DD/MM/YYYY' : 'DD/MM/YYYY format'}</p>
                    </div>
                  </div>
                </div>

                {/* Month & Year Filter (Combined) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {i18n.language === 'th' ? 'เดือน' : 'Month'}
                    </label>
                    <select
                      value={filters.month || ''}
                      onChange={(e) => setFilters({
                        ...filters,
                        month: e.target.value || undefined,
                        startDate: undefined,
                        endDate: undefined,
                        year: undefined
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{i18n.language === 'th' ? 'เลือกเดือน' : 'Select Month'}</option>
                      {/* Generate month options for current year and previous year */}
                      {Array.from({ length: 24 }, (_, i) => {
                        const currentDate = new Date();
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                        const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                        const label = date.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' });
                        return <option key={value} value={value}>{label}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {i18n.language === 'th' ? 'ปี' : 'Year'}
                    </label>
                    <select
                      value={filters.year || ''}
                      onChange={(e) => setFilters({
                        ...filters,
                        year: e.target.value || undefined,
                        startDate: undefined,
                        endDate: undefined,
                        month: undefined
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{i18n.language === 'th' ? 'เลือกปี' : 'Select Year'}</option>
                      {Array.from({ length: 6 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{i18n.language === 'th' ? year + 543 : year}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              <div className="flex justify-end">
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-4 h-4" />
                  {i18n.language === 'th' ? 'นำไปใช้' : 'Apply Filters'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* KPI Cards - Executive Level Metrics */}
            <div className={kpiGridClass}>
              <div className={`${isMobile ? 'p-4' : 'p-6'} bg-blue-50 border border-blue-200 rounded-lg transition-all hover:shadow-md`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {i18n.language === 'th' ? 'พนักงานทั้งหมด' : 'Total Employees'}
                    </p>
                    <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-blue-900 mb-1`}>{data.kpis.totalEmployees}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {i18n.language === 'th' ? 'พนักงานปัจจุบัน' : 'Active workforce'}
                    </p>
                  </div>
                  <div className={`bg-blue-50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg`}>
                    <Users className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-blue-600`} />
                  </div>
                </div>
              </div>

              <div className={`${isMobile ? 'p-4' : 'p-6'} bg-green-50 border border-green-200 rounded-lg transition-all hover:shadow-md`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}
                    </p>
                    <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-green-900 mb-1`}>{data.kpis.totalRequests}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {i18n.language === 'th' ? 'ปีนี้' : 'This year'}
                    </p>
                  </div>
                  <div className={`bg-green-50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg`}>
                    <FileText className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-green-600`} />
                  </div>
                </div>
              </div>

              <div className={`${isMobile ? 'p-4' : 'p-6'} bg-purple-50 border border-purple-200 rounded-lg transition-all hover:shadow-md`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {i18n.language === 'th' ? 'เฉลี่ยวัน/คำขอ' : 'Avg Days/Request'}
                    </p>
                    <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-purple-900 mb-1`}>{data.kpis.avgDaysPerRequest.toFixed(1)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {i18n.language === 'th' ? 'ต่อคำขอลา' : 'Per leave request'}
                    </p>
                  </div>
                  <div className={`bg-purple-50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg`}>
                    <Clock className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-purple-600`} />
                  </div>
                </div>
              </div>

              <div className={`${isMobile ? 'p-4' : 'p-6'} bg-indigo-50 border border-indigo-200 rounded-lg transition-all hover:shadow-md`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {i18n.language === 'th' ? 'อัตราการอนุมัติ' : 'Approval Rate'}
                    </p>
                    <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-indigo-900 mb-1`}>{data.kpis.approvalRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {i18n.language === 'th' ? 'อัตราสำเร็จ' : 'Success rate'}
                    </p>
                  </div>
                  <div className={`bg-indigo-50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg`}>
                    <Shield className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-indigo-600`} />
                  </div>
                </div>
              </div>
            </div>

            {/* System Alerts */}
            {data.alerts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {i18n.language === 'th' ? 'การแจ้งเตือนระบบ' : 'System Alerts'}
                  </h3>
                </div>
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${getSeverityColor(alert.severity)}`}>
                      <div className="flex items-start gap-2">
                        <div className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly Trends and Leave Type Distribution */}
            <div className={chartsGridClass}>
              <div className={`${isMobile ? 'p-4' : 'p-6'} bg-white rounded-lg shadow`}>
                <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 mb-4`}>
                  {i18n.language === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly Trends'}
                </h3>
                <MonthlyTrendsChart data={data.monthlyTrends} height={isMobile ? 250 : 300} />
              </div>

              {/* Leave Type Distribution */}
              <div className={`${isMobile ? 'p-4' : 'p-6'} bg-white rounded-lg shadow`}>
                <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 mb-4`}>
                  {i18n.language === 'th' ? 'สัดส่วนประเภทการลา' : 'Leave Type Distribution'}
                </h3>
                <LeaveTypeDistributionChart data={data.leaveTypeDistribution} height={isMobile ? 250 : 300} />
              </div>
            </div>

            {/* Department Statistics Chart */}
            <div className={`${isMobile ? 'p-4' : 'p-6'} bg-white rounded-lg shadow`}>
              <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 mb-4`}>
                {i18n.language === 'th' ? 'แผนกที่มีการลาสูงสุด' : 'Top Departments by Leave Requests'}
              </h3>
              <DepartmentStatsChart data={data.departmentStats} height={isMobile ? 250 : 350} maxBars={10} />
            </div>

            {/* Department Statistics */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 mb-4`}>
                  {i18n.language === 'th' ? 'สถิติแยกตามแผนก' : 'Department Statistics'}
                </h3>
                <div className={departmentGridClass}>
                  {paginatedDepartments.map((dept, index) => (
                    <div key={index} className={`border rounded-lg ${isMobile ? 'p-3' : 'p-4'} ${dept.requests === 0 ? 'border-gray-200 bg-gray-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className={`w-5 h-5 ${dept.requests === 0 ? 'text-gray-400' : 'text-gray-600'}`} />
                        <h4 className={`font-semibold ${dept.requests === 0 ? 'text-gray-500' : 'text-gray-900'} ${isMobile ? 'text-sm' : ''}`}>
                          {dept.department}
                          {dept.requests === 0 && (
                            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                              {i18n.language === 'th' ? 'ไม่มีคำขอ' : 'No requests'}
                            </span>
                          )}
                        </h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {i18n.language === 'th' ? 'คำขอ:' : 'Requests:'}
                          </span>
                          <span className={`text-sm font-medium ${dept.requests === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                            {dept.requests}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {i18n.language === 'th' ? 'วันรวม:' : 'Total Days:'}
                          </span>
                          <span className={`text-sm font-medium ${dept.requests === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                            {dept.days}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {i18n.language === 'th' ? 'เฉลี่ยวัน:' : 'Avg Days:'}
                          </span>
                          <span className={`text-sm font-medium ${dept.requests === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                            {dept.requests > 0 ? (dept.days / dept.requests).toFixed(1) : '0.0'}
                          </span>
                        </div>
                        {(dept as any).total_employees && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {i18n.language === 'th' ? 'พนักงาน:' : 'Employees:'}
                            </span>
                            <span className={`text-sm font-medium ${dept.requests === 0 ? 'text-gray-400' : 'text-blue-600'}`}>
                              {(dept as any).total_employees}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {data.departmentStats.some(dept => dept.requests === 0) && (
                  <div className={`mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg`}>
                    <p className="text-sm text-blue-800">
                      <strong>{i18n.language === 'th' ? 'หมายเหตุ:' : 'Note:'}</strong> {i18n.language === 'th' ? 'แผนกที่มี 0 คำขอแสดงเพื่อความครบถ้วน' : 'Departments with 0 requests are shown for complete visibility.'}
                    </p>
                  </div>
                )}
              </div>
              {data.departmentStats.length > 10 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalDeptPages}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  totalItems={data.departmentStats.length}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 mb-4`}>
                  {i18n.language === 'th' ? 'กิจกรรมล่าสุด' : 'Recent Activity'}
                </h3>
                <div className="space-y-3">
                  {paginatedActivity.map((activity, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${isMobile ? 'flex-col items-start gap-2' : ''}`}>
                      <div className={`flex items-center gap-3 ${isMobile ? 'w-full' : ''}`}>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div>
                          <p className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : ''}`}>{activity.employee}</p>
                          <p className="text-sm text-gray-600">{activity.type}</p>
                        </div>
                      </div>
                      <div className={`${isMobile ? 'w-full flex justify-between items-center' : 'text-right'}`}>
                        <span className={`text-sm font-medium ${getStatusColor(activity.status)}`}>
                          {i18n.language === 'th' && activity.status === 'approved' ? 'อนุมัติ' :
                            i18n.language === 'th' && activity.status === 'pending' ? 'รออนุมัติ' :
                              i18n.language === 'th' && activity.status === 'rejected' ? 'ปฏิเสธ' : activity.status}
                        </span>
                        <p className="text-xs text-gray-500">{activity.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {data.recentActivity.length > 10 && (
                <Pagination
                  currentPage={activityPage}
                  totalPages={totalActivityPages}
                  onPageChange={setActivityPage}
                  pageSize={activityPageSize}
                  totalItems={data.recentActivity.length}
                  onPageSizeChange={setActivityPageSize}
                />
              )}
            </div>

            {/* Mobile Export Actions - Floating Action Bar */}
            {isMobile && (
              <div className="fixed bottom-4 left-4 right-4 z-40 bg-white rounded-lg shadow-lg border border-gray-200 p-3 safe-area-inset-bottom">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleExport}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="text-sm font-medium">Excel</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">PDF</span>
                    </button>
                    <button
                      onClick={handlePrint}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="text-sm font-medium">{i18n.language === 'th' ? 'พิมพ์' : 'Print'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}