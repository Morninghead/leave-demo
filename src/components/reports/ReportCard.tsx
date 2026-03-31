import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReportCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  color?: 'blue' | 'green' | 'purple' | 'indigo' | 'red' | 'yellow';
  badge?: string;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-blue-200',
    hover: 'hover:border-blue-400',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    border: 'border-green-200',
    hover: 'hover:border-green-400',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-200',
    hover: 'hover:border-purple-400',
  },
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'text-indigo-600',
    border: 'border-indigo-200',
    hover: 'hover:border-indigo-400',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    border: 'border-red-200',
    hover: 'hover:border-red-400',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    border: 'border-yellow-200',
    hover: 'hover:border-yellow-400',
  },
};

export function ReportCard({
  title,
  description,
  icon: Icon,
  route,
  color = 'blue',
  badge,
}: ReportCardProps) {
  const navigate = useNavigate();
  const colors = colorClasses[color];

  return (
    <button
      onClick={() => navigate(route)}
      className={`${colors.bg} ${colors.border} ${colors.hover} border-2 rounded-lg p-6 text-left transition-all hover:shadow-lg transform hover:-translate-y-1 w-full`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`${colors.bg} p-3 rounded-lg`}>
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </div>
        {badge && (
          <span className="px-2 py-1 text-xs font-semibold bg-white rounded-full text-gray-700 border border-gray-200">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
    </button>
  );
}
