import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { FilterPanel, FilterOptions } from '../../components/reports/FilterPanel';
import { getLeaveBalanceReport, LeaveBalance } from '../../api/reports';
import { lazyExportWithSummary } from '../../utils/exportUtilsLazy';
import { exportToCSV } from '../../utils/exportToCSV';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { Pagination } from '../../components/reports/Pagination';
import { exportLeaveBalanceReportToPDF } from '../../utils/reportPDFExport';
import { formatThaiLeaveBalance } from '../../utils/leaveTimeFormatter';
import {
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
export default function LeaveBalanceReportPage() {
  const { t, i18n } = useTranslation();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [filteredBalances, setFilteredBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Helper function to format leave balance with hours (Thai format)
  const formatBalanceWithHours = (balance: number, language: 'th' | 'en' = 'th'): string => {
    if (language === 'th') {
      return formatThaiLeaveBalance(balance, 'th');
    } else {
      // English format
      const days = Math.floor(balance);
      const decimalPart = balance - days;
      const hours = Math.round(decimalPart * 8);
      if (hours > 0) {
        return `${days}d ${hours}h`;
      }
      return `${days}d`;
    }
  };

  const loadReport = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await getLeaveBalanceReport();
      setBalances(data);
      setFilteredBalances(data);
    } catch (error: any) {
      // Error handling - consider adding toast notification here
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // Auto-refresh every 10 minutes for leave balance reports
  // Report data changes when balances are updated
  useAutoRefresh({
    category: 'REPORTS',
    dataType: 'SUMMARY',
    onRefresh: () => loadReport(true),
  });

  const handleFilter = (filters: FilterOptions) => {
    let filtered = [...balances];

    if (filters.department) {
      filtered = filtered.filter((b) => {
        const deptName = b.department_name_en || '-';
        return deptName?.toLowerCase().includes(filters.department!.toLowerCase());
      });
    }

    if (filters.employee) {
      filtered = filtered.filter(
        (b) =>
          b.employee_code.toLowerCase().includes(filters.employee!.toLowerCase()) ||
          b.employee_name_th.toLowerCase().includes(filters.employee!.toLowerCase()) ||
          b.employee_name_en.toLowerCase().includes(filters.employee!.toLowerCase())
      );
    }

    setFilteredBalances(filtered);
  };

  const handleReset = () => {
    setFilteredBalances(balances);
    setCurrentPage(1); // Reset to first page
  };

  // Paginated data
  const paginatedBalances = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBalances.slice(start, start + pageSize);
  }, [filteredBalances, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredBalances.length / pageSize);
  }, [filteredBalances.length, pageSize]);

  const handleExportExcel = () => {
    const exportData = filteredBalances.map((balance) => ({
      [t('reports.employeeCode')]: balance.employee_code,
      [t('reports.employeeName')]:
        i18n.language === 'th' ? balance.employee_name_th : balance.employee_name_en,
      [t('reports.department')]:
        balance.department_name_en || '-',
      [t('reports.position')]:
        i18n.language === 'th' ? balance.position_th : balance.position_en,
      [t('reports.sickLeaveBalance')]: balance.sick_leave_balance || 0,
      [t('reports.sickLeaveUsed')]: balance.sick_leave_used || 0,
      [t('reports.annualLeaveBalance')]: balance.annual_leave_balance || 0,
      [t('reports.annualLeaveUsed')]: balance.annual_leave_used || 0,
      [t('reports.personalLeaveBalance')]: balance.personal_leave_balance || 0,
      [t('reports.personalLeaveUsed')]: balance.personal_leave_used || 0,
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create summary sheet
    const summaryData = [
      [i18n.language === 'th' ? 'รายงานวันลาคงเหลือ' : 'Leave Balance Report Summary'],
      [''],
      [i18n.language === 'th' ? 'พนักงานทั้งหมด' : 'Total Employees', filteredBalances.length],
      [i18n.language === 'th' ? 'วันลาป่วยคงเหลือรวม' : 'Total Sick Leave Balance', filteredBalances.reduce((sum, b) => sum + (b.sick_leave_balance || 0), 0)],
      [i18n.language === 'th' ? 'วันลาพักร้อนคงเหลือรวม' : 'Total Annual Leave Balance', filteredBalances.reduce((sum, b) => sum + (b.annual_leave_balance || 0), 0)],
      [i18n.language === 'th' ? 'วันลากิจคงเหลือรวม' : 'Total Personal Leave Balance', filteredBalances.reduce((sum, b) => sum + (b.personal_leave_balance || 0), 0)],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Create data sheet
    const wsData = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, wsData, t('reports.leaveBalances'));

    // Export
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Leave_Balance_Report_${timestamp}.xlsx`);
  };

  const handleExportPDF = async () => {
    exportLeaveBalanceReportToPDF(filteredBalances, {
      title: t('reports.leaveBalanceReport'),
      subtitle: `Total Employees: ${filteredBalances.length}`,
      orientation: 'landscape',
    });
  };

  const handleExportCSV = () => {
    const csvData = filteredBalances.map((balance) => ({
      [i18n.language === 'th' ? 'รหัสพนักงาน' : 'Employee Code']: balance.employee_code,
      [i18n.language === 'th' ? 'ชื่อ' : 'Employee Name']:
        i18n.language === 'th' ? balance.employee_name_th : balance.employee_name_en,
      [i18n.language === 'th' ? 'แผนก' : 'Department']:
        balance.department_name_en || '-',
      [i18n.language === 'th' ? 'วันลาป่วยคงเหลือ' : 'Sick Leave Balance']: balance.sick_leave_balance || 0,
      [i18n.language === 'th' ? 'วันลาป่วยที่ใช้' : 'Sick Leave Used']: balance.sick_leave_used || 0,
      [i18n.language === 'th' ? 'วันลาพักร้อนคงเหลือ' : 'Annual Leave Balance']: balance.annual_leave_balance || 0,
      [i18n.language === 'th' ? 'วันลาพักร้อนที่ใช้' : 'Annual Leave Used']: balance.annual_leave_used || 0,
      [i18n.language === 'th' ? 'วันลากิจคงเหลือ' : 'Personal Leave Balance']: balance.personal_leave_balance || 0,
      [i18n.language === 'th' ? 'วันลากิจที่ใช้' : 'Personal Leave Used']: balance.personal_leave_used || 0,
    }));

    exportToCSV(csvData, 'Leave_Balance_Report');
  };

  const filters_panel = (
    <FilterPanel
      onApply={handleFilter}
      onReset={handleReset}
      showDateRange={false}
      showDepartment={false}
      showStatus={false}
      showLeaveType={false}
      showEmployee={true}
    />
  );

  return (
    <ReportLayout
      title={t('reports.leaveBalanceReport')}
      subtitle={t('reports.leaveBalanceDesc')}
      onExportExcel={handleExportExcel}
      onExportPDF={handleExportPDF}
      onExportCSV={handleExportCSV}
      loading={loading}
      filters={filters_panel}
    >
      {/* Year-End Planning Section */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">{i18n.language === 'th' ? 'การวางแผนสิ้นปี & การปฏิบัติตามกฎหมายแรงงานไทย' : 'Year-End Planning & Thai Labor Law Compliance'}</h2>
                <p className="text-purple-100">{i18n.language === 'th' ? 'ตรวจสอบการใช้วันลาพักร้อนและการปฏิบัติตามกฎระเบียบก่อนสิ้นปี' : 'Monitor annual leave utilization and ensure compliance before year-end'}</p>
              </div>
            </div>
          </div>

          {/* Year-End Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm text-purple-100">{i18n.language === 'th' ? 'วันก่อนสิ้นปี' : 'Days Until Year-End'}</span>
              </div>
              <p className="text-3xl font-bold">
                {(() => {
                  const yearEnd = new Date(new Date().getFullYear(), 11, 31);
                  const today = new Date();
                  const daysUntil = Math.ceil((yearEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return Math.max(0, daysUntil);
                })()}
              </p>
              <p className="text-sm text-purple-100">{i18n.language === 'th' ? 'วัน' : 'remaining'}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm text-purple-100">{i18n.language === 'th' ? 'การใช้สิทธิ์ลาพักร้อนเฉลี่ย' : 'Avg Annual Leave Utilization'}</span>
              </div>
              <p className="text-3xl font-bold">
                {filteredBalances.length > 0
                  ? (
                    filteredBalances.reduce((sum, b) => {
                      const allocated = typeof b.annual_leave_balance === 'number' ? b.annual_leave_balance : parseFloat(String(b.annual_leave_balance || 0));
                      const used = typeof b.annual_leave_used === 'number' ? b.annual_leave_used : parseFloat(String(b.annual_leave_used || 0));
                      const utilization = allocated > 0 ? (used / allocated) * 100 : 0;
                      return sum + utilization;
                    }, 0) / filteredBalances.length
                  ).toFixed(1)
                  : '0'
                }%
              </p>
              <p className="text-sm text-purple-100">{i18n.language === 'th' ? 'ค่าเฉลี่ยบริษัท' : 'company average'}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm text-purple-100">{i18n.language === 'th' ? 'พนักงานที่มีความเสี่ยง' : 'Employees at Risk'}</span>
              </div>
              <p className="text-3xl font-bold">
                {filteredBalances.filter(b => {
                  const allocated = typeof b.annual_leave_balance === 'number' ? b.annual_leave_balance : parseFloat(String(b.annual_leave_balance || 0));
                  const used = typeof b.annual_leave_used === 'number' ? b.annual_leave_used : parseFloat(String(b.annual_leave_used || 0));
                  const utilization = allocated > 0 ? (used / allocated) * 100 : 0;
                  return utilization < 40 && allocated > 5;
                }).length}
              </p>
              <p className="text-sm text-purple-100">{i18n.language === 'th' ? 'ต้องการความสนใจทันที' : 'need immediate attention'}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm text-purple-100">{i18n.language === 'th' ? 'หนรี้สินสะสม (วันลา)' : 'Financial Liability'}</span>
              </div>
              <p className="text-3xl font-bold">
                ฿{filteredBalances.reduce((sum, b) => {
                  const remaining = typeof b.annual_leave_balance === 'number' ? b.annual_leave_balance : parseFloat(String(b.annual_leave_balance || 0));
                  return sum + (remaining * 400); // Rayong Province Minimum Wage 2025-2026: 400 THB/day
                }, 0).toLocaleString()}
              </p>
              <p className="text-sm text-purple-100">{i18n.language === 'th' ? 'มูลค่าวันลาคงเหลือ' : 'unused leave value'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards - Show remaining/allocated format */}
      {(() => {
        // Calculate totals for all leave types
        const sickRemaining = filteredBalances.reduce((sum, b) => sum + (typeof b.sick_leave_balance === 'number' ? b.sick_leave_balance : parseFloat(String(b.sick_leave_balance || 0))), 0);
        const sickUsed = filteredBalances.reduce((sum, b) => sum + (typeof b.sick_leave_used === 'number' ? b.sick_leave_used : parseFloat(String(b.sick_leave_used || 0))), 0);
        const sickAllocated = sickRemaining + sickUsed;

        const annualRemaining = filteredBalances.reduce((sum, b) => sum + (typeof b.annual_leave_balance === 'number' ? b.annual_leave_balance : parseFloat(String(b.annual_leave_balance || 0))), 0);
        const annualUsed = filteredBalances.reduce((sum, b) => sum + (typeof b.annual_leave_used === 'number' ? b.annual_leave_used : parseFloat(String(b.annual_leave_used || 0))), 0);
        const annualAllocated = annualRemaining + annualUsed;

        const personalRemaining = filteredBalances.reduce((sum, b) => sum + (typeof b.personal_leave_balance === 'number' ? b.personal_leave_balance : parseFloat(String(b.personal_leave_balance || 0))), 0);
        const personalUsed = filteredBalances.reduce((sum, b) => sum + (typeof b.personal_leave_used === 'number' ? b.personal_leave_used : parseFloat(String(b.personal_leave_used || 0))), 0);
        const personalAllocated = personalRemaining + personalUsed;

        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">{t('reports.totalEmployees')}</p>
              <p className="text-2xl font-bold text-gray-900">{filteredBalances.length}</p>
            </div>
            <div className="bg-blue-50 rounded-lg shadow p-4">
              <p className="text-sm text-blue-700">{t('reports.totalSickLeaveBalance')}</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatBalanceWithHours(sickRemaining, i18n.language as 'th' | 'en')}
                <span className="text-sm font-normal text-blue-600">/{sickAllocated.toLocaleString()}</span>
              </p>
            </div>
            <div className="bg-green-50 rounded-lg shadow p-4">
              <p className="text-sm text-green-700">{t('reports.totalAnnualLeaveBalance')}</p>
              <p className="text-2xl font-bold text-green-900">
                {formatBalanceWithHours(annualRemaining, i18n.language as 'th' | 'en')}
                <span className="text-sm font-normal text-green-600">/{annualAllocated.toLocaleString()}</span>
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg shadow p-4">
              <p className="text-sm text-yellow-700">{t('reports.totalPersonalLeaveBalance')}</p>
              <p className="text-2xl font-bold text-yellow-900">
                {formatBalanceWithHours(personalRemaining, i18n.language as 'th' | 'en')}
                <span className="text-sm font-normal text-yellow-600">/{personalAllocated.toLocaleString()}</span>
              </p>
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('reports.employeeCode')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('reports.employeeName')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('reports.department')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-blue-50" colSpan={2}>
                  {t('reports.sickLeave')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-green-50" colSpan={2}>
                  {t('reports.annualLeave')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-purple-50">
                  {i18n.language === 'th' ? 'การปฏิบัติตามกฎ' : 'Thai Compliance'}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-yellow-50" colSpan={2}>
                  {t('reports.personalLeave')}
                </th>
              </tr>
              <tr className="bg-gray-50">
                <th colSpan={3}></th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-blue-50">{t('reports.balance')}</th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-blue-50">{t('reports.used')}</th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-green-50">{t('reports.balance')}</th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-green-50">{t('reports.used')}</th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-purple-50">{i18n.language === 'th' ? 'สถานะ' : 'Status'}</th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-yellow-50">{t('reports.balance')}</th>
                <th className="px-2 py-2 text-xs text-gray-600 bg-yellow-50">{t('reports.used')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedBalances.map((balance) => (
                <tr key={balance.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-900">
                    {balance.employee_code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">
                      {i18n.language === 'th'
                        ? balance.employee_name_th
                        : balance.employee_name_en}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {i18n.language === 'th'
                      ? balance.department_name_th
                      : balance.department_name_en}
                  </td>
                  <td className="px-2 py-3 text-center bg-blue-50">
                    <span className="font-semibold text-blue-600">
                      {formatBalanceWithHours(balance.sick_leave_balance || 0, i18n.language as 'th' | 'en')}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center bg-blue-50 text-gray-500">
                    {formatBalanceWithHours(balance.sick_leave_used || 0, i18n.language as 'th' | 'en')}
                  </td>
                  <td className="px-2 py-3 text-center bg-green-50">
                    <span className="font-semibold text-green-600">
                      {formatBalanceWithHours(balance.annual_leave_balance || 0, i18n.language as 'th' | 'en')}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center bg-green-50 text-gray-500">
                    {formatBalanceWithHours(balance.annual_leave_used || 0, i18n.language as 'th' | 'en')}
                  </td>
                  <td className="px-2 py-3 text-center bg-purple-50">
                    {(() => {
                      const allocated = typeof balance.annual_leave_balance === 'number' ? balance.annual_leave_balance : parseFloat(String(balance.annual_leave_balance || 0));
                      const used = typeof balance.annual_leave_used === 'number' ? balance.annual_leave_used : parseFloat(String(balance.annual_leave_used || 0));
                      const utilization = allocated > 0 ? (used / allocated) * 100 : 0;

                      let status = 'Non-Compliant';
                      let bgColor = 'bg-red-100';
                      let textColor = 'text-red-700';
                      let Icon = AlertTriangle;

                      if (utilization >= 70) {
                        status = 'Compliant';
                        bgColor = 'bg-green-100';
                        textColor = 'text-green-700';
                        Icon = CheckCircle;
                      } else if (utilization >= 40) {
                        status = 'At Risk';
                        bgColor = 'bg-yellow-100';
                        textColor = 'text-yellow-700';
                        Icon = AlertTriangle;
                      }

                      return (
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
                          <Icon className="w-3 h-3" />
                          {i18n.language === 'th' ? (status === 'Compliant' ? 'เป็นไปตามกฎ' : status === 'At Risk' ? 'มีความเสี่ยง' : 'ไม่เป็นไปตามกฎ') : status}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-3 text-center bg-yellow-50">
                    <span className="font-semibold text-yellow-600">
                      {formatBalanceWithHours(balance.personal_leave_balance || 0, i18n.language as 'th' | 'en')}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center bg-yellow-50 text-gray-500">
                    {formatBalanceWithHours(balance.personal_leave_used || 0, i18n.language as 'th' | 'en')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBalances.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">{t('reports.noData')}</p>
          </div>
        )}

        {filteredBalances.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            totalItems={filteredBalances.length}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </ReportLayout>
  );
}
