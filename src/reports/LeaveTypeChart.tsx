import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LeaveTypeChartProps {
  data: Array<{
    leave_type: string;
    total_requests: number;
    total_days: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
  }>;
}

export function LeaveTypeChart({ data }: LeaveTypeChartProps) {
  const chartData = data.map(item => ({
    name: item.leave_type,
    อนุมัติ: item.approved_count,
    ปฏิเสธ: item.rejected_count,
    รออนุมัติ: item.pending_count,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        สรุปการลาตามประเภท
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="อนุมัติ" fill="#10b981" />
          <Bar dataKey="ปฏิเสธ" fill="#ef4444" />
          <Bar dataKey="รออนุมัติ" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
