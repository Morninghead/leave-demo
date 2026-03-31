import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface DepartmentStat {
  department: string;
  requests: number;
  days: number;
}

interface DepartmentStatsChartProps {
  data: DepartmentStat[];
  height?: number;
  maxBars?: number;
}

export function DepartmentStatsChart({
  data,
  height = 300,
  maxBars = 10,
}: DepartmentStatsChartProps) {
  const { i18n } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{i18n.language === 'th' ? 'ไม่มีข้อมูลแผนก' : 'No department data available'}</p>
      </div>
    );
  }

  // Sort by requests and take top departments
  const sortedData = [...data]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, maxBars);

  // Color bars based on request volume
  const getBarColor = (requests: number, maxRequests: number) => {
    const ratio = requests / maxRequests;
    if (ratio > 0.7) return '#ef4444'; // High - Red
    if (ratio > 0.4) return '#f59e0b'; // Medium - Amber
    return '#10b981'; // Low - Green
  };

  const maxRequests = Math.max(...sortedData.map((d) => d.requests));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sortedData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="department"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={{ stroke: '#9ca3af' }}
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickLine={{ stroke: '#9ca3af' }}
          label={{
            value: i18n.language === 'th' ? 'จำนวนคำขอ' : 'Number of Requests',
            angle: -90,
            position: 'insideLeft',
            style: { fill: '#6b7280', fontSize: 12 },
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value: any, name: string) => {
            if (name === 'requests') return [`${value} ${i18n.language === 'th' ? 'คำขอ' : 'requests'}`, i18n.language === 'th' ? 'คำขอ' : 'Requests'];
            if (name === 'days') return [`${value} ${i18n.language === 'th' ? 'วัน' : 'days'}`, i18n.language === 'th' ? 'วัน' : 'Days'];
            return [value, name];
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Bar dataKey="requests" name={i18n.language === 'th' ? 'คำขอ' : 'Requests'} radius={[8, 8, 0, 0]}>
          {sortedData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(entry.requests, maxRequests)}
            />
          ))}
        </Bar>
        <Bar
          dataKey="days"
          name={i18n.language === 'th' ? 'วันรวม' : 'Total Days'}
          fill="#3b82f6"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
