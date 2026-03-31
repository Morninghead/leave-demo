import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface MonthlyTrend {
  month: string;
  requests: number;
  approved: number;
  rejected: number;
}

interface MonthlyTrendsChartProps {
  data: MonthlyTrend[];
  height?: number;
}

export function MonthlyTrendsChart({ data, height = 300 }: MonthlyTrendsChartProps) {
  const { i18n } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{i18n.language === 'th' ? 'ไม่มีข้อมูลแนวโน้มรายเดือน' : 'No monthly trend data available'}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickLine={{ stroke: '#9ca3af' }}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickLine={{ stroke: '#9ca3af' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Line
          type="monotone"
          dataKey="requests"
          name={i18n.language === 'th' ? 'คำขอทั้งหมด' : 'Total Requests'}
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4, fill: '#3b82f6' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="approved"
          name={i18n.language === 'th' ? 'อนุมัติ' : 'Approved'}
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4, fill: '#10b981' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="rejected"
          name={i18n.language === 'th' ? 'ปฏิเสธ' : 'Rejected'}
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 4, fill: '#ef4444' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
