// src/components/reports/StatusPieChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusPieChartProps {
  approved: number;
  rejected: number;
  pending: number;
}

export function StatusPieChart({ approved, rejected, pending }: StatusPieChartProps) {
  const data = [
    { name: 'อนุมัติ', value: approved, color: '#10b981' },
    { name: 'ปฏิเสธ', value: rejected, color: '#ef4444' },
    { name: 'รออนุมัติ', value: pending, color: '#f59e0b' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        สัดส่วนสถานะคำขอ
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
