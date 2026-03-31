import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, TrendingUp, Download, Users, AlertCircle } from 'lucide-react';
import api from '../../api/auth';
import { exportToExcel } from '../../utils/exportUtils';
import { useToast } from '../../hooks/useToast';

interface DepartmentData {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  total_employees: number;
  active_employees: number;
  total_requests: number;
  total_days: number;
  avg_days_per_request: number;
  approved_requests: number;
  pending_requests: number;
  rejected_requests: number;
}

interface LeaveTypeByDepartment {
  department_id: string;
  department_name_th: string;
  department_name_en: string;
  leave_type_th: string;
  leave_type_en: string;
  leave_type_code: string;
  requests: number;
  days: number;
}

interface MonthlyTrend {
  department_id: string;
  department_name_th: string;
  department_name_en: string;
  month: number;
  month_name: string;
  requests: number;
  days: number;
}

interface AnalyticsData {
  year: number;
  department_overview: DepartmentData[];
  leave_type_by_department: LeaveTypeByDepartment[];
  monthly_department_trends: MonthlyTrend[];
  utilization_rates: any[];
  comparison_metrics: any[];
  summary: {
    total_departments: number;
    total_employees: number;
    total_requests: number;
    total_days: number;
  };
}

export default function DepartmentAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default to current year for analytics
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/department-analytics?year=${year}`);
      if (response.data) {
        setData(response.data);
        setError(null);
      } else {
        setError(i18n.language === 'th' ? 'ไม่ได้รับข้อมูลการวิเคราะห์จากเซิร์ฟเวอร์' : 'No analytics data received from server');
        showToast(i18n.language === 'th' ? 'ไม่มีข้อมูลสำหรับปีที่เลือก' : 'No data available for the selected year', 'warning');
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || (i18n.language === 'th' ? 'ไม่สามารถโหลดข้อมูลการวิเคราะห์ได้' : 'Failed to load analytics');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const overviewData = data.department_overview.map(dept => ({
      'แผนก': i18n.language === 'th' ? dept.name_th : dept.name_en,
      'รหัส': dept.code,
      'พนักงานทั้งหมด': dept.total_employees,
      'พนักงานทำงาน': dept.active_employees,
      'คำขอทั้งหมด': dept.total_requests,
      'จำนวนวัน': dept.total_days?.toFixed(2),
      'เฉลี่ย/คำขอ': dept.avg_days_per_request?.toFixed(2),
      'อนุมัติ': dept.approved_requests,
      'รอ': dept.pending_requests,
      'ปฏิเสธ': dept.rejected_requests
    }));

    exportToExcel([{ name: 'แผนก', data: overviewData }], `Department_Analytics_${year}`);
  };

  // Generate year options: current year and 5 years back
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  if (loading) {
    return <div className="p-6"><div className="animate-pulse h-64 bg-gray-200 rounded"></div></div>;
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Failed to Load Analytics</h3>
            <p className="text-red-800 mt-1">{error}</p>
            <button
              onClick={loadData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.department_overview || data.department_overview.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-900">{i18n.language === 'th' ? 'ไม่มีข้อมูล' : 'No Data Available'}</h3>
            <p className="text-yellow-800 mt-1">{i18n.language === 'th' ? `ไม่พบข้อมูลคำขอลาสำหรับปี ${year} กรุณาเลือกปีอื่น` : `No leave requests found for ${year}. Please select a different year.`}</p>
          </div>
        </div>
      </div>
    );
  }

  const maxDays = Math.max(...data.department_overview.map(d => d.total_days), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{i18n.language === 'th' ? 'การวิเคราะห์แบบละเอียดตามแผนก' : 'Detailed Department Analytics'}</h1>
            <p className="text-gray-600 mt-1">{i18n.language === 'th' ? 'วิเคราะห์ลึก: แนวโน้ม, ประเภทการลา, และประสิทธิภาพของทุกแผนก' : 'Deep dive: Trends, leave types, and performance for every department'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-4 py-2 border rounded-lg">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-6">
          <p className="text-sm text-blue-700">{i18n.language === 'th' ? 'แผนกทั้งหมด' : 'Total Departments'}</p>
          <p className="text-3xl font-bold text-blue-900">{data.summary.total_departments}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-6">
          <p className="text-sm text-green-700">{i18n.language === 'th' ? 'พนักงานทั้งหมด' : 'Total Employees'}</p>
          <p className="text-3xl font-bold text-green-900">{data.summary.total_employees}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-6">
          <p className="text-sm text-purple-700">{i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}</p>
          <p className="text-3xl font-bold text-purple-900">{data.summary.total_requests}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-6">
          <p className="text-sm text-orange-700">{i18n.language === 'th' ? 'วันลาทั้งหมด' : 'Total Days'}</p>
          <p className="text-3xl font-bold text-orange-900">{data.summary.total_days.toFixed(1)}</p>
        </div>
      </div>

      {/* Monthly Trends by Department (Top 5) */}
      {data.monthly_department_trends && data.monthly_department_trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{i18n.language === 'th' ? '📊 แนวโน้มรายเดือนของแผนกที่มีการใช้งานสูงสุด 5 อันดับ' : '📊 Monthly Trends of Top 5 Departments'}</h2>
          <p className="text-sm text-gray-600 mb-6">{i18n.language === 'th' ? 'เปรียบเทียบการใช้วันลาของแผนกหลักตลอดทั้งปี' : 'Compare leave usage of key departments throughout the year'}</p>
          <div className="overflow-x-auto">
            <div className="min-w-[600px] h-80">
              {(() => {
                // Group by department
                const deptMap = new Map<string, MonthlyTrend[]>();
                data.monthly_department_trends.forEach(trend => {
                  const key = trend.department_id;
                  if (!deptMap.has(key)) deptMap.set(key, []);
                  deptMap.get(key)!.push(trend);
                });

                const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
                let colorIndex = 0;

                return (
                  <div className="relative h-full">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-600">
                      {[100, 75, 50, 25, 0].map(val => <span key={val}>{val}</span>)}
                    </div>

                    {/* Chart area */}
                    <div className="ml-12 h-full pb-8 relative border-l border-b border-gray-300">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {Array.from(deptMap.entries()).map(([deptId, trends], idx) => {
                          const color = colors[colorIndex++ % colors.length];
                          const maxDays = Math.max(...data.monthly_department_trends.map(t => t.days), 1);
                          const points = trends
                            .sort((a, b) => a.month - b.month)
                            .map(t => `${((t.month - 1) / 11) * 100},${100 - (t.days / maxDays) * 100}`)
                            .join(' ');

                          return (
                            <polyline
                              key={deptId}
                              points={points}
                              fill="none"
                              stroke={color}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          );
                        })}
                      </svg>

                      {/* X-axis labels */}
                      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-gray-600 px-2">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                          <span key={month}>{month}</span>
                        ))}
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-8 flex flex-wrap gap-4">
                      {Array.from(deptMap.entries()).map(([deptId, trends], idx) => (
                        <div key={deptId} className="flex items-center gap-2">
                          <div className="w-4 h-0.5" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                          <span className="text-sm text-gray-700">
                            {i18n.language === 'th' ? trends[0].department_name_th : trends[0].department_name_en}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Department Comparison Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{i18n.language === 'th' ? '📈 เปรียบเทียบการใช้วันลาตามแผนก' : '📈 Leave Usage Comparison by Department'}</h2>
        <div className="space-y-3">
          {data.department_overview.map(dept => (
            <div key={dept.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{i18n.language === 'th' ? dept.name_th : dept.name_en}</span>
                <span className="text-gray-600">{dept.total_days.toFixed(1)} {i18n.language === 'th' ? 'วัน' : 'days'} ({dept.total_requests} {i18n.language === 'th' ? 'คำขอ' : 'requests'})</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(dept.total_days / maxDays) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leave Type Breakdown by Department */}
      {data.leave_type_by_department && data.leave_type_by_department.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{i18n.language === 'th' ? '🏷️ การแบ่งประเภทการลาตามแผนก' : '🏷️ Leave Type Breakdown by Department'}</h2>
          <p className="text-sm text-gray-600 mb-6">{i18n.language === 'th' ? 'ดูรายละเอียดว่าแต่ละแผนกใช้การลาประเภทใดมากที่สุด' : 'Details on which leave types are used most by each department'}</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'แผนก' : 'Department'}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ประเภทการลา' : 'Leave Type'}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'คำขอ' : 'Requests'}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วันลา' : 'Days'}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? '% ของแผนก' : '% of Dept'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(() => {
                  // Group by department and calculate percentages
                  const deptTotals = new Map<string, number>();
                  data.leave_type_by_department.forEach(item => {
                    const current = deptTotals.get(item.department_id) || 0;
                    deptTotals.set(item.department_id, current + item.days);
                  });

                  return data.leave_type_by_department.map((item, idx) => {
                    const deptTotal = deptTotals.get(item.department_id) || 1;
                    const percentage = ((item.days / deptTotal) * 100).toFixed(1);

                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {i18n.language === 'th' ? item.department_name_th : item.department_name_en}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {i18n.language === 'th' ? item.leave_type_th : item.leave_type_en}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{item.requests}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">{item.days.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{percentage}%</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? '📋 สรุปข้อมูลแบบละเอียดตามแผนก' : '📋 Detailed Department Summary'}</h2>
          <p className="text-sm text-gray-600 mt-1">{i18n.language === 'th' ? 'ข้อมูลครบถ้วนของทุกแผนกในองค์กร' : 'Complete data for all departments in the organization'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'แผนก' : 'Department'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'พนักงาน' : 'Employees'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'คำขอ' : 'Requests'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วันลา' : 'Days'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'เฉลี่ย/คำขอ' : 'Avg/Request'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รอ' : 'Pending'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.department_overview.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{i18n.language === 'th' ? dept.name_th : dept.name_en}</span>
                    <span className="ml-2 text-xs text-gray-500">({dept.code})</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">{dept.active_employees}</td>
                  <td className="px-6 py-4 text-right text-gray-900">{dept.total_requests}</td>
                  <td className="px-6 py-4 text-right font-semibold text-blue-600">{dept.total_days.toFixed(1)}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{dept.avg_days_per_request.toFixed(1)}</td>
                  <td className="px-6 py-4 text-right text-green-600">{dept.approved_requests}</td>
                  <td className="px-6 py-4 text-right text-yellow-600">{dept.pending_requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Utilization Rates */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">{i18n.language === 'th' ? '💯 อัตราการใช้บริการลาของพนักงานตามแผนก' : '💯 Leave Utilization Rate by Department'}</h2>
        <p className="text-sm text-gray-600 mb-6">{i18n.language === 'th' ? 'แสดงเปอร์เซ็นต์ของพนักงานที่เคยลาในแต่ละแผนก (ลาอย่างน้อย 1 ครั้ง)' : 'Percentage of employees who have taken at least one leave per department'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.utilization_rates.map((dept, i) => {
            const rate = parseFloat(dept.utilization_rate);
            const barColor = rate >= 80 ? 'bg-red-500' : rate >= 60 ? 'bg-yellow-500' : rate >= 40 ? 'bg-blue-500' : 'bg-green-500';
            const bgColor = rate >= 80 ? 'bg-red-50 border-red-200' : rate >= 60 ? 'bg-yellow-50 border-yellow-200' : rate >= 40 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';

            return (
              <div key={i} className={`border-2 rounded-lg p-4 ${bgColor} transition-all hover:shadow-md`}>
                <p className="font-semibold text-gray-900 mb-3">{i18n.language === 'th' ? dept.name_th : dept.name_en}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-gray-900">{dept.utilization_rate}%</p>
                  <p className="text-sm text-gray-600">{i18n.language === 'th' ? 'ของพนักงาน' : 'of employees'}</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${rate}%` }}></div>
                </div>
                <p className="text-xs text-gray-600">
                  {dept.employees_with_leave} {i18n.language === 'th' ? 'จาก' : 'of'} {dept.active_employees} {i18n.language === 'th' ? 'คน เคยลา' : 'employees took leave'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Metrics Table */}
      {data.comparison_metrics && data.comparison_metrics.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">{i18n.language === 'th' ? '⚖️ ตารางเปรียบเทียบประสิทธิภาพแผนก' : '⚖️ Department Performance Comparison'}</h2>
            <p className="text-sm text-gray-600 mt-1">{i18n.language === 'th' ? 'วิเคราะห์ประสิทธิภาพการจัดการลาของแต่ละแผนก' : 'Analyze leave management performance per department'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'แผนก' : 'Department'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'พนักงาน' : 'Employees'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'จำนวนวันรวม' : 'Total Days'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วัน/พนักงาน' : 'Days/Emp'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อัตรา อนุมัติ' : 'Approve Rate'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.comparison_metrics.map((dept, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{i18n.language === 'th' ? dept.name_th : dept.name_en}</td>
                    <td className="px-6 py-4 text-right text-gray-900">{dept.active_employees}</td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">{dept.total_days.toFixed(1)}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{dept.days_per_employee.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${dept.approval_rate >= 80 ? 'text-green-600' : dept.approval_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {dept.approval_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

