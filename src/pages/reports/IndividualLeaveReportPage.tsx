/**
 * Individual Leave Report Page
 *
 * Generate comprehensive leave & shift swap report for a single employee
 * with PDF export and signature section
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Calendar, User, ArrowLeft, Search, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIndividualLeaveReport, IndividualReportData } from '../../api/reports';
import { exportIndividualLeaveReportPDF } from '../../utils/comprehensiveReportPDFExport';
import { getFiscalSettings, getFiscalMonthDateRange, FiscalSettings } from '../../api/fiscal';
import { useAuth } from '../../contexts/AuthContext';
import { DatePicker } from '../../components/common/DatePicker';
import { AttachmentBadge } from '../../components/common/AttachmentBadge';
import api from '../../api/auth';

interface Employee {
  id: string; // UUID from database
  employee_code: string;
  name_th: string; // Concatenated full name from API
  name_en: string; // Concatenated full name from API
  department_name_th?: string;
  department_name_en?: string;
  position_th?: string;
  position_en?: string;
}

export default function IndividualLeaveReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'range' | 'monthly'>('range');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<IndividualReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettings | null>(null);

  // Load fiscal settings on mount
  useEffect(() => {
    const loadFiscalSettings = async () => {
      try {
        const response = await getFiscalSettings();
        setFiscalSettings(response.settings);
      } catch (err) {
        console.error('Failed to load fiscal settings:', err);
        // Use default settings if API fails
        setFiscalSettings({
          id: null,
          cycle_start_day: 26,
          cycle_type: 'day_of_month',
          fiscal_year_start_month: 1,
          filter_pending_by_year: true,
          description_th: '',
          description_en: '',
          updated_at: null,
          updated_by: null,
        });
      }
    };
    loadFiscalSettings();
  }, []);

  // Set date range based on selected year/month using fiscal settings
  useEffect(() => {
    if (!fiscalSettings) return;

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const { start, end } = getFiscalMonthDateRange(selectedYear, selectedMonth, fiscalSettings);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  }, [selectedYear, selectedMonth, fiscalSettings]);

  // Load employees based on user role
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await api.get('/employees');
      let employeeList = response.data.employees || [];

      // Filter based on user role and permissions
      const isHrOrAdmin = ['hr', 'admin', 'dev'].includes(user?.role || '');
      const isDeptManager = user?.is_department_manager || false;

      if (isHrOrAdmin) {
        // HR and Admin can view all employees
        // No filtering needed
      } else if (isDeptManager && user?.department_id) {
        // Department managers can view employees in their department
        // Use department_id from AuthContext - no need for additional API call
        employeeList = employeeList.filter(
          (emp: any) => emp.department_id === user.department_id
        );
      } else {
        // Regular employees can only view their own report
        employeeList = employeeList.filter((emp: Employee) => emp.id === user?.id);
        if (employeeList.length > 0) {
          setSelectedEmployeeId(employeeList[0].id);
        }
      }

      setEmployees(employeeList);
    } catch (err: any) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedEmployeeId) {
      setError(i18n.language === 'th' ? 'กรุณาเลือกพนักงาน' : 'Please select an employee');
      return;
    }

    let finalStartDate = startDate;
    let finalEndDate = endDate;

    if (viewMode === 'monthly') {
      if (!fiscalSettings) {
        setError(i18n.language === 'th' ? 'ยังโหลดรอบงวดงานไม่เสร็จ' : 'Fiscal settings are still loading');
        return;
      }

      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const { start, end } = getFiscalMonthDateRange(selectedYear, selectedMonth, fiscalSettings);
      finalStartDate = formatDate(start);
      finalEndDate = formatDate(end);
    } else if (!startDate || !endDate) {
      setError(i18n.language === 'th' ? 'กรุณาเลือกช่วงวันที่' : 'Please select date range');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getIndividualLeaveReport({
        employee_id: selectedEmployeeId,
        start_date: finalStartDate,
        end_date: finalEndDate,
      });

      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const formatLeaveDays = (days: number) => {
    if (!days || days === 0) return '-';
    // If it's a whole number
    if (Number.isInteger(days)) return days.toFixed(1);

    // Check if it's less than 1 day and not 0.5 (which is usually half-day)
    if (days < 1 && days !== 0.5) {
      const totalHours = days * 8;
      const h = Math.floor(totalHours);
      const m = Math.round((totalHours - h) * 60);

      if (h === 0 && m === 0) return days.toFixed(2);

      const timeStr = m > 0
        ? i18n.language === 'th' ? `${h} ชม. ${m} น.` : `${h}h ${m}m`
        : i18n.language === 'th' ? `${h} ชม.` : `${h}h`;

      return timeStr;
    }

    return `${days} ${i18n.language === 'th' ? 'วัน' : 'days'}`;
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    const employeeName =
      i18n.language === 'th'
        ? reportData.employee.employee_name_th
        : reportData.employee.employee_name_en;

    const department =
      i18n.language === 'th'
        ? reportData.employee.department_th
        : reportData.employee.department_en;

    const position =
      i18n.language === 'th'
        ? reportData.employee.position_th
        : reportData.employee.position_en;

    exportIndividualLeaveReportPDF(
      {
        employee_code: reportData.employee.employee_code,
        employee_name: employeeName,
        department: department || '',
        position: position,
        records: [...reportData.records].sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'pending' ? -1 : 1;
        }).map((r) => ({
          date: r.date,
          leave_type: r.leave_type,
          duration: r.duration,
          status: r.status,
          is_shift_swap: r.is_shift_swap,
        })),
      },
      {
        title:
          i18n.language === 'th'
            ? 'รายงานการลาและสลับวันหยุด (รายบุคคล)'
            : 'Leave & Shift Swap Report (Individual)',
        subtitle: `${reportData.date_range.start} to ${reportData.date_range.end}`,
        reportType: 'individual',
        dateRange: { start: reportData.date_range.start, end: reportData.date_range.end },
        generatedBy: `${user?.first_name_en} ${user?.last_name_en}`,
        documentNumber: `LR-${new Date().getFullYear()}-${reportData.employee.employee_code}`,
        signatures: [
          {
            label: i18n.language === 'th' ? 'ลายเซ็นพนักงาน / Employee Signature' : 'Employee Signature',
            name: employeeName,
            position: position,
            showDate: true,
            showAcknowledgment: true,
          },
        ],
      }
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (emp.employee_code || '').toLowerCase().includes(searchLower) ||
      (emp.name_th || '').toLowerCase().includes(searchLower) ||
      (emp.name_en || '').toLowerCase().includes(searchLower)
    );
  });

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
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'รายงานรายบุคคล' : 'Individual Leave Report'}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th'
                ? 'รายงานการลาและสลับวันหยุดของพนักงานแต่ละคน'
                : 'Leave and shift swap report for individual employee'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {i18n.language === 'th' ? 'เลือกข้อมูล' : 'Select Data'}
        </h2>

        <div className="flex items-center justify-center gap-2 rounded-lg bg-gray-50 p-2">
          <button
            type="button"
            onClick={() => setViewMode('range')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'range'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            {i18n.language === 'th' ? 'ช่วงวันที่' : 'Date Range'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            {i18n.language === 'th' ? 'งวดรายเดือน' : 'Fiscal Month'}
          </button>
        </div>

        {/* Employee Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            {i18n.language === 'th' ? 'เลือกพนักงาน' : 'Select Employee'}
          </label>

          {/* Search */}
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={i18n.language === 'th' ? 'ค้นหารหัส หรือ ชื่อพนักงาน (กด Enter หรือคลิกค้นหา)' : 'Search by code or name (Press Enter or click Search)'}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {i18n.language === 'th' ? 'ค้นหา' : 'Search'}
            </button>
          </div>

          {loadingEmployees ? (
            <div className="text-center py-8 text-gray-500">
              {i18n.language === 'th' ? 'กำลังโหลดข้อมูลพนักงาน...' : 'Loading employees...'}
            </div>
          ) : (
            <select
              value={selectedEmployeeId || ''}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={user?.role === 'employee'}
            >
              <option value="">
                {i18n.language === 'th' ? '-- เลือกพนักงาน --' : '-- Select Employee --'}
              </option>
              {filteredEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} - {i18n.language === 'th' ? emp.name_th : emp.name_en}
                  {emp.department_name_th &&
                    ` (${i18n.language === 'th' ? emp.department_name_th : emp.department_name_en})`}
                </option>
              ))}
            </select>
          )}
        </div>

        {viewMode === 'range' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <Calendar className="mr-1 inline h-4 w-4" />
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
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <Calendar className="mr-1 inline h-4 w-4" />
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {i18n.language === 'th' ? 'เลือกปี' : 'Select Year'}
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm text-gray-600 flex justify-between items-center">
              <span>
                {i18n.language === 'th' ? 'ช่วงวันที่:' : 'Date Range:'}
              </span>
              <span className="font-medium text-gray-900">
                {new Date(startDate).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')} - {new Date(endDate).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')}
              </span>
            </div>
          </>
        )}


        {/* Generate Button */}
        <button
          onClick={handleGenerateReport}
          disabled={loading || !selectedEmployeeId}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {i18n.language === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}
            </button>
          </div>

          {/* Employee Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {i18n.language === 'th' ? 'ข้อมูลพนักงาน' : 'Employee Information'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'รหัสพนักงาน:' : 'Employee Code:'}</span>
                <div className="font-medium">{reportData.employee.employee_code}</div>
              </div>
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'ชื่อ:' : 'Name:'}</span>
                <div className="font-medium">
                  {i18n.language === 'th'
                    ? reportData.employee.employee_name_th
                    : reportData.employee.employee_name_en}
                </div>
              </div>
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'แผนก:' : 'Department:'}</span>
                <div className="font-medium">
                  {i18n.language === 'th' ? reportData.employee.department_th : reportData.employee.department_en}
                </div>
              </div>
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'ตำแหน่ง:' : 'Position:'}</span>
                <div className="font-medium">
                  {i18n.language === 'th' ? reportData.employee.position_th : reportData.employee.position_en}
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{reportData.summary.total_records}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'รายการทั้งหมด' : 'Total Records'}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{reportData.summary.total_approved}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-600">{reportData.summary.total_pending}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{reportData.summary.total_days_taken}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'วันลาที่ใช้' : 'Days Taken'}</div>
            </div>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {i18n.language === 'th' ? 'วันที่' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {i18n.language === 'th' ? 'ประเภท' : 'Type'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {i18n.language === 'th' ? 'ระยะเวลา' : 'Duration'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {i18n.language === 'th' ? 'สถานะ' : 'Status'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {i18n.language === 'th' ? 'หมวดหมู่' : 'Category'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {i18n.language === 'th' ? 'ไฟล์แนบ' : 'Attachments'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[...reportData.records]
                  .sort((a, b) => {
                    if (a.status === b.status) return 0;
                    return a.status === 'pending' ? -1 : 1;
                  })
                  .map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{record.leave_type}</td>
                      <td className="px-4 py-3 text-sm">{formatLeaveDays(record.total_days)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'approved' ? 'bg-green-100 text-green-800' :
                            record.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                              record.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {record.status === 'approved' ? (i18n.language === 'th' ? 'อนุมัติ' : 'Approved') :
                            record.status === 'pending' ? (i18n.language === 'th' ? 'รออนุมัติ' : 'Pending') :
                              record.status === 'rejected' ? (i18n.language === 'th' ? 'ไม่อนุมัติ' : 'Rejected') :
                                record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${record.is_shift_swap ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}
                        >
                          {record.is_shift_swap
                            ? i18n.language === 'th'
                              ? 'สลับวัน'
                              : 'Shift Swap'
                            : i18n.language === 'th'
                              ? 'ลา'
                              : 'Leave'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {record.attachment_urls && record.attachment_urls.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            <AttachmentBadge
                              count={record.attachment_urls.length}
                              attachments={record.attachment_urls}
                            />
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )
      }
    </div >
  );
}
