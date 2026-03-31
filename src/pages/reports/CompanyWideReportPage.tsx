/**
 * Company-wide Leave Report Page
 *
 * Generate comprehensive organization-wide leave & shift swap report
 * with PDF export and executive signature section
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Download, Calendar, ArrowLeft, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { getCompanyWideLeaveReport, CompanyWideReportData } from '../../api/reports';
import { exportCompanyWideLeaveReportPDF } from '../../utils/comprehensiveReportPDFExport';
import { getFiscalSettings, getFiscalYearDateRange, getFiscalMonthDateRange, calculateFiscalYear, FiscalSettings } from '../../api/fiscal';
import { useAuth } from '../../contexts/AuthContext';
import { DatePicker } from '../../components/common/DatePicker';

export default function CompanyWideReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'range' | 'monthly'>('range');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeTrends, setIncludeTrends] = useState(true);
  const [reportData, setReportData] = useState<CompanyWideReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettings | null>(null);

  // Set default date range based on fiscal year settings
  useEffect(() => {
    const loadDefaultDateRange = async () => {
      try {
        const response = await getFiscalSettings();
        const settings = response.settings;
        setFiscalSettings(settings); // Store settings

        const currentFiscalYear = calculateFiscalYear(new Date(), settings);
        const { start, end } = getFiscalYearDateRange(currentFiscalYear, settings);

        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        setStartDate(formatDate(start));
        setEndDate(formatDate(end));
      } catch (err) {
        // Fallback to calendar year if API fails
        const currentYear = new Date().getFullYear();
        setStartDate(`${currentYear}-01-01`);
        setEndDate(`${currentYear}-12-31`);
      }
    };
    loadDefaultDateRange();
  }, []);





  const handleGenerateReport = async () => {
    let finalStartDate = startDate;
    let finalEndDate = endDate;

    if (viewMode === 'monthly') {
      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (fiscalSettings) {
        const { start, end } = getFiscalMonthDateRange(selectedYear, selectedMonth, fiscalSettings);
        finalStartDate = formatDate(start);
        finalEndDate = formatDate(end);
      } else {
        const start = new Date(selectedYear, selectedMonth - 1, 1);
        const end = new Date(selectedYear, selectedMonth, 0);
        finalStartDate = formatDate(start);
        finalEndDate = formatDate(end);
      }
    } else {
      if (!startDate || !endDate) {
        setError(i18n.language === 'th' ? 'กรุณาเลือกช่วงวันที่' : 'Please select date range');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getCompanyWideLeaveReport({
        start_date: finalStartDate,
        end_date: finalEndDate,
        include_trends: includeTrends,
      });

      setReportData(data);
    } catch (err: any) {
      setError(err.message || (i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการสร้างรายงาน' : 'Failed to generate report'));
    } finally {
      setLoading(false);
    }
  };

  const formatLeaveDays = (days: number) => {
    if (!days || days === 0) return '-';

    // Handle float precision for integers (e.g. 1.00000001 -> 1)
    if (Math.abs(Math.round(days) - days) < 0.001) {
      return Math.round(days).toString();
    }

    // Handle half-days standard format (e.g. 0.5, 1.5, 2.5)
    // We keep X.5 format as it's standard for half-day leaves
    if (Math.abs((days * 2) - Math.round(days * 2)) < 0.001) {
      return days.toFixed(1);
    }

    // For other fractions (hourly leave), break down into Day/Hr
    // Assuming 8 hours = 1 day
    const d = Math.floor(days);
    const remainingDays = days - d;
    const h = Math.round(remainingDays * 8); // Calculate hours from the remainder of days

    const parts = [];
    if (d > 0) parts.push(i18n.language === 'th' ? `${d} วัน` : `${d}d`);
    if (h > 0) parts.push(i18n.language === 'th' ? `${h} ชม.` : `${h}h`);

    // If calculating resulted in 0 days 0 hours (e.g. extremely small fraction), show 0
    if (parts.length === 0) return '0';

    return parts.join(' ');
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['Company Wide Leave Report'],
      [`Period: ${startDate} to ${endDate}`],
      [],
      ['Overall Summary'],
      ['Total Employees', reportData.overall_summary.total_employees],
      ['Total Requests', reportData.overall_summary.total_requests],
      ['Total Days', reportData.overall_summary.total_days.toFixed(2)],
      [],
      ['Department Summary'],
      ['Department', 'Total Employees', 'Leave Requests', 'Total Days', 'Avg Days/Emp']
    ];

    reportData.departments.forEach(dept => {
      summaryData.push([
        i18n.language === 'th' ? dept.department_name_th : dept.department_name_en,
        dept.total_employees,
        dept.total_leave_requests,
        dept.total_days.toFixed(2),
        dept.avg_days_per_employee.toFixed(2)
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Detailed Breakdown Sheet
    if (reportData.all_leave_types) {
      // Headers: Code, Name, Department, ...LeaveTypes..., Total
      const headerRow = ['Employee Code', 'Employee Name', 'Department'];

      // Use Names for Leave Types
      reportData.all_leave_types.forEach(lt => {
        headerRow.push(i18n.language === 'th' ? lt.name_th : lt.name_en);
      });
      headerRow.push('Total Days');

      const detailedData: any[] = [headerRow];

      // Formatting helper for Excel breakdown (consistent with PDF)
      const formatExcelVal = (days: number) => {
        if (!days) return '-';
        if (Number.isInteger(days)) return days.toString();
        // Check hourly
        if (days < 1) {
          const hours = days * 8;
          if (Math.abs(Math.round(hours) - hours) < 0.001) {
            if (days === 0.5) return '0.5';
            return `${Math.round(hours)}h`;
          }
        }
        return days.toFixed(2).replace(/\.00$/, '');
      };

      reportData.departments.forEach(dept => {
        if (dept.employees) {
          dept.employees.forEach(emp => {
            const row = [
              emp.employee_code,
              i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en,
              i18n.language === 'th' ? dept.department_name_th : dept.department_name_en
            ];

            // Add leave stats per type
            reportData.all_leave_types?.forEach(lt => {
              const val = emp.leave_stats[lt.code] || 0;
              row.push(formatExcelVal(val));
            });

            // Total
            const total = Object.values(emp.leave_stats).reduce((a, b) => a + b, 0);
            row.push(formatExcelVal(total));

            detailedData.push(row);
          });
        }
      });

      const wsDetailed = XLSX.utils.aoa_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Breakdown');
    }

    XLSX.writeFile(wb, `Company_Leave_Report_${startDate}_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    // Determine effective date range for subtitle
    let pdfStart = startDate;
    let pdfEnd = endDate;
    if (viewMode === 'monthly') {
      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (fiscalSettings) {
        const { start, end } = getFiscalMonthDateRange(selectedYear, selectedMonth, fiscalSettings);
        pdfStart = formatDate(start);
        pdfEnd = formatDate(end);
      } else {
        const start = new Date(selectedYear, selectedMonth - 1, 1);
        const end = new Date(selectedYear, selectedMonth, 0);
        pdfStart = formatDate(start);
        pdfEnd = formatDate(end);
      }
    }

    exportCompanyWideLeaveReportPDF(
      {
        departments: reportData.departments.map((dept) => ({
          department_name: i18n.language === 'th' ? dept.department_name_th : dept.department_name_en,
          department_code: dept.department_code,
          total_employees: dept.total_employees,
          employees: dept.employees || [],
          summary: {
            total_leave_requests: dept.total_leave_requests,
            total_shift_swaps: dept.total_shift_swaps,
            total_days: dept.total_days,
          },
        })),
        overall_summary: reportData.overall_summary,
        all_leave_types: reportData.all_leave_types
      },
      {
        title:
          i18n.language === 'th'
            ? 'รายงานการลาและสลับวันหยุด (ภาพรวมทั้งบริษัท)'
            : 'Leave & Shift Swap Report (Company-wide)',
        subtitle: `${pdfStart} to ${pdfEnd}`,
        reportType: 'company-wide',
        dateRange: { start: pdfStart, end: pdfEnd },
        generatedBy: `${user?.first_name_en} ${user?.last_name_en}`,
        documentNumber: `CR-${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
        signatures: [
          {
            label: i18n.language === 'th' ? 'ลายเซ็น HR Manager' : 'HR Manager Signature',
            showDate: true,
          },
          {
            label: i18n.language === 'th' ? 'ลายเซ็นผู้บริหาร' : 'Executive Signature',
            showDate: true,
          },
        ],
      }
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports/comprehensive')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'รายงานภาพรวมทั้งบริษัท' : 'Company-wide Leave Report'}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th'
                ? 'รายงานสรุปทุกแผนกและสถิติการใช้วันลาทั้งองค์กร'
                : 'Organization-wide summary and leave usage statistics'}
            </p>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setViewMode('range')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${viewMode === 'range'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Calendar className="w-5 h-5" />
            {i18n.language === 'th' ? 'ช่วงวันที่' : 'Date Range'}
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${viewMode === 'monthly'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Calendar className="w-5 h-5" />
            {i18n.language === 'th' ? 'รายเดือน' : 'Monthly'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {i18n.language === 'th' ? 'เลือกข้อมูล' : 'Select Data'}
        </h2>

        {/* Date Filters - Conditional */}
        {viewMode === 'range' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {i18n.language === 'th' ? 'วันที่เริ่มต้น' : 'Start Date'}
              </label>
              <DatePicker
                value={startDate ? new Date(startDate) : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setStartDate(`${year}-${month}-${day}`);
                  } else {
                    setStartDate('');
                  }
                }}
                placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {i18n.language === 'th' ? 'วันที่สิ้นสุด' : 'End Date'}
              </label>
              <DatePicker
                value={endDate ? new Date(endDate) : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setEndDate(`${year}-${month}-${day}`);
                  } else {
                    setEndDate('');
                  }
                }}
                placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
              />
            </div>
          </div>
        ) : (
          /* Monthly Mode Selectors */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {i18n.language === 'th' ? 'เลือกปี' : 'Select Year'}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {i18n.language === 'th' ? 'เลือกเดือน' : 'Select Month'}
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const monthNames = i18n.language === 'th'
                    ? ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
                    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  return (
                    <option key={month} value={month}>
                      {month}. {monthNames[month - 1]}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {/* Include Trends Option */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="includeTrends"
            checked={includeTrends}
            onChange={(e) => setIncludeTrends(e.target.checked)}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <label htmlFor="includeTrends" className="text-sm text-gray-700 cursor-pointer">
            <TrendingUp className="w-4 h-4 inline mr-1" />
            {i18n.language === 'th' ? 'รวมข้อมูลแนวโน้มรายเดือน' : 'Include monthly trends'}
          </label>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading
            ? i18n.language === 'th'
              ? 'กำลังสร้างรายงาน...'
              : 'Generating Report...'
            : i18n.language === 'th'
              ? 'สร้างรายงาน'
              : 'Generate Report'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Report Display */}
      {reportData && (
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'ผลลัพธ์รายงาน' : 'Report Results'}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {i18n.language === 'th' ? 'ดาวน์โหลด Excel' : 'Download Excel'}
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                {i18n.language === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* Overall Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{reportData.overall_summary.total_departments}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'แผนก' : 'Departments'}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{reportData.overall_summary.active_employees}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'พนักงาน' : 'Employees'}</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-600">{reportData.overall_summary.total_leave_requests}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'คำขอลา' : 'Leave Requests'}</div>
            </div>
            <div className="bg-cyan-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-cyan-600">{reportData.overall_summary.total_shift_swaps}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'สลับวัน' : 'Shift Swaps'}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{reportData.overall_summary.approved_requests}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-600">
                {formatLeaveDays(reportData.overall_summary.total_days)}
              </div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'วันลาทั้งหมด' : 'Total Days'}</div>
            </div>
          </div>

          {/* Department Breakdown Table */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {i18n.language === 'th' ? 'รายละเอียดตามแผนก' : 'Department Breakdown'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'แผนก' : 'Department'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'พนักงาน' : 'Employees'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'คำขอลา' : 'Leave'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'สลับวัน' : 'Shift'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'เต็มวัน' : 'Full Day'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'ครึ่งเช้า/แรก' : 'Morning/1st Half'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'ครึ่งบ่าย/หลัง' : 'Afternoon/2nd Half'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'รายชั่วโมง' : 'Hourly'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'วันลาทั้งหมด' : 'Total Days'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {i18n.language === 'th' ? 'เฉลี่ย/คน' : 'Avg/Employee'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.departments.map((dept) => (
                    <tr key={dept.department_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {i18n.language === 'th' ? dept.department_name_th : dept.department_name_en}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{dept.active_employees}</td>
                      <td className="px-4 py-3 text-sm text-center text-indigo-600 font-medium">
                        {dept.total_leave_requests}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-cyan-600 font-medium">
                        {dept.total_shift_swaps}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-green-600 font-medium">
                        {dept.approved_requests}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {dept.pending_requests > 0 ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                            {dept.pending_requests}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {dept.total_full_day_requests || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {dept.total_half_day_morning || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {dept.total_half_day_afternoon || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {dept.total_hourly_requests || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{formatLeaveDays(dept.total_days)}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {dept.avg_days_per_employee.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leave Type Breakdown */}
          {reportData.leave_type_breakdown && reportData.leave_type_breakdown.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {i18n.language === 'th' ? 'รายละเอียดตามประเภทการลา' : 'Leave Type Breakdown'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportData.leave_type_breakdown.map((type) => (
                  <div key={type.leave_type_code} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {i18n.language === 'th' ? type.leave_type_name_th : type.leave_type_name_en}
                      </h4>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{type.leave_type_code}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{i18n.language === 'th' ? 'คำขอทั้งหมด:' : 'Total Requests:'}</span>
                        <span className="font-medium">{type.total_requests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{i18n.language === 'th' ? 'อนุมัติ:' : 'Approved:'}</span>
                        <span className="font-medium text-green-600">{type.approved_requests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{i18n.language === 'th' ? 'จำนวนวัน:' : 'Total Days:'}</span>
                        <span className="font-medium">{formatLeaveDays(type.total_days)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Trends */}
          {reportData.monthly_trends && reportData.monthly_trends.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {i18n.language === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly Trends'}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'เดือน' : 'Month'}
                      </th>
                      <th
                        className="px-4 py-3 text-center text-sm font-semibold text-gray-700"
                        title={i18n.language === 'th' ? 'จำนวนพนักงานที่ไม่ซ้ำกันที่ลางานในเดือนนี้' : 'Unique number of employees who took leave this month'}
                      >
                        {i18n.language === 'th' ? 'จำนวนคนที่ลาทั้งหมด' : 'Total People'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'แผนก' : 'Department'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'คำขอลา' : 'Leave Requests'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'สลับวัน' : 'Shift Swaps'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'วันลาทั้งหมด' : 'Total Days'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.monthly_trends.map((trend, index) => (
                      <tr key={`${trend.month}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{trend.month}</td>
                        <td className="px-4 py-3 text-sm text-center">{trend.total_people}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          {i18n.language === 'th' ? trend.department_name_th : trend.department_name_en}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{trend.leave_requests}</td>
                        <td className="px-4 py-3 text-sm text-center">{trend.shift_swaps}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{formatLeaveDays(trend.total_days)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
