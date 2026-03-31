import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LeaveChartProps {
  data: {
    leave_type: string;
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }[];
}

export function LeaveChart({ data }: LeaveChartProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('dashboard.leaveByType')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="leave_type" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="approved" fill="#10b981" name={t('leave.approved')} />
          <Bar dataKey="pending" fill="#f59e0b" name={t('leave.pending')} />
          <Bar dataKey="rejected" fill="#ef4444" name={t('leave.rejected')} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
