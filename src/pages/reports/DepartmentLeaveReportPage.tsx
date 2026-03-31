/**
 * Department Leave Report Page
 *
 * Generate comprehensive leave & shift swap report for entire department
 * with PDF export and manager signature section
 */

import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Download, Calendar, ArrowLeft, Search, Table2, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { getDepartmentLeaveReport, DepartmentReportData, getMonthlyAttendanceReport, MonthlyAttendanceReport } from '../../api/reports';
import { exportDepartmentDetailedReportPDF } from '../../utils/comprehensiveReportPDFExport';
import { exportMonthlyAttendancePDF } from '../../utils/monthlyAttendancePDFExport';
import { getFiscalSettings, getFiscalYearDateRange, calculateFiscalYear } from '../../api/fiscal';
import { useAuth } from '../../contexts/AuthContext';
import { DatePicker } from '../../components/common/DatePicker';
import { AttachmentBadge } from '../../components/common/AttachmentBadge';
import api from '../../api/auth';

interface Department {
  id: string; // UUID from database
  code: string;
  name_th: string;
  name_en: string;
}

export default function DepartmentLeaveReportPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'monthly'>('monthly'); // Default to monthly calendar

  // Summary view states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<DepartmentReportData | null>(null);

  // Monthly view states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [monthlyReportData, setMonthlyReportData] = useState<MonthlyAttendanceReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [summaryGroupBy, setSummaryGroupBy] = useState<'employee' | 'leaveType'>('employee');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  const toggleExpandEmployee = (empId: string) => {
    if (expandedEmployeeId === empId) {
      setExpandedEmployeeId(null);
    } else {
      setExpandedEmployeeId(empId);
    }
  };

  // Set default date range based on fiscal year settings
  useEffect(() => {
    const loadDefaultDateRange = async () => {
      try {
        const response = await getFiscalSettings();
        const settings = response.settings;
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
      } catch (_err) {
        // Fallback to calendar year if API fails
        const currentYear = new Date().getFullYear();
        setStartDate(`${currentYear}-01-01`);
        setEndDate(`${currentYear}-12-31`);
      }
    };
    loadDefaultDateRange();
  }, []);

  // Load departments based on user role
  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDepartments = async () => {
    setLoadingDepts(true);
    try {
      const response = await api.get('/departments');
      let deptList = response.data.departments || [];

      // Filter based on user role
      // Check for is_department_manager flag, NOT role === 'manager'
      // Department managers have is_department_manager: true but role is still 'employee'
      const isHrOrAdmin = ['hr', 'admin', 'dev'].includes(user?.role || '');
      const isDeptManager = user?.is_department_manager || false;

      if (!isHrOrAdmin && isDeptManager && user?.department_id) {
        // Department managers can only view their own department
        // Use department_id from AuthContext - no need for additional API call
        deptList = deptList.filter((dept: any) => dept.id === user.department_id);
        if (deptList.length > 0) {
          setSelectedDeptId(deptList[0].id);
        }
      }
      // HR and Admin can view all departments

      setDepartments(deptList);
    } catch (err: any) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedDeptId) {
      setError(i18n.language === 'th' ? 'กรุณาเลือกแผนก' : 'Please select a department');
      return;
    }

    if (!startDate || !endDate) {
      setError(i18n.language === 'th' ? 'กรุณาเลือกช่วงวันที่' : 'Please select date range');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedDeptId === 'all') {
        const promises = departments.map(dept =>
          getDepartmentLeaveReport({
            department_id: dept.id,
            start_date: startDate,
            end_date: endDate,
            include_details: true,
          }).catch(err => {
            console.error(`Failed to fetch report for department ${dept.id}:`, err);
            return null;
          })
        );

        const results = await Promise.all(promises);
        const validResults = results.filter((res): res is DepartmentReportData => res !== null);

        if (validResults.length === 0) {
          throw new Error('No data available for any department');
        }

        // Aggregate Data and Sort
        const aggregatedEmployees = validResults.flatMap(res =>
          res.employees.map(emp => ({
            ...emp,
            // Attach department info to employee for grouping in PDF
            department_code: res.department.code,
            department_name_th: res.department.name_th,
            department_name_en: res.department.name_en
          }))
        ).sort((a, b) => {
          // Sort by Department Code first (if all departments)
          if (a.department_code && b.department_code && a.department_code !== b.department_code) {
            return a.department_code.localeCompare(b.department_code);
          }
          // Then by Employee Code
          return a.employee_code.localeCompare(b.employee_code);
        });

        const aggregatedTotalEmployees = validResults.reduce((sum, res) => sum + res.summary.total_employees, 0);
        const aggregatedTotalLeave = validResults.reduce((sum, res) => sum + res.summary.total_leave_requests, 0);
        const aggregatedTotalShift = validResults.reduce((sum, res) => sum + res.summary.total_shift_swaps, 0);
        const aggregatedTotalApproved = validResults.reduce((sum, res) => sum + res.summary.total_approved_requests, 0);
        const aggregatedTotalPending = validResults.reduce((sum, res) => sum + res.summary.total_pending_requests, 0);
        const aggregatedTotalDays = validResults.reduce((sum, res) => sum + res.summary.total_days, 0);

        setReportData({
          department: {
            id: 'all',
            code: 'ALL',
            name_th: 'ทุกแผนก (All Departments)',
            name_en: 'All Departments'
          },
          date_range: validResults[0].date_range,
          employees: aggregatedEmployees,
          summary: {
            total_employees: aggregatedTotalEmployees,
            total_leave_requests: aggregatedTotalLeave,
            total_shift_swaps: aggregatedTotalShift,
            total_approved_requests: aggregatedTotalApproved,
            total_pending_requests: aggregatedTotalPending,
            total_days: aggregatedTotalDays
          }
        });

      } else {
        const data = await getDepartmentLeaveReport({
          department_id: selectedDeptId,
          start_date: startDate,
          end_date: endDate,
          include_details: true,
        });

        // Sort by employee code
        data.employees.sort((a, b) => a.employee_code.localeCompare(b.employee_code));

        setReportData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    try {
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const deptName = i18n.language === 'th' ? reportData.department.name_th : reportData.department.name_en;
      const summaryData: any[] = [
        ['Department Leave Report'],
        [`Department: ${deptName} (${reportData.department.code})`],
        [`Period: ${startDate} to ${endDate}`],
        [],
        ['Summary'],
        ['Total Employees', reportData.summary.total_employees],
        ['Total Requests', reportData.summary.total_leave_requests],
        ['Total Days', reportData.summary.total_days.toFixed(2)],
        [],
        ['Employee Summary']
      ];

      const isAllDepts = reportData.department.code === 'ALL';
      const summaryHeaders = ['Code', 'Name', 'Leave Requests', 'Days Taken', 'Pending'];
      if (isAllDepts) {
        summaryHeaders.unshift('Department');
      }
      summaryData.push(summaryHeaders);

      reportData.employees.forEach(emp => {
        const row = [
          emp.employee_code,
          i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en,
          emp.total_leave_requests,
          emp.total_days_taken.toFixed(2),
          emp.pending_requests
        ];
        if (isAllDepts) {
          row.unshift((emp as any).department_code || '');
        }
        summaryData.push(row);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Detailed Records Sheet
      const detailedHeaders = ['Employee Code', 'Employee Name', 'Date', 'Type', 'Duration', 'Days', 'Status', 'Reason'];
      if (isAllDepts) {
        detailedHeaders.unshift('Department');
      }
      const detailedData: any[] = [detailedHeaders];

      reportData.employees.forEach(emp => {
        if (emp.records) {
          emp.records.forEach(rec => {
            const row = [
              emp.employee_code,
              i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en,
              rec.date, // Start Date
              rec.leave_type,
              rec.duration,
              rec.total_days,
              rec.status,
              rec.reason || ''
            ];
            if (isAllDepts) {
              row.unshift((emp as any).department_code || '');
            }
            detailedData.push(row);
          });
        }
      });

      const wsDetails = XLSX.utils.aoa_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Detailed Records');

      XLSX.writeFile(wb, `Department_Leave_Report_${reportData.department.code}_${startDate}_${endDate}.xlsx`);
    } catch (error) {
      console.error('Export Excel Error:', error);
      alert(i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการส่งออก Excel' : 'Error exporting Excel');
    }
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    const deptName =
      i18n.language === 'th'
        ? reportData.department.name_th
        : reportData.department.name_en;

    // Use the new detailed report export with per-employee leave dates
    exportDepartmentDetailedReportPDF(
      {
        department: reportData.department,
        date_range: reportData.date_range,
        employees: reportData.employees.map(emp => ({
          ...emp,
          records: emp.records ? [...emp.records].sort((a, b) => {
            if (a.status === b.status) return 0;
            return a.status === 'pending' ? -1 : 1;
          }) : []
        })),
        summary: reportData.summary,
      },
      {
        title:
          i18n.language === 'th'
            ? 'รายงานสรุปการลาและสลับวันหยุด (รายแผนก)'
            : 'Leave & Shift Swap Detail Report (Department)',
        subtitle: `${deptName} | ${startDate} to ${endDate}`,
        dateRange: { start: startDate, end: endDate },
        generatedBy: `${i18n.language === 'th' ? user?.first_name_th : user?.first_name_en} ${i18n.language === 'th' ? user?.last_name_th : user?.last_name_en}`,
        documentNumber: `DR-${new Date().getFullYear()}-${reportData.department.code}`,
        language: i18n.language === 'th' ? 'th' : 'en',
      }
    );
  };

  const handleGenerateMonthlyReport = async () => {
    if (!selectedDeptId) {
      setError(i18n.language === 'th' ? 'กรุณาเลือกแผนก' : 'Please select a department');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedDeptId === 'all') {
        const promises = departments.map(dept =>
          getMonthlyAttendanceReport({
            department_id: dept.id,
            year: selectedYear,
            month: selectedMonth,
          }).catch(err => {
            console.error(`Failed to fetch report for department ${dept.id}:`, err);
            return null;
          })
        );

        const results = await Promise.all(promises);
        const validResults = results.filter((res): res is MonthlyAttendanceReport => res !== null);

        if (validResults.length === 0) {
          throw new Error('No data available for any department');
        }

        // Aggregate Data and Sort
        const aggregatedEmployees = validResults.flatMap(res =>
          res.employees.map(emp => ({
            ...emp,
            // Attach department info to employee for grouping in PDF
            department_code: res.department.code,
            department_name_th: res.department.name_th,
            department_name_en: res.department.name_en
          }))
        ).sort((a, b) => {
          // Sort by Department Code first (if all departments)
          if ((a as any).department_code && (b as any).department_code && (a as any).department_code !== (b as any).department_code) {
            return (a as any).department_code.localeCompare((b as any).department_code);
          }
          // Then by Employee Code
          return a.employee_code.localeCompare(b.employee_code);
        });

        const aggregatedTotalEmployees = validResults.reduce((sum, res) => sum + res.summary.total_employees, 0);
        const aggregatedTotalLeave = validResults.reduce((sum, res) => sum + res.summary.total_leave_days, 0);
        const aggregatedTotalShift = validResults.reduce((sum, res) => sum + res.summary.total_shift_swaps, 0);

        setMonthlyReportData({
          department: {
            id: 'all',
            code: 'ALL',
            name_th: 'ทุกแผนก (All Departments)',
            name_en: 'All Departments'
          },
          year: validResults[0].year,
          month: validResults[0].month,
          days_in_month: validResults[0].days_in_month,
          calendar_dates: validResults[0].calendar_dates,
          employees: aggregatedEmployees,
          summary: {
            total_employees: aggregatedTotalEmployees,
            total_leave_days: aggregatedTotalLeave,
            total_shift_swaps: aggregatedTotalShift,
          }
        });

      } else {
        const data = await getMonthlyAttendanceReport({
          department_id: selectedDeptId,
          year: selectedYear,
          month: selectedMonth,
        });

        // Sort by employee code
        data.employees.sort((a, b) => a.employee_code.localeCompare(b.employee_code));

        setMonthlyReportData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate monthly report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMonthlyPDF = () => {
    if (!monthlyReportData) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthNamesTh = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const deptName = i18n.language === 'th'
      ? monthlyReportData.department.name_th
      : monthlyReportData.department.name_en;

    const monthName = i18n.language === 'th'
      ? monthNamesTh[monthlyReportData.month - 1]
      : monthNames[monthlyReportData.month - 1];

    exportMonthlyAttendancePDF({
      department_name: deptName,
      year: monthlyReportData.year,
      month: monthlyReportData.month,
      month_name: monthName,
      days_in_month: monthlyReportData.days_in_month,
      calendar_dates: monthlyReportData.calendar_dates, // Pass fiscal year dates
      employees: monthlyReportData.employees.map(emp => ({
        employee_code: emp.employee_code,
        employee_name: i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en,
        position: i18n.language === 'th' ? emp.position_th : emp.position_en,
        days: emp.days,
        total_leave_days: emp.total_leave_days,
        total_shift_swaps: emp.total_shift_swaps,
      })),
    });
  };

  const handleExportMonthlyExcel = () => {
    if (!monthlyReportData) return;

    try {
      const wb = XLSX.utils.book_new();
      const monthNames = i18n.language === 'th'
        ? ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[monthlyReportData.month - 1];

      const deptName = i18n.language === 'th' ? monthlyReportData.department.name_th : monthlyReportData.department.name_en;

      // Headers
      const headers = [
        'Employee Code',
        'Employee Name',
        'Position',
        ...monthlyReportData.calendar_dates.map(dateStr => dateStr.split('-')[2]), // Day numbers
        'Total Leave',
        'Total Swap'
      ];

      const data: any[] = [
        ['Department Monthly Attendance Report'],
        [`Department: ${deptName}`],
        [`Period: ${monthName} ${monthlyReportData.year}`],
        [],
        headers
      ];

      monthlyReportData.employees.forEach(emp => {
        const row = [
          emp.employee_code,
          i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en,
          i18n.language === 'th' ? emp.position_th : emp.position_en,
          ...monthlyReportData.calendar_dates.map(dateStr => {
            const dayStatus = emp.days.find(d => d.date === dateStr);
            if (!dayStatus) return '';

            // Check leave
            let val = '';
            if (dayStatus.leave_type) {
              const code = dayStatus.leave_code || (dayStatus.leave_type || '').substring(0, 4).toUpperCase();

              if (dayStatus.leave_duration === 'hourly') {
                val = `${code} ${Number(dayStatus.leave_hours || 0).toFixed(1)}h`;
              } else if (dayStatus.leave_duration === 'half_day_morning') {
                val = `${code} 1/2AM`;
              } else if (dayStatus.leave_duration === 'half_day_afternoon') {
                val = `${code} 1/2PM`;
              } else {
                val = code;
              }
            }
            if (dayStatus.is_shift_swap) {
              val = val ? `${val}, Swap` : 'Swap';
            }
            return val;
          }),
          emp.total_leave_days,
          emp.total_shift_swaps
        ];
        data.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
      XLSX.writeFile(wb, `Monthly_Report_${monthlyReportData.department.code}_${monthlyReportData.year}_${monthlyReportData.month}.xlsx`);
    } catch (error) {
      console.error('Export Excel Error:', error);
      alert(i18n.language === 'th' ? 'เกิดข้อผิดพลาดในการส่งออก Excel' : 'Error exporting Excel');
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      dept.code.toLowerCase().includes(searchLower) ||
      dept.name_th.toLowerCase().includes(searchLower) ||
      dept.name_en.toLowerCase().includes(searchLower)
    );
  });

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

    return days.toFixed(1);
  };

  const renderLeaveTypeSummary = () => {
    if (!reportData) return null;

    // Group by Leave Type Code
    const groups: Record<string, {
      code: string,
      name: string,
      employees: Record<string, {
        emp: any,
        approvedDays: number,
        approvedCount: number,
        pendingDays: number,
        pendingCount: number
      }>
    }> = {};

    reportData.employees.forEach(emp => {
      if (emp.records) {
        emp.records.forEach(rec => {
          // Exclude rejected records from the summary
          if (rec.status === 'rejected') return;

          const code = rec.leave_type_code || 'OTHER';
          if (!groups[code]) {
            groups[code] = {
              code,
              name: rec.leave_type, // Using the name from record
              employees: {}
            };
          }

          if (!groups[code].employees[emp.employee_id]) {
            groups[code].employees[emp.employee_id] = {
              emp,
              approvedDays: 0,
              approvedCount: 0,
              pendingDays: 0,
              pendingCount: 0
            };
          }

          if (rec.status === 'approved') {
            groups[code].employees[emp.employee_id].approvedDays += rec.total_days;
            groups[code].employees[emp.employee_id].approvedCount += 1;
          } else if (rec.status === 'pending') {
            groups[code].employees[emp.employee_id].pendingDays += rec.total_days;
            groups[code].employees[emp.employee_id].pendingCount += 1;
          }
        });
      }
    });

    const sortedCodes = Object.keys(groups).sort();

    return (
      <div className="space-y-6">
        {sortedCodes.map(code => {
          const group = groups[code];
          const empIds = Object.keys(group.employees);

          return (
            <div key={code} className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b font-bold text-gray-800 flex justify-between">
                <span>{group.name}</span>
                <span className="text-sm font-normal text-gray-500">
                  {empIds.length} {i18n.language === 'th' ? 'คน' : 'employees'}
                </span>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รหัส' : 'Code'}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ชื่อ' : 'Name'}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-green-700 uppercase bg-green-50 border-l border-green-100" colSpan={2}>
                      {i18n.language === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-amber-700 uppercase bg-amber-50 border-l border-amber-100" colSpan={2}>
                      {i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}
                    </th>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-1"></th>
                    <th className="px-4 py-1"></th>
                    <th className="px-2 py-1 text-right text-[10px] text-green-600 font-medium bg-green-50 border-l border-green-100">{i18n.language === 'th' ? 'ครั้ง' : 'Count'}</th>
                    <th className="px-2 py-1 text-right text-[10px] text-green-600 font-medium bg-green-50">{i18n.language === 'th' ? 'วัน' : 'Days'}</th>
                    <th className="px-2 py-1 text-right text-[10px] text-amber-600 font-medium bg-amber-50 border-l border-amber-100">{i18n.language === 'th' ? 'ครั้ง' : 'Count'}</th>
                    <th className="px-2 py-1 text-right text-[10px] text-amber-600 font-medium bg-amber-50">{i18n.language === 'th' ? 'วัน' : 'Days'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {empIds.map(empId => {
                    const item = group.employees[empId];
                    return (
                      <tr key={empId}>
                        <td className="px-4 py-2 text-sm text-gray-900">{item.emp.employee_code}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {i18n.language === 'th' ? item.emp.employee_name_th : item.emp.employee_name_en}
                        </td>

                        {/* Approved */}
                        <td className="px-2 py-2 text-sm text-gray-900 text-right border-l border-gray-100 bg-green-50/30">
                          {item.approvedCount > 0 ? item.approvedCount : '-'}
                        </td>
                        <td className="px-2 py-2 text-sm font-medium text-gray-900 text-right bg-green-50/30">
                          {item.approvedDays > 0 ? formatLeaveDays(item.approvedDays) : '-'}
                        </td>

                        {/* Pending */}
                        <td className="px-2 py-2 text-sm text-gray-900 text-right border-l border-gray-100 bg-amber-50/30">
                          {item.pendingCount > 0 ? item.pendingCount : '-'}
                        </td>
                        <td className="px-2 py-2 text-sm font-medium text-gray-900 text-right bg-amber-50/30">
                          {item.pendingDays > 0 ? formatLeaveDays(item.pendingDays) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        {sortedCodes.length === 0 && (
          <p className="text-center text-gray-500 py-4">No leave records found.</p>
        )}
      </div>
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
          <Building2 className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'รายงานรายแผนก' : 'Department Leave Report'}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th'
                ? 'สรุปการลาและสลับวันหยุดของพนักงานทั้งแผนก'
                : 'Summary of leave and shift swaps for entire department'}
            </p>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${viewMode === 'monthly'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Table2 className="w-5 h-5" />
            {i18n.language === 'th' ? 'รายงานรายเดือน (ตารางวันที่)' : 'Monthly Calendar Report'}
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${viewMode === 'summary'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Building2 className="w-5 h-5" />
            {i18n.language === 'th' ? 'รายงานสรุป (ช่วงวันที่)' : 'Summary Report'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {i18n.language === 'th' ? 'เลือกข้อมูล' : 'Select Data'}
        </h2>

        {/* Department Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="w-4 h-4 inline mr-1" />
            {i18n.language === 'th' ? 'เลือกแผนก' : 'Select Department'}
          </label>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={i18n.language === 'th' ? 'ค้นหารหัส หรือ ชื่อแผนก' : 'Search by code or name'}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {loadingDepts ? (
            <div className="text-center py-8 text-gray-500">
              {i18n.language === 'th' ? 'กำลังโหลดข้อมูลแผนก...' : 'Loading departments...'}
            </div>
          ) : (
            <select
              value={selectedDeptId || ''}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={user?.is_department_manager && !['hr', 'admin', 'dev'].includes(user?.role || '')}
            >
              <option value="">
                {i18n.language === 'th' ? '-- เลือกแผนก --' : '-- Select Department --'}
              </option>
              {(user?.role === 'hr' || user?.role === 'admin' || user?.role === 'dev') && (
                <option value="all">
                  {i18n.language === 'th' ? 'ทุกแผนก (All Departments)' : 'All Departments'}
                </option>
              )}
              {filteredDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} - {i18n.language === 'th' ? dept.name_th : dept.name_en}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date/Period Selection - Conditional based on view mode */}
        {viewMode === 'monthly' ? (
          // Monthly View: Year and Month Selection
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                {i18n.language === 'th' ? 'เลือกปี' : 'Select Year'}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
        ) : (
          // Summary View: Date Range Selection
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
        )}

        {/* Generate Button */}
        <button
          onClick={viewMode === 'monthly' ? handleGenerateMonthlyReport : handleGenerateReport}
          disabled={loading || !selectedDeptId}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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

          {/* Department Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {i18n.language === 'th' ? 'ข้อมูลแผนก' : 'Department Information'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'รหัสแผนก:' : 'Dept Code:'}</span>
                <div className="font-medium">{reportData.department.code}</div>
              </div>
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'ชื่อแผนก:' : 'Department:'}</span>
                <div className="font-medium">
                  {i18n.language === 'th' ? reportData.department.name_th : reportData.department.name_en}
                </div>
              </div>
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'พนักงานทั้งหมด:' : 'Total Employees:'}</span>
                <div className="font-medium">{reportData.summary.total_employees}</div>
              </div>
              <div>
                <span className="text-gray-600">{i18n.language === 'th' ? 'วันลาทั้งหมด:' : 'Total Days:'}</span>
                <div className="font-medium">{formatLeaveDays(reportData.summary.total_days)}</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{reportData.summary.total_leave_requests}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'คำขอลา' : 'Leave Requests'}</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-600">{reportData.summary.total_shift_swaps}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'สลับวัน' : 'Shift Swaps'}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{reportData.summary.total_approved_requests}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-600">{reportData.summary.total_pending_requests}</div>
              <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}</div>
            </div>
          </div>

          {/* Employee Summary Table */}
          <div>
            <div className="flex justify-end mb-4 space-x-2">
              <button
                onClick={() => setSummaryGroupBy('employee')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${summaryGroupBy === 'employee'
                  ? 'bg-green-100 text-green-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {i18n.language === 'th' ? 'แยกตามพนักงาน' : 'By Employee'}
              </button>
              <button
                onClick={() => setSummaryGroupBy('leaveType')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${summaryGroupBy === 'leaveType'
                  ? 'bg-green-100 text-green-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {i18n.language === 'th' ? 'แยกตามประเภทการลา' : 'By Leave Type'}
              </button>
            </div>

            {summaryGroupBy === 'leaveType' ? renderLeaveTypeSummary() : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-10">
                        {/* Expand Toggle */}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'รหัสพนักงาน' : 'Employee Code'}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'ชื่อ' : 'Name'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'คำขอลา' : 'Leave'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'สลับวัน' : 'Shift'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        {i18n.language === 'th' ? 'วันลาที่ใช้' : 'Days Taken'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.employees.map((emp) => (
                      <Fragment key={emp.employee_id}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpandEmployee(emp.employee_id)}>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {expandedEmployeeId === emp.employee_id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3 text-sm">{emp.employee_code}</td>
                          <td className="px-4 py-3 text-sm">
                            {i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="text-blue-600 font-medium">{emp.approved_leave_requests}</span>
                            <span className="text-gray-400 text-xs">/{emp.total_leave_requests}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="text-indigo-600 font-medium">{emp.approved_shift_swaps}</span>
                            <span className="text-gray-400 text-xs">/{emp.total_shift_swaps}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            {emp.pending_requests > 0 ? (
                              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                                {emp.pending_requests}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-center font-medium">{formatLeaveDays(emp.total_days_taken)}</td>
                        </tr>
                        {/* Expanded Details Row */}
                        {expandedEmployeeId === emp.employee_id && (
                          <tr>
                            <td colSpan={7} className="px-0 py-0 border-b border-gray-200 bg-gray-50">
                              <div className="p-4 pl-12">
                                <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                                  {i18n.language === 'th' ? 'รายละเอียดการลา' : 'Leave Details'}
                                </h4>
                                {emp.records && emp.records.length > 0 ? (
                                  <div className="bg-white rounded border shadow-sm overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100 border-b">
                                        <tr>
                                          <th className="px-3 py-2 text-left">{i18n.language === 'th' ? 'วันที่' : 'Date'}</th>
                                          <th className="px-3 py-2 text-left">{i18n.language === 'th' ? 'ประเภท' : 'Type'}</th>
                                          <th className="px-3 py-2 text-left">{i18n.language === 'th' ? 'ระยะเวลา' : 'Duration'}</th>
                                          <th className="px-3 py-2 text-left">{i18n.language === 'th' ? 'สถานะ' : 'Status'}</th>
                                          <th className="px-3 py-2 text-left">{i18n.language === 'th' ? 'ไฟล์แนบ' : 'Attachments'}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {[...emp.records]
                                          .sort((a, b) => {
                                            if (a.status === b.status) return 0;
                                            return a.status === 'pending' ? -1 : 1;
                                          })
                                          .map((rec) => (
                                            <tr key={rec.id} className="hover:bg-gray-50">
                                              <td className="px-3 py-2">{new Date(rec.date).toLocaleDateString()}</td>
                                              <td className="px-3 py-2">
                                                {rec.is_shift_swap
                                                  ? (i18n.language === 'th' ? 'สลับวัน' : 'Shift Swap')
                                                  : rec.leave_type}
                                              </td>
                                              <td className="px-3 py-2">{rec.duration}</td>
                                              <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rec.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                  rec.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                    rec.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                      'bg-gray-100 text-gray-800'
                                                  }`}>
                                                  {rec.status === 'approved' ? (i18n.language === 'th' ? 'อนุมัติ' : 'Approved') :
                                                    rec.status === 'pending' ? (i18n.language === 'th' ? 'รออนุมัติ' : 'Pending') :
                                                      rec.status === 'rejected' ? (i18n.language === 'th' ? 'ไม่อนุมัติ' : 'Rejected') :
                                                        rec.status}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2">
                                                {rec.attachment_urls && rec.attachment_urls.length > 0 ? (
                                                  <div className="flex flex-wrap gap-2">
                                                    <AttachmentBadge
                                                      count={rec.attachment_urls.length}
                                                      attachments={rec.attachment_urls}
                                                    />
                                                  </div>
                                                ) : (
                                                  <span className="text-gray-300">-</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 italic text-sm py-2">No records found for this period.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )
      }

      {/* Monthly Report Display */}
      {
        monthlyReportData && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {i18n.language === 'th' ? 'ผลลัพธ์รายงานรายเดือน' : 'Monthly Report Results'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportMonthlyPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {i18n.language === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}
                </button>
                <button
                  onClick={handleExportMonthlyExcel} // Assuming this function exists or will be implemented
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {/* Assuming FileSpreadsheet icon is available */}
                  <FileSpreadsheet className="w-4 h-4" />
                  {i18n.language === 'th' ? 'ดาวน์โหลด Excel' : 'Download Excel'}
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">
                {i18n.language === 'th' ? 'ข้อมูลรายงาน' : 'Report Information'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">{i18n.language === 'th' ? 'แผนก:' : 'Department:'}</span>
                  <div className="font-medium">
                    {i18n.language === 'th' ? monthlyReportData.department.name_th : monthlyReportData.department.name_en}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">{i18n.language === 'th' ? 'เดือน (งวดงาน):' : 'Fiscal Month:'}</span>
                  <div className="font-medium">{monthlyReportData.month}/{monthlyReportData.year}</div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const m = monthlyReportData.month;
                      const y = monthlyReportData.year;
                      const prevD = new Date(y, m - 2, 26); // m-1 is current, m-2 is previous
                      const currD = new Date(y, m - 1, 25);

                      const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
                      const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

                      return `(${prevD.toLocaleDateString(locale, opts)} - ${currD.toLocaleDateString(locale, opts)})`;
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">{i18n.language === 'th' ? 'พนักงานทั้งหมด:' : 'Total Employees:'}</span>
                  <div className="font-medium">{monthlyReportData.summary.total_employees}</div>
                </div>
                <div>
                  <span className="text-gray-600">{i18n.language === 'th' ? 'วันลาทั้งหมด:' : 'Total Leave Days:'}</span>
                  <div className="font-medium">{monthlyReportData.summary.total_leave_days}</div>
                </div>
              </div>
            </div>

            {/* Calendar Preview Note */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm text-blue-800">
                {i18n.language === 'th'
                  ? '✓ รายงานพร้อมแล้ว! กดปุ่ม "ดาวน์โหลด PDF" เพื่อดูตารางวันที่แบบเต็มพร้อมช่องลายเซ็น (รูปแบบ A4)'
                  : '✓ Report ready! Click "Download PDF" to view the full calendar table with signature spaces (A4 format)'}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                {i18n.language === 'th'
                  ? 'ตารางจะแสดง: รหัสพนักงาน | ชื่อ | ตำแหน่ง | วันที่ 1-31 (ทำเครื่องหมาย L=ลา, S=สลับวัน) | สรุป | ลายเซ็น'
                  : 'Table shows: Employee Code | Name | Position | Dates (Mark L=Leave, S=Swap) | Summary | Signature'}
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{monthlyReportData.summary.total_employees}</div>
                <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'พนักงาน' : 'Employees'}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{monthlyReportData.summary.total_leave_days}</div>
                <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'วันลา' : 'Leave Days'}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{monthlyReportData.summary.total_shift_swaps}</div>
                <div className="text-sm text-gray-600">{i18n.language === 'th' ? 'สลับวัน' : 'Shift Swaps'}</div>
              </div>
            </div>

            {/* Employee List */}
            {/* Employee List (Detailed Grid) */}
            <div className="overflow-x-auto border rounded-xl shadow-sm">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-100 px-2 py-3 text-left text-xs font-bold text-gray-700 w-16 border-r border-gray-300 shadow-sm">
                      {i18n.language === 'th' ? 'รหัส' : 'Code'}
                    </th>
                    <th className="sticky left-16 z-10 bg-gray-100 px-2 py-3 text-left text-xs font-bold text-gray-700 w-40 border-r border-gray-300 shadow-sm">
                      {i18n.language === 'th' ? 'ชื่อ - นามสกุล' : 'Full Name'}
                    </th>
                    {monthlyReportData.calendar_dates.map((dateStr) => {
                      const day = parseInt(dateStr.split('-')[2]);
                      // Check if weekend
                      const dateObj = new Date(dateStr);
                      const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                      return (
                        <th key={dateStr} className={`px-1 py-2 text-center text-xs font-semibold text-gray-600 border-r border-gray-200 min-w-[2.5rem] ${isWknd ? 'bg-gray-50' : ''}`}>
                          {day}
                        </th>
                      );
                    })}
                    <th className="px-2 py-3 text-center text-xs font-bold text-gray-700 bg-gray-50 border-l border-gray-300 min-w-[3rem]">
                      {i18n.language === 'th' ? 'รวม' : 'Total'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {monthlyReportData.employees.map((emp) => (
                    <tr key={emp.employee_id} className="hover:bg-gray-50 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-2 py-2 text-xs font-mono text-gray-900 border-r border-gray-200 shadow-sm group-hover:bg-gray-50">
                        {emp.employee_code}
                      </td>
                      <td className="sticky left-16 z-10 bg-white px-2 py-2 text-xs text-gray-900 font-medium truncate max-w-[10rem] border-r border-gray-200 shadow-sm group-hover:bg-gray-50" title={i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en}>
                        {i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en}
                      </td>
                      {monthlyReportData.calendar_dates.map((dateStr) => {
                        // Find record by date string
                        const record = emp.days.find((d) => d.date === dateStr);
                        let content = <span className="text-gray-200 text-[10px]">-</span>;
                        let cellClass = "";

                        if (record) {
                          if (record.is_shift_swap) {
                            content = <span className="font-bold text-blue-600 text-xs">S</span>;
                            cellClass = "bg-blue-50";
                          } else if (record.leave_code || record.leave_type) {
                            // Determine color based on leave type (heuristic)
                            const code = record.leave_code || 'L';
                            const { colorClass, bgClass } = (() => {
                              if (record.status !== 'approved') {
                                return {
                                  colorClass: "text-gray-500",
                                  bgClass: "bg-gray-50 border border-gray-200 border-dashed",
                                };
                              }

                              if (['SL', 'Sick', 'sick', 'ลาป่วย'].some(s => code.includes(s) || (record.leave_type && record.leave_type.includes(s)))) {
                                return { colorClass: "text-red-700", bgClass: "bg-red-50" };
                              }
                              if (['AL', 'annual', 'Vacation', 'ลาพักร้อน'].some(s => code.includes(s) || (record.leave_type && record.leave_type.includes(s)))) {
                                return { colorClass: "text-green-700", bgClass: "bg-green-50" };
                              }
                              if (['PL', 'personal', 'Business', 'ลากิจ'].some(s => code.includes(s) || (record.leave_type && record.leave_type.includes(s)))) {
                                return { colorClass: "text-amber-700", bgClass: "bg-amber-50" };
                              }
                              return { colorClass: "text-purple-700", bgClass: "bg-purple-50" };
                            })();

                            // Build display based on leave duration
                            let displayCode = code;
                            let durationIndicator = null;

                            if ((record as any).leave_duration === 'hourly') {
                              const hours = (record as any).leave_hours || 0;
                              // Stacked: Code top, Duration bottom
                              displayCode = code;
                              durationIndicator = <span className="text-[9px] block opacity-80">{Number(hours).toFixed(1)}h</span>;
                            } else if ((record as any).leave_duration === 'half_day_morning') {
                              displayCode = code;
                              durationIndicator = <span className="text-[9px] block opacity-80">½AM</span>;
                            } else if ((record as any).leave_duration === 'half_day_afternoon') {
                              displayCode = code;
                              durationIndicator = <span className="text-[9px] block opacity-80">½PM</span>;
                            }

                            content = (
                              <div className="flex flex-col items-center justify-center leading-tight w-full" title={`${record.leave_type} ${record.status === 'pending' ? '(รออนุมัติ)' : ''}`}>
                                <span className={`font-bold ${colorClass} text-[10px]`}>{displayCode}</span>
                                {durationIndicator}
                                {record.status === 'pending' && <span className="text-[8px] italic opacity-70 scale-75">Wait</span>}
                              </div>
                            );
                            cellClass = bgClass;
                          }
                        }

                        // Highlight weekends
                        const dateObj = new Date(dateStr);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        if (!record && isWeekend) {
                          cellClass = "bg-gray-50/50";
                        }

                        return (
                          <td key={dateStr} className={`px-1 py-1 text-center border-r border-gray-100 ${cellClass}`}>
                            {content}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center text-xs font-bold text-gray-900 border-l border-gray-300 bg-gray-50">
                        {emp.total_leave_days + emp.total_shift_swaps}
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
