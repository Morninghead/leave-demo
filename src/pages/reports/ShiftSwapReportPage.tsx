import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import api from '../../api/auth';
import { ExportModal } from '../../components/common/ExportModal';

export default function ShiftSwapReportPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/shift-swap-report?year=${year}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Define columns for export
  const exportColumns = [
    { key: 'employee_code', label: 'รหัสพนักงาน / Employee Code', width: 20 },
    {
      key: 'employee_name',
      label: 'ชื่อ / Name',
      width: 35,
      format: (swap: any) => i18n.language === 'th' ? swap.employee_name_th : swap.employee_name_en
    },
    {
      key: 'department',
      label: 'แผนก / Department',
      width: 30,
      format: (swap: any) => i18n.language === 'th' ? swap.department_th : swap.department_en
    },
    {
      key: 'work_date',
      label: 'วันทำงาน / Work Date',
      width: 20,
      format: (swap: any) => new Date(swap.work_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')
    },
    {
      key: 'off_date',
      label: 'วันหยุด / Off Date',
      width: 20,
      format: (swap: any) => new Date(swap.off_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')
    },
    {
      key: 'reason',
      label: 'เหตุผล / Reason',
      width: 40,
      format: (swap: any) => i18n.language === 'th' ? swap.reason_th : swap.reason_en
    },
    { key: 'status', label: 'สถานะ / Status', width: 15 },
    {
      key: 'created_at',
      label: 'วันที่ส่งคำขอ / Request Date',
      width: 20,
      format: (swap: any) => new Date(swap.created_at).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')
    }
  ];

  if (loading) return <div className="p-6"><div className="animate-pulse h-64 bg-gray-200 rounded"></div></div>;
  if (!data) return <div className="p-6 text-center text-gray-600">No data available</div>;

  const maxRequests = Math.max(...data.monthly_trends.map((m: any) => m.requests), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('reports.shiftSwapReport')}</h1>
            <p className="text-gray-600 mt-1">{i18n.language === 'th' ? 'รายงานการขอสลับวันทำงานและวันหยุด' : 'Report on work day and off day swaps'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-4 py-2 border rounded-lg">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setExportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-6">
          <p className="text-sm text-blue-700">{i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}</p>
          <p className="text-3xl font-bold text-blue-900">{data.summary.total_requests}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-6">
          <p className="text-sm text-green-700">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</p>
          <p className="text-3xl font-bold text-green-900">{data.summary.approved_count}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-6">
          <p className="text-sm text-yellow-700">{i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}</p>
          <p className="text-3xl font-bold text-yellow-900">{data.summary.pending_count}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-6">
          <p className="text-sm text-red-700">{i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected'}</p>
          <p className="text-3xl font-bold text-red-900">{data.summary.rejected_count}</p>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{i18n.language === 'th' ? 'แนวโน้มรายเดือน' : 'Monthly Trends'}</h2>
        <div className="space-y-3">
          {data.monthly_trends.map((month: any) => (
            <div key={month.month}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{month.month}</span>
                <span className="text-gray-600">{month.requests} {i18n.language === 'th' ? 'คำขอ' : 'requests'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(month.requests / maxRequests) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Requesters */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? 'ผู้ขอสลับวันมากที่สุด' : 'Top Requesters'}</h2>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.top_requesters.map((req: any, i: number) => (
                <tr key={req.employee_code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">#{i + 1}</td>
                  <td className="px-6 py-4 font-mono text-gray-900">{req.employee_code}</td>
                  <td className="px-6 py-4 text-gray-900">{i18n.language === 'th' ? req.name_th : req.name_en}</td>
                  <td className="px-6 py-4 text-gray-600">{i18n.language === 'th' ? req.department_th : req.department_en}</td>
                  <td className="px-6 py-4 text-right text-gray-900">{req.total_requests}</td>
                  <td className="px-6 py-4 text-right text-green-600">{req.approved_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Requests */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? 'รายการทั้งหมด' : 'All Requests'} ({data.swap_requests.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'วันทำงาน' : 'Work Date'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? '→ วันหยุด' : '→ Off Date'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'เหตุผล' : 'Reason'}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'สถานะ' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.swap_requests.slice(0, 50).map((swap: any) => (
                <tr key={swap.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{i18n.language === 'th' ? swap.employee_name_th : swap.employee_name_en}</div>
                    <div className="text-xs text-gray-500">{swap.employee_code}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{new Date(swap.work_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{new Date(swap.off_date).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{i18n.language === 'th' ? swap.reason_th : swap.reason_en}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${swap.status === 'approved' ? 'bg-green-100 text-green-800' :
                        swap.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {swap.status === 'approved'
                        ? (i18n.language === 'th' ? 'อนุมัติ' : 'Approved')
                        : swap.status === 'rejected'
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

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={t('reports.shiftSwapReport')}
        subtitle={i18n.language === 'th' ? `รายงานการขอสลับวันทำงาน ปี ${year}` : `Shift Swap Report Year ${year}`}
        columns={exportColumns}
        data={data?.swap_requests || []}
        filename={`Shift_Swap_Report_${year}`}
        defaultFormat="excel"
        pdfOrientation="landscape"
      />
    </div>
  );
}
