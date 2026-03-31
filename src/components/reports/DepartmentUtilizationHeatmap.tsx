/**
 * Department Utilization Heatmap
 *
 * Visual heatmap showing leave utilization across departments over time
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Calendar, Download } from 'lucide-react';
import api from '../../api/auth';
import { DatePicker } from '../common/DatePicker';

interface HeatmapData {
  department_id: string;
  department_name: string;
  monthly_data: Array<{
    year: number;
    month: number;
    utilization_rate: number;
    employee_count: number;
  }>;
}

export function DepartmentUtilizationHeatmap() {
  const { t, i18n } = useTranslation();

  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState('annual');

  useEffect(() => {
    fetchHeatmapData();
  }, [startDate, endDate, leaveType]);

  function getDefaultStartDate() {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  }

  const fetchHeatmapData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/leave-balance-historical', {
        params: {
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          view: 'department'
        }
      });
      setHeatmapData(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique months for columns
  const months = heatmapData.length > 0 && heatmapData[0].monthly_data
    ? heatmapData[0].monthly_data.map(item => `${item.month}/${item.year}`)
    : [];

  // Get color based on utilization rate
  const getHeatmapColor = (utilizationRate: number) => {
    if (utilizationRate >= 80) return 'bg-red-600';
    if (utilizationRate >= 60) return 'bg-orange-500';
    if (utilizationRate >= 40) return 'bg-yellow-500';
    if (utilizationRate >= 20) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getColorIntensity = (utilizationRate: number) => {
    const intensity = Math.min(Math.max(utilizationRate / 100, 0.1), 1);
    return `rgba(59, 130, 246, ${intensity})`;
  };

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
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('reports.departmentHeatmap')}</h2>
              <p className="text-gray-600">{t('reports.departmentHeatmapDesc')}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.startDate')}
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
              {t('reports.endDate')}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.leaveType')}
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="annual">{t('leave.annual')}</option>
              <option value="sick">{t('leave.sick')}</option>
              <option value="personal">{t('leave.personal')}</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchHeatmapData}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              <Calendar className="w-5 h-5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('reports.utilizationHeatmap')}
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 rounded"></div>
              <span className="text-gray-600">{t('reports.low')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-gray-600">{t('reports.high')}</span>
            </div>
          </div>
        </div>

        <table className="min-w-full">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                {t('employee.department')}
              </th>
              {months.map((month, index) => (
                <th key={index} className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.map((dept, deptIndex) => (
              <tr key={deptIndex} className="border-t">
                <td className="px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                  {dept.department_name}
                </td>
                {dept.monthly_data.map((monthData, monthIndex) => (
                  <td key={monthIndex} className="px-2 py-2">
                    <div
                      className="w-full h-12 rounded flex items-center justify-center text-white text-xs font-medium transition-all hover:scale-105 cursor-pointer"
                      style={{ backgroundColor: getColorIntensity(monthData.utilization_rate) }}
                      title={`${dept.department_name}\n${monthData.month}/${monthData.year}\nUtilization: ${monthData.utilization_rate.toFixed(1)}%\nEmployees: ${monthData.employee_count}`}
                    >
                      {monthData.utilization_rate.toFixed(0)}%
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {heatmapData.length === 0 && (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{t('reports.noDataAvailable')}</p>
          </div>
        )}
      </div>

      {/* Legend and Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('reports.insights')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">{t('reports.highUtilization')}</h4>
            <p className="text-sm text-blue-800">
              {t('reports.highUtilizationDesc')}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">{t('reports.lowUtilization')}</h4>
            <p className="text-sm text-green-800">
              {t('reports.lowUtilizationDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
