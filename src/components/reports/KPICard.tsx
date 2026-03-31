import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  subtitle?: string;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    text: 'text-blue-900',
    border: 'border-blue-200',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    text: 'text-green-900',
    border: 'border-green-200',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    text: 'text-yellow-900',
    border: 'border-yellow-200',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    text: 'text-red-900',
    border: 'border-red-200',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    text: 'text-purple-900',
    border: 'border-purple-200',
  },
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'text-indigo-600',
    text: 'text-indigo-900',
    border: 'border-indigo-200',
  },
};

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  subtitle,
}: KPICardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={`${colors.bg} ${colors.border} border rounded-lg p-6 transition-all hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${colors.text} mb-1`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500">vs last period</span>
            </div>
          )}
        </div>
        <div className={`${colors.bg} p-3 rounded-lg`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
}
