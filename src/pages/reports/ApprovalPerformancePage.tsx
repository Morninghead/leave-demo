import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Download, TrendingUp, CheckCircle } from 'lucide-react';
import api from '../../api/auth';
import { exportToExcel } from '../../utils/exportUtils';

export default function ApprovalPerformancePage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/approval-performance?year=${year}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const speedData = [{
      'ตัวชี้วัด': 'เวลาอนุมัติเฉลี่ย',
      'ชั่วโมง': data.approval_speed.avg_hours.toFixed(2)
    }, {
      'ตัวชี้วัด': 'เวลาอนุมัติขั้นต่ำ',
      'ชั่วโมง': data.approval_speed.min_hours.toFixed(2)
    }, {
      'ตัวชี้วัด': 'เวลาอนุมัติสูงสุด',
      'ชั่วโมง': data.approval_speed.max_hours.toFixed(2)
    }, {
      'ตัวชี้วัด': 'เวลาอนุมัติมัธยฐาน',
      'ชั่วโมง': data.approval_speed.median_hours.toFixed(2)
    }];

    const stageData = data.rate_by_stage.map((stage: any) => ({
      'ขั้นตอน': `ขั้นตอนที่ ${stage.current_approval_stage}`,
      'คำขอทั้งหมด': stage.total,
      'อนุมัติ': stage.approved,
      'ปฏิเสธ': stage.rejected,
      'รออนุมัติ': stage.pending,
      'อัตราการอนุมัติ (%)': stage.approval_rate
    }));

    const monthlyData = data.monthly_trends.map((month: any) => ({
      'เดือน': month.month,
      'คำขอทั้งหมด': month.total_requests,
      'อนุมัติ': month.approved,
      'ปฏิเสธ': month.rejected,
      'เวลาเฉลี่ย (ชม.)': month.avg_approval_hours.toFixed(2)
    }));

    exportToExcel([
      { name: 'ความเร็วการอนุมัติ', data: speedData },
      { name: 'อัตราตามขั้นตอน', data: stageData },
      { name: 'แนวโน้มรายเดือน', data: monthlyData }
    ], `Approval_Performance_${year}`);
  };

  if (loading) return <div className="p-6"><div className="animate-pulse h-64 bg-gray-200 rounded"></div></div>;
  if (!data) return <div className="p-6 text-center text-gray-600">No data available</div>;

  const maxRequests = Math.max(...data.monthly_trends.map((m: any) => m.total_requests), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'th' ? 'รายงานประสิทธิภาพการอนุมัติ' : 'Approval Performance Report'}
            </h1>
            <p className="text-gray-600 mt-1">
              {i18n.language === 'th' ? 'รายงานประสิทธิภาพการอนุมัติคำขอ' : 'Report on leave request approval performance'}
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
          <p className="text-sm text-blue-700">{i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}</p>
          <p className="text-3xl font-bold text-blue-900">{data.summary.total_requests}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-6">
          <p className="text-sm text-green-700">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</p>
          <p className="text-3xl font-bold text-green-900">{data.summary.approved_count}</p>
          <p className="text-xs text-green-600 mt-1">{data.summary.approval_rate}%</p>
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

      {/* Approval Speed Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? 'ความเร็วในการอนุมัติ' : 'Approval Speed'}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">{i18n.language === 'th' ? 'เวลาเฉลี่ย' : 'Average Time'}</p>
            <p className="text-2xl font-bold text-gray-900">{data.approval_speed.avg_hours.toFixed(1)}</p>
            <p className="text-xs text-gray-500">{i18n.language === 'th' ? 'ชั่วโมง' : 'Hours'}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">{i18n.language === 'th' ? 'มัธยฐาน' : 'Median'}</p>
            <p className="text-2xl font-bold text-gray-900">{data.approval_speed.median_hours.toFixed(1)}</p>
            <p className="text-xs text-gray-500">{i18n.language === 'th' ? 'ชั่วโมง' : 'Hours'}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">{i18n.language === 'th' ? 'เร็วที่สุด' : 'Fastest'}</p>
            <p className="text-2xl font-bold text-green-600">{data.approval_speed.min_hours.toFixed(1)}</p>
            <p className="text-xs text-gray-500">{i18n.language === 'th' ? 'ชั่วโมง' : 'Hours'}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">{i18n.language === 'th' ? 'ช้าที่สุด' : 'Slowest'}</p>
            <p className="text-2xl font-bold text-red-600">{data.approval_speed.max_hours.toFixed(1)}</p>
            <p className="text-xs text-gray-500">{i18n.language === 'th' ? 'ชั่วโมง' : 'Hours'}</p>
          </div>
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
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-600">{month.total_requests} {i18n.language === 'th' ? 'คำขอ' : 'Requests'}</span>
                  <span className="text-green-600">{month.approved} {i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</span>
                  <span className="text-red-600">{month.rejected} {i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected'}</span>
                  <span className="text-blue-600">{month.avg_approval_hours.toFixed(1)} {i18n.language === 'th' ? 'ชม.' : 'Hrs'}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-green-500 to-blue-600 h-3 rounded-full"
                  style={{ width: `${(month.total_requests / maxRequests) * 100}%` }}>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval Rate by Stage */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold">{i18n.language === 'th' ? 'อัตราการอนุมัติแยกตามขั้นตอน' : 'Approval Rate by Stage'}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ขั้นตอน' : 'Stage'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'รออนุมัติ' : 'Pending'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{i18n.language === 'th' ? 'อัตราอนุมัติ' : 'Approval Rate'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.rate_by_stage.map((stage: any) => (
                <tr key={stage.current_approval_stage} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {i18n.language === 'th' ? `ขั้นตอนที่ ${stage.current_approval_stage}` : `Stage ${stage.current_approval_stage}`}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">{stage.total}</td>
                  <td className="px-6 py-4 text-right text-green-600">{stage.approved}</td>
                  <td className="px-6 py-4 text-right text-red-600">{stage.rejected}</td>
                  <td className="px-6 py-4 text-right text-yellow-600">{stage.pending}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${parseFloat(stage.approval_rate) >= 80 ? 'bg-green-100 text-green-800' :
                        parseFloat(stage.approval_rate) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                      }`}>
                      {stage.approval_rate}%
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
