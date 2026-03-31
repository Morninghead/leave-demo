// src/components/reports/DepartmentChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DepartmentChartProps {
  data: Array<{
    department_name: string | null;
    total_requests: number;
    total_days: number;
    approved_count: number;
  }>;
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  const chartData = data.map(item => ({
    name: item.department_name || 'ไม่ระบุ',
    จำนวนคำขอ: item.total_requests,
    จำนวนวัน: item.total_days,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        สรุปการลาตามแผนก
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="จำนวนคำขอ" fill="#3b82f6" />
          <Bar dataKey="จำนวนวัน" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
