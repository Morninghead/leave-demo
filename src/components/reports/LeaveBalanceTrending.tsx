/**
 * Leave Balance Trending Component
 *
 * Displays historical trends and department utilization heatmap
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Calendar, Download, Filter } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/auth';
import { DatePicker } from '../common/DatePicker';

interface TrendData {
  year: number;
  month: number;
  month_name: string;
  total_allocated: number;
  total_used: number;
  total_remaining: number;
  avg_utilization: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
}

export function LeaveBalanceTrending() {
  const { t, i18n } = useTranslation();

  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState('annual');

  useEffect(() => {
    fetchTrendData();
  }, [startDate, endDate, leaveType]);

  function getDefaultStartDate() {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  }

  const fetchTrendData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/leave-balance-historical', {
        params: {
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          view: 'monthly'
        }
      });
      setTrendData(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = trendData.map(item => ({
    name: `${item.month}/${item.year}`,
    utilization: item.avg_utilization,
    allocated: item.total_allocated,
    used: item.total_used,
    remaining: item.total_remaining,
    highRisk: item.high_risk_count,
    mediumRisk: item.medium_risk_count,
    lowRisk: item.low_risk_count,
  }));

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
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('reports.historicalTrending')}</h2>
              <p className="text-gray-600">{t('reports.historicalTrendingDesc')}</p>
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
              onClick={fetchTrendData}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              <Filter className="w-5 h-5" />
              {t('common.apply')}
            </button>
          </div>
        </div>
      </div>

      {/* Utilization Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('reports.utilizationTrend')}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: '%', position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="utilization"
              stroke="#3B82F6"
              strokeWidth={2}
              name={t('reports.utilization')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Balance Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('reports.balanceTrend')}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="allocated" fill="#9CA3AF" name={t('reports.allocated')} />
            <Bar dataKey="used" fill="#EF4444" name={t('reports.used')} />
            <Bar dataKey="remaining" fill="#10B981" name={t('reports.remaining')} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('reports.riskTrend')}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="highRisk" stackId="a" fill="#DC2626" name={t('risk.high')} />
            <Bar dataKey="mediumRisk" stackId="a" fill="#F59E0B" name={t('risk.medium')} />
            <Bar dataKey="lowRisk" stackId="a" fill="#10B981" name={t('risk.low')} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('reports.periodSummary')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">{t('reports.avgUtilization')}</p>
              <p className="text-2xl font-bold text-blue-600">
                {(trendData.reduce((sum, item) => sum + item.avg_utilization, 0) / trendData.length).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">{t('reports.totalAllocated')}</p>
              <p className="text-2xl font-bold text-green-600">
                {trendData[trendData.length - 1]?.total_allocated || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">{t('reports.totalUsed')}</p>
              <p className="text-2xl font-bold text-red-600">
                {trendData[trendData.length - 1]?.total_used.toFixed(1) || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">{t('reports.totalRemaining')}</p>
              <p className="text-2xl font-bold text-purple-600">
                {trendData[trendData.length - 1]?.total_remaining.toFixed(1) || 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
