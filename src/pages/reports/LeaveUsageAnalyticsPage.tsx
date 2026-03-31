import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Calendar, Users, Download, Filter } from 'lucide-react';
import api from '../../api/auth';
import { exportToExcel } from '../../utils/exportUtils';

interface UsageByType {
  name_th: string;
  name_en: string;
  code: string;
  total_requests: number;
  total_days: number;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
}

interface MonthlyTrend {
  month: string;
  month_number: number;
  requests: number;
  days: number;
}

interface TopLeaveTaker {
  employee_code: string;
  name_th: string;
  name_en: string;
  department_th: string;
  department_en: string;
  total_requests: number;
  total_days: number;
}

interface Summary {
  unique_employees: number;
  total_requests: number;
  total_days: number;
  avg_days_per_request: number;
  hourly_requests: number;
  half_day_requests: number;
  full_day_requests: number;
}

interface AnalyticsData {
  year: number;
  usage_by_type: UsageByType[];
  monthly_trends: MonthlyTrend[];
  peak_periods: any[];
  day_of_week_analysis: any[];
  avg_duration: number;
  top_leave_takers: TopLeaveTaker[];
  summary: Summary;
}

export default function LeaveUsageAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/leave-usage-analytics?year=${year}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const usageData = data.usage_by_type.map(item => ({
      [i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Type']: i18n.language === 'th' ? item.name_th : item.name_en,
      [i18n.language === 'th' ? 'รหัส' : 'Code']: item.code,
      [i18n.language === 'th' ? 'จำนวนคำขอ' : 'Requests']: item.total_requests,
      [i18n.language === 'th' ? 'จำนวนวัน' : 'Days']: item.total_days ? parseFloat(item.total_days.toString()).toFixed(2) : '0.00',
      [i18n.language === 'th' ? 'อนุมัติ' : 'Approved']: item.approved_count,
      [i18n.language === 'th' ? 'รออนุมัติ' : 'Pending']: item.pending_count,
      [i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected']: item.rejected_count
    }));

    const monthlyData = data.monthly_trends.map(item => ({
      [i18n.language === 'th' ? 'เดือน' : 'Month']: item.month,
      [i18n.language === 'th' ? 'จำนวนคำขอ' : 'Requests']: item.requests,
      [i18n.language === 'th' ? 'จำนวนวัน' : 'Days']: item.days ? parseFloat(item.days.toString()).toFixed(2) : '0.00'
    }));

    const topTakersData = data.top_leave_takers.map(item => ({
      [i18n.language === 'th' ? 'รหัสพนักงาน' : 'Employee ID']: item.employee_code,
      [i18n.language === 'th' ? 'ชื่อ' : 'Name']: i18n.language === 'th' ? item.name_th : item.name_en,
      [i18n.language === 'th' ? 'แผนก' : 'Department']: i18n.language === 'th' ? item.department_th : item.department_en,
      [i18n.language === 'th' ? 'จำนวนคำขอ' : 'Requests']: item.total_requests,
      [i18n.language === 'th' ? 'จำนวนวัน' : 'Days']: item.total_days ? parseFloat(item.total_days.toString()).toFixed(2) : '0.00'
    }));

    exportToExcel(
      [
        { name: i18n.language === 'th' ? 'สรุปรวม' : 'Summary', data: [data.summary] },
        { name: i18n.language === 'th' ? 'การใช้ตามประเภท' : 'Usage by Type', data: usageData },
        { name: i18n.language === 'th' ? 'รายเดือน' : 'Monthly', data: monthlyData },
        { name: i18n.language === 'th' ? 'ผู้ลามากที่สุด' : 'Top Leavers', data: topTakersData }
      ],
      `Leave_Usage_Analytics_${year}`
    );
  };

  const years = [2024, 2025, 2026];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600">No data available</div>
      </div>
    );
  }

  const maxRequests = Math.max(...data.monthly_trends.map(m => m.requests), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('reports.leaveUsageAnalytics')}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th' ? 'รายงานการใช้วันลารายละเอียด พร้อมการวิเคราะห์แนวโน้มและรูปแบบการลา' : 'Detailed leave usage report with trend analysis and leave patterns'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">{i18n.language === 'th' ? 'จำนวนคำขอทั้งหมด' : 'Total Requests'}</p>
              <p className="text-3xl font-bold text-blue-900">{data.summary.total_requests}</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-400" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">{i18n.language === 'th' ? 'จำนวนวันทั้งหมด' : 'Total Days'}</p>
              <p className="text-3xl font-bold text-green-900">{parseFloat(data.summary.total_days?.toString() || '0').toFixed(1)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-400" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700">{i18n.language === 'th' ? 'พนักงานที่ยื่นคำขอ' : 'Refuesting Employees'}</p>
              <p className="text-3xl font-bold text-purple-900">{data.summary.unique_employees}</p>
            </div>
            <Users className="w-12 h-12 text-purple-400" />
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">{i18n.language === 'th' ? 'เฉลี่ย/คำขอ' : 'Avg/Request'}</p>
              <p className="text-3xl font-bold text-orange-900">{parseFloat(data.summary.avg_days_per_request?.toString() || '0').toFixed(1)}</p>
            </div>
            <BarChart3 className="w-12 h-12 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Request Type Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{i18n.language === 'th' ? 'ประเภทของคำขอ' : 'Request Types'}</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-900">{data.summary.full_day_requests}</p>
            <p className="text-sm text-blue-700">{i18n.language === 'th' ? 'ลาเต็มวัน' : 'Full Day'}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-900">{data.summary.half_day_requests}</p>
            <p className="text-sm text-green-700">{i18n.language === 'th' ? 'ลาครึ่งวัน' : 'Half Day'}</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-900">{data.summary.hourly_requests}</p>
            <p className="text-sm text-purple-700">{i18n.language === 'th' ? 'ลาเป็นชั่วโมง' : 'Hourly'}</p>
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{i18n.language === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly Trends'}</h2>
        <div className="space-y-3">
          {data.monthly_trends.map((month) => (
            <div key={month.month}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{month.month}</span>
                <span className="text-gray-600">
                  {month.requests} {i18n.language === 'th' ? 'คำขอ' : 'requests'} ({parseFloat(month.days?.toString() || '0').toFixed(1)} {i18n.language === 'th' ? 'วัน' : 'days'})
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${(month.requests / maxRequests) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage by Leave Type */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? 'การใช้ตามประเภทการลา' : 'Usage by Leave Type'}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ประเภท' : 'Type'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'คำขอ' : 'Requests'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วัน' : 'Days'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อนุมัติ' : 'Accepted'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รอ' : 'Pending'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.usage_by_type.map((item) => (
                <tr key={item.code} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">
                      {i18n.language === 'th' ? item.name_th : item.name_en}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">({item.code})</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">{item.total_requests}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">
                    {item.total_days ? parseFloat(item.total_days.toString()).toFixed(1) : '0.0'}
                  </td>
                  <td className="px-6 py-4 text-right text-green-600">{item.approved_count}</td>
                  <td className="px-6 py-4 text-right text-yellow-600">{item.pending_count}</td>
                  <td className="px-6 py-4 text-right text-red-600">{item.rejected_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Leave Takers */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? 'พนักงานที่ลามากที่สุด 10 อันดับ' : 'Top 10 Leave Takers'}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อันดับ' : 'Rank'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รหัส' : 'ID'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ชื่อ' : 'Name'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'แผนก' : 'Department'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'คำขอ' : 'Requests'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วัน' : 'Days'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.top_leave_takers.map((item, index) => (
                <tr key={item.employee_code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900 font-medium">#{index + 1}</td>
                  <td className="px-6 py-4 text-gray-900 font-mono">{item.employee_code}</td>
                  <td className="px-6 py-4 text-gray-900">
                    {i18n.language === 'th' ? item.name_th : item.name_en}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {i18n.language === 'th' ? item.department_th : item.department_en}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">{item.total_requests}</td>
                  <td className="px-6 py-4 text-right font-semibold text-blue-600">
                    {item.total_days ? parseFloat(item.total_days.toString()).toFixed(1) : '0.0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
