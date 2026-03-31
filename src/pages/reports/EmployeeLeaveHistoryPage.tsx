import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Download, Calendar, TrendingUp } from 'lucide-react';
import api from '../../api/auth';
import { exportToExcel } from '../../utils/exportUtils';
import { AttachmentBadge } from '../../components/common/AttachmentBadge';

export default function EmployeeLeaveHistoryPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/employee-leave-history?year=${year}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const handleExport = () => {
    if (!data) return;

    const employeeData = data.employees.map((emp: any) => ({
      'รหัสพนักงาน': emp.employee_code,
      'ชื่อ': i18n.language === 'th' ? `${emp.first_name_th} ${emp.last_name_th}` : `${emp.first_name_en} ${emp.last_name_en}`,
      'แผนก': i18n.language === 'th' ? emp.department_name_th : emp.department_name_en,
      'ตำแหน่ง': i18n.language === 'th' ? emp.position_th : emp.position_en,
      'วันที่เริ่มงาน': new Date(emp.hire_date).toLocaleDateString('th-TH'),
      'คำขอทั้งหมด': emp.total_requests,
      'อนุมัติ': emp.approved_count,
      'ปฏิเสธ': emp.rejected_count,
      'รออนุมัติ': emp.pending_count,
      'วันลาทั้งหมด': emp.total_days_taken
    }));

    const recentData = data.recent_requests.map((req: any) => ({
      'รหัสพนักงาน': req.employee_code,
      'ชื่อ': i18n.language === 'th' ? req.employee_name_th : req.employee_name_en,
      'ประเภทการลา': i18n.language === 'th' ? req.leave_type_name_th : req.leave_type_name_en,
      'วันที่เริ่ม': new Date(req.start_date).toLocaleDateString('th-TH'),
      'วันที่สิ้นสุด': new Date(req.end_date).toLocaleDateString('th-TH'),
      'จำนวนวัน': req.total_days,
      'สถานะ': req.status === 'approved' ? 'อนุมัติ' : req.status === 'rejected' ? 'ปฏิเสธ' : 'รออนุมัติ',
      'วันที่ส่งคำขอ': new Date(req.created_at).toLocaleDateString('th-TH')
    }));

    exportToExcel([
      { name: 'พนักงาน', data: employeeData },
      { name: 'คำขอล่าสุด', data: recentData }
    ], `Employee_Leave_History_${year}`);
  };

  if (loading) return <div className="p-6"><div className="animate-pulse h-64 bg-gray-200 rounded"></div></div>;
  if (!data) return <div className="p-6 text-center text-gray-600">No data available</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'ประวัติการลาพนักงาน' : 'Employee Leave History'}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th' ? 'ประวัติการลาของพนักงานแต่ละคน' : 'Leave history for each employee'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-4 py-2 border rounded-lg">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-6">
          <p className="text-sm text-blue-700">{i18n.language === 'th' ? 'พนักงานทั้งหมด' : 'Total Employees'}</p>
          <p className="text-3xl font-bold text-blue-900">{data.summary.total_employees}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-6">
          <p className="text-sm text-green-700">{i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}</p>
          <p className="text-3xl font-bold text-green-900">{data.summary.total_requests}</p>
          <p className="text-xs text-green-600 mt-1">
            {i18n.language === 'th'
              ? `เฉลี่ย ${data.summary.avg_requests_per_employee} คำขอ/คน`
              : `Avg ${data.summary.avg_requests_per_employee} reqs/employee`}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-6">
          <p className="text-sm text-purple-700">{i18n.language === 'th' ? 'วันลาทั้งหมด' : 'Total Days'}</p>
          <p className="text-3xl font-bold text-purple-900">{data.summary.total_days_taken.toFixed(1)}</p>
          <p className="text-xs text-purple-600 mt-1">
            {i18n.language === 'th'
              ? `เฉลี่ย ${data.summary.avg_days_per_employee} วัน/คน`
              : `Avg ${data.summary.avg_days_per_employee} days/employee`}
          </p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-6">
          <p className="text-sm text-yellow-700">{i18n.language === 'th' ? 'อัตราอนุมัติ' : 'Approval Rate'}</p>
          <p className="text-3xl font-bold text-yellow-900">
            {data.summary.total_requests > 0 ? ((data.summary.total_approved / data.summary.total_requests) * 100).toFixed(1) : '0'}%
          </p>
        </div>
      </div>

      {/* Employee Leave History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">
            {i18n.language === 'th' ? 'ประวัติการลาพนักงาน' : 'Employee Leave History'} ({data.employees.length} {i18n.language === 'th' ? 'คน' : 'employees'})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'แผนก' : 'Department'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'คำขอ' : 'Requests'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วันลา' : 'Days'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รายละเอียด' : 'Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.employees.map((emp: any) => (
                <>
                  <tr key={emp.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {i18n.language === 'th' ? `${emp.first_name_th} ${emp.last_name_th}` : `${emp.first_name_en} ${emp.last_name_en}`}
                      </div>
                      <div className="text-xs text-gray-500">{emp.employee_code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {i18n.language === 'th' ? emp.department_name_th : emp.department_name_en}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">{emp.total_requests}</td>
                    <td className="px-6 py-4 text-center text-sm text-green-600">{emp.approved_count}</td>
                    <td className="px-6 py-4 text-center text-sm text-red-600">{emp.rejected_count}</td>
                    <td className="px-6 py-4 text-center text-sm text-yellow-600">{emp.pending_count}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{emp.total_days_taken.toFixed(1)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleEmployee(emp.employee_id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {expandedEmployees.has(emp.employee_id)
                          ? (i18n.language === 'th' ? 'ซ่อน' : 'Hide')
                          : (i18n.language === 'th' ? 'ดูรายละเอียด' : 'View Details')}
                      </button>
                    </td>
                  </tr>
                  {expandedEmployees.has(emp.employee_id) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          {/* Leave by Type */}
                          {emp.leave_by_type.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">{i18n.language === 'th' ? 'การลาแยกตามประเภท' : 'Leave by Type'}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {emp.leave_by_type.map((lt: any, idx: number) => (
                                  <div key={idx} className="border rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.leave_type_color }}></div>
                                      <span className="text-sm font-medium">
                                        {i18n.language === 'th' ? lt.leave_type_name_th : lt.leave_type_name_en}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {lt.request_count} {i18n.language === 'th' ? 'คำขอ' : 'requests'}, {lt.days_taken.toFixed(1)} {i18n.language === 'th' ? 'วัน' : 'days'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {i18n.language === 'th' ? 'อนุมัติ' : 'App'}: {lt.approved} | {i18n.language === 'th' ? 'ปฏิเสธ' : 'Rej'}: {lt.rejected} | {i18n.language === 'th' ? 'รอ' : 'Pend'}: {lt.pending}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Leave Balances */}
                          {emp.leave_balances.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">{i18n.language === 'th' ? 'ยอดคงเหลือ' : 'Balances'}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                {emp.leave_balances.map((lb: any, idx: number) => (
                                  <div key={idx} className="border rounded-lg p-3">
                                    <div className="text-xs font-medium text-gray-700">
                                      {i18n.language === 'th' ? lb.leave_type_name_th : lb.leave_type_name_en}
                                    </div>
                                    <div className="text-sm font-bold text-gray-900">
                                      {lb.remaining_days.toFixed(1)} / {lb.total_days.toFixed(1)} {i18n.language === 'th' ? 'วัน' : 'days'}
                                    </div>
                                    <div className="text-xs text-gray-500">{i18n.language === 'th' ? `ใช้ไป ${lb.used_days.toFixed(1)} วัน` : `Used ${lb.used_days.toFixed(1)} days`}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold">
            {i18n.language === 'th' ? 'คำขอล่าสุด (50 รายการ)' : 'Recent Requests (50 items)'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ประเภท' : 'Type'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วันที่' : 'Date'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'จำนวนวัน' : 'Total Days'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'สถานะ' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.recent_requests.map((req: any) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {i18n.language === 'th' ? req.employee_name_th : req.employee_name_en}
                    </div>
                    <div className="text-xs text-gray-500">{req.employee_code}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: req.leave_type_color }}></div>
                      <span className="text-sm text-gray-900">
                        {i18n.language === 'th' ? req.leave_type_name_th : req.leave_type_name_en}
                      </span>
                      {req.attachment_urls && req.attachment_urls.length > 0 && (
                        <AttachmentBadge count={req.attachment_urls.length} attachments={req.attachment_urls} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(req.start_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')} - {new Date(req.end_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">{req.total_days.toFixed(1)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${req.status === 'approved' ? 'bg-green-100 text-green-800' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                      {req.status === 'approved'
                        ? (i18n.language === 'th' ? 'อนุมัติ' : 'Approved')
                        : req.status === 'rejected'
                          ? (i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected')
                          : (i18n.language === 'th' ? 'รออนุมัติ' : 'Pending')}
                    </span>
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
