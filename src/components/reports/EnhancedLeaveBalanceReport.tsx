/**
 * Enhanced Leave Balance Report Component
 *
 * Features:
 * - Excel export with formatting
 * - Risk indicator badges
 * - Financial liability display
 * - Validation error alerts
 * - Comprehensive filtering and sorting
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Users,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDevice } from '../../contexts/DeviceContext';
import api from '../../api/auth';

interface LeaveBalanceDetail {
  leave_type_code: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
  pending_days: number;
  available_days: number;
  utilization_rate: number;
}

interface EmployeeBalanceReport {
  employee_id: string;
  employee_code: string;
  employee_name_th: string;
  employee_name_en: string;
  department_name_th: string;
  department_name_en: string;
  position_th: string;
  position_en: string;
  hire_date: string;
  years_of_service: number;
  leave_balances: LeaveBalanceDetail[];
  cost_impact: {
    daily_salary_estimate: number;
    unused_leave_liability: number;
  };
  risk_flags: {
    low_balance_warning: boolean;
    high_unused_warning: boolean;
    expiring_leave_alert: boolean;
    risk_level: 'low' | 'medium' | 'high';
    risk_messages: string[];
  };
  last_leave_date: string | null;
  days_since_last_leave: number | null;
  year: number;
  validation_errors: any[];
}

interface ReportSummary {
  total_employees: number;
  total_departments: number;
  total_validation_errors: number;
  total_validation_warnings: number;
  risk_counts: {
    high: number;
    medium: number;
    low: number;
  };
  financial: {
    total_liability: number;
    avg_liability_per_employee: number;
  };
}

export function EnhancedLeaveBalanceReport() {
  const { t, i18n } = useTranslation();
  const { isMobile, isTablet } = useDevice();

  const [balances, setBalances] = useState<EmployeeBalanceReport[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'risk' | 'liability'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchEnhancedReport();
  }, []);

  const fetchEnhancedReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/leave-balance-report-enhanced');
      setBalances(response.data.balances || []);
      setSummary(response.data.summary || null);
    } catch (error) {
      console.error('Failed to fetch enhanced leave balance report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (balances.length === 0) return;

    // Sheet 1: Employee Details
    const employeeData = balances.map(emp => {
      const annualLeave = emp.leave_balances.find(lb => lb.leave_type_code === 'annual');
      const sickLeave = emp.leave_balances.find(lb => lb.leave_type_code === 'sick');
      const personalLeave = emp.leave_balances.find(lb => lb.leave_type_code === 'personal');

      return {
        'รหัสพนักงาน': emp.employee_code,
        'ชื่อ-นามสกุล': emp.employee_name_th,
        'แผนก': emp.department_name_th,
        'ตำแหน่ง': emp.position_th,
        'อายุงาน (ปี)': emp.years_of_service,
        'ลาพักร้อน - จัดสรร': annualLeave?.allocated_days || 0,
        'ลาพักร้อน - ใช้ไป': annualLeave?.used_days || 0,
        'ลาพักร้อน - คงเหลือ': annualLeave?.remaining_days || 0,
        'ลาพักร้อน - รออนุมัติ': annualLeave?.pending_days || 0,
        'ลาพักร้อน - ใช้ได้': annualLeave?.available_days || 0,
        'ลาพักร้อน - % ใช้แล้ว': annualLeave?.utilization_rate || 0,
        'ลาป่วย - จัดสรร': sickLeave?.allocated_days || 0,
        'ลาป่วย - ใช้ไป': sickLeave?.used_days || 0,
        'ลาป่วย - คงเหลือ': sickLeave?.remaining_days || 0,
        'ลากิจ - จัดสรร': personalLeave?.allocated_days || 0,
        'ลากิจ - ใช้ไป': personalLeave?.used_days || 0,
        'ลากิจ - คงเหลือ': personalLeave?.remaining_days || 0,
        'หนี้สินวันลาคงเหลือ (บาท)': emp.cost_impact.unused_leave_liability,
        'ระดับความเสี่ยง': emp.risk_flags.risk_level === 'high' ? 'สูง' :
                           emp.risk_flags.risk_level === 'medium' ? 'กลาง' : 'ต่ำ',
        'วันลาครั้งสุดท้าย': emp.last_leave_date || '-',
        'จำนวนวันนับจากลาครั้งสุดท้าย': emp.days_since_last_leave || '-'
      };
    });

    // Sheet 2: Department Summary
    const departmentMap = new Map<string, any>();
    balances.forEach(emp => {
      const deptKey = emp.department_name_th;
      if (!departmentMap.has(deptKey)) {
        departmentMap.set(deptKey, {
          department: deptKey,
          employee_count: 0,
          total_liability: 0,
          high_risk_count: 0,
          medium_risk_count: 0,
          low_risk_count: 0,
        });
      }
      const dept = departmentMap.get(deptKey)!;
      dept.employee_count++;
      dept.total_liability += emp.cost_impact.unused_leave_liability;
      if (emp.risk_flags.risk_level === 'high') dept.high_risk_count++;
      else if (emp.risk_flags.risk_level === 'medium') dept.medium_risk_count++;
      else dept.low_risk_count++;
    });

    const departmentData = Array.from(departmentMap.values()).map(dept => ({
      'แผนก': dept.department,
      'จำนวนพนักงาน': dept.employee_count,
      'หนี้สินรวม (บาท)': dept.total_liability.toFixed(2),
      'ความเสี่ยงสูง': dept.high_risk_count,
      'ความเสี่ยงกลาง': dept.medium_risk_count,
      'ความเสี่ยงต่ำ': dept.low_risk_count,
    }));

    // Sheet 3: Risk Analysis
    const highRiskEmployees = balances
      .filter(emp => emp.risk_flags.risk_level === 'high')
      .map(emp => ({
        'รหัสพนักงาน': emp.employee_code,
        'ชื่อ-นามสกุล': emp.employee_name_th,
        'แผนก': emp.department_name_th,
        'ระดับความเสี่ยง': 'สูง',
        'คำเตือน': emp.risk_flags.risk_messages.join('; '),
      }));

    // Sheet 4: Summary Statistics
    const summaryData = [
      { 'ข้อมูล': 'จำนวนพนักงานทั้งหมด', 'ค่า': summary?.total_employees || 0 },
      { 'ข้อมูล': 'จำนวนแผนกทั้งหมด', 'ค่า': summary?.total_departments || 0 },
      { 'ข้อมูล': 'พนักงานความเสี่ยงสูง', 'ค่า': summary?.risk_counts.high || 0 },
      { 'ข้อมูล': 'พนักงานความเสี่ยงกลาง', 'ค่า': summary?.risk_counts.medium || 0 },
      { 'ข้อมูล': 'พนักงานความเสี่ยงต่ำ', 'ค่า': summary?.risk_counts.low || 0 },
      { 'ข้อมูล': 'หนี้สินวันลารวม (บาท)', 'ค่า': summary?.financial.total_liability.toFixed(2) || 0 },
      { 'ข้อมูล': 'หนี้สินเฉลี่ยต่อพนักงาน (บาท)', 'ค่า': summary?.financial.avg_liability_per_employee.toFixed(2) || 0 },
      { 'ข้อมูล': 'ข้อผิดพลาดการตรวจสอบ', 'ค่า': summary?.total_validation_errors || 0 },
      { 'ข้อมูล': 'คำเตือนการตรวจสอบ', 'ค่า': summary?.total_validation_warnings || 0 },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add sheets
    const ws1 = XLSX.utils.json_to_sheet(employeeData);
    const ws2 = XLSX.utils.json_to_sheet(departmentData);
    const ws3 = XLSX.utils.json_to_sheet(highRiskEmployees);
    const ws4 = XLSX.utils.json_to_sheet(summaryData);

    XLSX.utils.book_append_sheet(wb, ws1, 'รายละเอียดพนักงาน');
    XLSX.utils.book_append_sheet(wb, ws2, 'สรุปตามแผนก');
    XLSX.utils.book_append_sheet(wb, ws3, 'พนักงานเสี่ยงสูง');
    XLSX.utils.book_append_sheet(wb, ws4, 'สถิติรวม');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `รายงานยอดคงเหลือวันลา_${timestamp}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };

  const getRiskBadge = (riskLevel: 'low' | 'medium' | 'high') => {
    switch (riskLevel) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            <AlertTriangle className="w-3 h-3" />
            {t('risk.high')}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" />
            {t('risk.medium')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            {t('risk.low')}
          </span>
        );
    }
  };

  // Filter and sort balances
  const filteredAndSortedBalances = balances
    .filter(emp => {
      // Risk filter
      if (riskFilter !== 'all' && emp.risk_flags.risk_level !== riskFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          emp.employee_code.toLowerCase().includes(term) ||
          emp.employee_name_th.toLowerCase().includes(term) ||
          emp.employee_name_en.toLowerCase().includes(term) ||
          emp.department_name_th.toLowerCase().includes(term) ||
          emp.department_name_en.toLowerCase().includes(term)
        );
      }

      return true;
    })
    .sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.employee_name_th.localeCompare(b.employee_name_th, 'th');
          break;
        case 'department':
          compareValue = a.department_name_th.localeCompare(b.department_name_th, 'th');
          break;
        case 'risk':
          const riskOrder = { high: 3, medium: 2, low: 1 };
          compareValue = riskOrder[a.risk_flags.risk_level] - riskOrder[b.risk_flags.risk_level];
          break;
        case 'liability':
          compareValue = a.cost_impact.unused_leave_liability - b.cost_impact.unused_leave_liability;
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-600 mt-4">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('reports.totalEmployees')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_employees}</p>
              </div>
              <Users className="w-10 h-10 text-blue-600 opacity-75" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('reports.highRiskEmployees')}</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{summary.risk_counts.high}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-600 opacity-75" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('reports.totalLiability')}</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {summary.financial.total_liability.toLocaleString()} ฿
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-600 opacity-75" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('reports.avgLiabilityPerEmployee')}</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {summary.financial.avg_liability_per_employee.toLocaleString()} ฿
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600 opacity-75" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              {t('reports.filterByRisk')}
            </label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('common.all')}</option>
              <option value="high">{t('risk.high')}</option>
              <option value="medium">{t('risk.medium')}</option>
              <option value="low">{t('risk.low')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ArrowUpDown className="w-4 h-4 inline mr-1" />
              {t('reports.sortBy')}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">{t('employee.name')}</option>
              <option value="department">{t('employee.department')}</option>
              <option value="risk">{t('reports.riskLevel')}</option>
              <option value="liability">{t('reports.liability')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('reports.searchPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleExportToExcel}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              {t('common.exportExcel')}
            </button>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('employee.code')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('employee.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('employee.department')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('leave.annual')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('leave.sick')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('reports.liability')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('reports.risk')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedBalances.map((emp) => {
                const annualLeave = emp.leave_balances.find(lb => lb.leave_type_code === 'annual');
                const sickLeave = emp.leave_balances.find(lb => lb.leave_type_code === 'sick');

                return (
                  <tr key={emp.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {emp.employee_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {i18n.language === 'th' ? emp.employee_name_th : emp.employee_name_en}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {emp.department_name_en || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {annualLeave ? (
                        <div>
                          <span className="font-medium text-gray-900">{annualLeave.remaining_days.toFixed(1)}</span>
                          <span className="text-gray-500">/{annualLeave.allocated_days}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {sickLeave ? (
                        <div>
                          <span className="font-medium text-gray-900">{sickLeave.remaining_days.toFixed(1)}</span>
                          <span className="text-gray-500">/{sickLeave.allocated_days}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {emp.cost_impact.unused_leave_liability.toLocaleString()} ฿
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getRiskBadge(emp.risk_flags.risk_level)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedBalances.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{t('reports.noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
