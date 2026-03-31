// src/pages/ReportsPage.tsx - Device-Aware Reports
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Download, Filter, ArrowLeft } from 'lucide-react';
import { getReports, Report, LeaveReport, ShiftReport } from '../api/reports';
import { exportToExcel, exportMultipleSheets } from '../utils/exportUtils';
import { useDevice } from '../contexts/DeviceContext';
import { LeaveBalanceReport } from '../components/reports/LeaveBalanceReport';
import { LeaveTypeChart } from '../components/reports/LeaveTypeChart';
import { StatusPieChart } from '../components/reports/StatusPieChart';
import { DepartmentChart } from '../components/reports/DepartmentChart';

export function ReportsPage() {
  const { t } = useTranslation();
  const { deviceType, isMobile, isTablet } = useDevice();
  const [reportType, setReportType] = useState<'leave' | 'shift'>('leave');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [reportType, year, month]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getReports({
        type: reportType,
        year,
        month: month || undefined,
      });
      setReport(data);
    } catch (error: any) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!report) return;

    const timestamp = new Date().toISOString().split('T')[0];
    
    if (report.report_type === 'leave') {
      const leaveReport = report as LeaveReport;
      
      const detailData = leaveReport.data.map(item => ({
        'รหัสพนักงาน': item.employee_code,
        'ชื่อ-นามสกุล': item.employee_name,
        'แผนก': item.department_name || '-',
        'ประเภทการลา': item.leave_type,
        'วันที่เริ่มต้น': new Date(item.start_date).toLocaleDateString('th-TH'),
        'วันที่สิ้นสุด': new Date(item.end_date).toLocaleDateString('th-TH'),
        'จำนวนวัน': item.total_days,
        'สถานะ': item.status,
        'วันที่ส่งคำขอ': new Date(item.created_at).toLocaleDateString('th-TH'),
      }));

      const summaryByTypeData = leaveReport.summary_by_type.map(item => ({
        'ประเภทการลา': item.leave_type,
        'จำนวนคำขอ': item.total_requests,
        'จำนวนวัน': item.total_days,
        'อนุมัติ': item.approved_count,
        'ปฏิเสธ': item.rejected_count,
        'รออนุมัติ': item.pending_count,
      }));

      const summaryByDeptData = leaveReport.summary_by_department.map(item => ({
        'แผนก': item.department_name || '-',
        'จำนวนคำขอ': item.total_requests,
        'จำนวนวัน': item.total_days,
        'อนุมัติ': item.approved_count,
      }));

      exportMultipleSheets([
        { name: 'รายละเอียด', data: detailData },
        { name: 'สรุปตามประเภท', data: summaryByTypeData },
        { name: 'สรุปตามแผนก', data: summaryByDeptData },
      ], `รายงานการลา_${timestamp}`);
      
    } else if (report.report_type === 'shift') {
      const shiftReport = report as ShiftReport;
      
      const detailData = shiftReport.data.map(item => ({
        'รหัสพนักงาน': item.employee_code,
        'ชื่อ-นามสกุล': item.employee_name,
        'แผนก': item.department_name || '-',
        'วันทำงาน': new Date(item.work_date).toLocaleDateString('th-TH'),
        'วันหยุด': new Date(item.off_date).toLocaleDateString('th-TH'),
        'เหตุผล': item.reason_th,
        'สถานะ': item.status,
        'วันที่ส่งคำขอ': new Date(item.created_at).toLocaleDateString('th-TH'),
      }));

      exportToExcel(
        detailData,
        `รายงานสลับวัน_${timestamp}`,
        'รายละเอียด'
      );
    }
  };

  const years = [2024, 2025, 2026];
  const months = [
    { value: null, label: t('reports.allMonths') },
    { value: 1, label: t('reports.january') },
    { value: 2, label: t('reports.february') },
    { value: 3, label: t('reports.march') },
    { value: 4, label: t('reports.april') },
    { value: 5, label: t('reports.may') },
    { value: 6, label: t('reports.june') },
    { value: 7, label: t('reports.july') },
    { value: 8, label: t('reports.august') },
    { value: 9, label: t('reports.september') },
    { value: 10, label: t('reports.october') },
    { value: 11, label: t('reports.november') },
    { value: 12, label: t('reports.december') },
  ];

  // Device-specific layout functions
  const getContainerClass = () => {
    switch (deviceType) {
      case 'mobile': return 'px-4 py-3 max-w-full';
      case 'tablet': return 'px-6 py-4 max-w-6xl';
      case 'desktop':
      default: return 'p-6 max-w-7xl mx-auto';
    }
  };

  const getSpacingClass = () => {
    switch (deviceType) {
      case 'mobile': return 'space-y-4';
      case 'tablet': return 'space-y-5';
      case 'desktop':
      default: return 'space-y-6';
    }
  };

  const getHeadingSize = () => {
    switch (deviceType) {
      case 'mobile': return 'text-xl';
      case 'tablet': return 'text-2xl';
      case 'desktop':
      default: return 'text-3xl';
    }
  };

  if (loading) {
    return (
      <div className={getContainerClass()}>
        <div className="animate-pulse space-y-4">
          <div className={`h-8 bg-gray-200 rounded ${isMobile ? 'w-1/2' : 'w-1/3'}`}></div>
          <div className={`${isMobile ? 'h-32' : 'h-64'} bg-gray-200 rounded`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${getContainerClass()} ${getSpacingClass()}`}>
      {/* Header */}
      <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
        <div className={`flex items-center gap-3 ${isMobile ? '' : ''}`}>
          {isMobile && (
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <BarChart3 className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-blue-600`} />
          <div>
            <h1 className={`${getHeadingSize()} font-bold text-gray-900`}>{t('reports.title')}</h1>
            <p className={`${isMobile ? 'text-sm' : 'text-gray-600'} mt-1`}>{t('reports.description')}</p>
          </div>
        </div>

        {/* Mobile Export Button */}
        {isMobile ? (
          <button
            onClick={handleExport}
            disabled={!report}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            <Download className="w-4 h-4" />
            {t('reports.export')}
          </button>
        ) : (
          <button
            onClick={handleExport}
            disabled={!report}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {t('reports.export')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className={`bg-white ${isMobile ? 'rounded-lg' : 'rounded-lg'} shadow ${isMobile ? 'p-4' : 'p-4'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-gray-600`} />
          <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : ''}`}>{t('common.filter')}</h2>
        </div>
        <div className={`${isMobile ? 'space-y-3' : 'grid md:grid-cols-4 gap-4'}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.reportType')}
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'leave' | 'shift')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="leave">{t('reports.leaveReport')}</option>
              <option value="shift">{t('reports.shiftReport')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.year')}
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.month')}
            </label>
            <select
              value={month || ''}
              onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {months.map((m) => (
                <option key={m.value || 'all'} value={m.value || ''}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leave Balance Report */}
      <div className="bg-white rounded-lg shadow p-6">
        <LeaveBalanceReport />
      </div>

      {/* Charts Section */}
      {report && report.report_type === 'leave' && (
        <div className="space-y-6">
          <div className={`${isMobile ? 'space-y-4' : 'grid md:grid-cols-2 gap-6'}`}>
            <LeaveTypeChart data={(report as LeaveReport).summary_by_type} />
            <StatusPieChart
              approved={
                (report as LeaveReport).summary_by_type.reduce(
                  (sum, item) => sum + item.approved_count,
                  0
                )
              }
              rejected={
                (report as LeaveReport).summary_by_type.reduce(
                  (sum, item) => sum + item.rejected_count,
                  0
                )
              }
              pending={
                (report as LeaveReport).summary_by_type.reduce(
                  (sum, item) => sum + item.pending_count,
                  0
                )
              }
            />
          </div>
          <DepartmentChart data={(report as LeaveReport).summary_by_department} />
        </div>
      )}

      {/* Report Content */}
      {report && (
        <>
          {report.report_type === 'leave' && (
            <LeaveReportContent report={report as LeaveReport} />
          )}
          {report.report_type === 'shift' && (
            <ShiftReportContent report={report as ShiftReport} />
          )}
        </>
      )}
    </div>
  );
}

// ==================== LeaveReportContent Component ====================
function LeaveReportContent({ report }: { report: LeaveReport }) {
  const { t } = useTranslation();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      {/* Summary by Type */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{t('reports.summaryByType')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leave.leaveType')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('reports.totalRequests')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('reports.totalDays')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('leave.approved')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('leave.rejected')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('leave.pending')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.summary_by_type.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{item.leave_type}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{item.total_requests}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    {item.total_days}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-green-600">{item.approved_count}</td>
                  <td className="px-6 py-4 text-sm text-right text-red-600">{item.rejected_count}</td>
                  <td className="px-6 py-4 text-sm text-right text-yellow-600">{item.pending_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary by Department */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{t('reports.summaryByDepartment')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('employee.department')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('reports.totalRequests')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('reports.totalDays')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('leave.approved')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.summary_by_department.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{item.department_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{item.total_requests}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    {item.total_days}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-green-600">{item.approved_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Data */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{t('reports.details')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('employee.employeeCode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('employee.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leave.leaveType')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('leave.period')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('leave.totalDays')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  {t('employee.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.data.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{item.employee_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.employee_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.leave_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(item.start_date).toLocaleDateString('th-TH')} - {new Date(item.end_date).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{item.total_days}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                      {t(`leave.${item.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ==================== ShiftReportContent Component ====================
function ShiftReportContent({ report }: { report: ShiftReport }) {
  const { t } = useTranslation();

  return (
    <>
      {/* Summary */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{t('reports.summary')}</h3>
        </div>
        <div className="grid md:grid-cols-4 gap-4 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">{t('reports.totalRequests')}</p>
            <p className="text-3xl font-bold text-gray-900">{report.summary.total_requests}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">{t('shift.approved')}</p>
            <p className="text-3xl font-bold text-green-600">{report.summary.approved_count}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">{t('shift.rejected')}</p>
            <p className="text-3xl font-bold text-red-600">{report.summary.rejected_count}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">{t('shift.pending')}</p>
            <p className="text-3xl font-bold text-yellow-600">{report.summary.pending_count}</p>
          </div>
        </div>
      </div>

      {/* Detail Data */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{t('reports.details')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('employee.employeeCode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('employee.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('shift.fromWorkDate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('shift.toOffDate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('shift.reason')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  {t('employee.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.data.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{item.employee_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.employee_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(item.work_date).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(item.off_date).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.reason_th || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      item.status === 'approved' ? 'bg-green-100 text-green-800' :
                      item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {t(`shift.${item.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
