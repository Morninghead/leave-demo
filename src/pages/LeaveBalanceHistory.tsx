import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, TrendingUp, TrendingDown, RefreshCw, Calendar } from 'lucide-react';
import { getLeaveBalanceHistory } from '../api/leave';
import { formatDateTime } from '../utils/dateUtils';
import { BalanceHistory } from '../types/leave';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface Props {
  employeeId?: string;
  onClose: () => void;
}

export function LeaveBalanceHistory({ employeeId, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [employeeId]);

  // Auto-refresh every 10 minutes for balance history
  // Historical data changes less frequently
  useAutoRefresh({
    category: 'REPORTS',
    dataType: 'SUMMARY',
    onRefresh: () => fetchHistory(true),
  });

  async function fetchHistory(isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const response = await getLeaveBalanceHistory(employeeId);
      setHistory(response.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'accrual':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'usage':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      case 'adjustment':
        return <RefreshCw className="w-5 h-5 text-blue-600" />;
      case 'carry_forward':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case 'reset':
        return <RefreshCw className="w-5 h-5 text-orange-600" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-600" />;
    }
  };

  const getChangeColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, { th: string; en: string }> = {
      accrual: { th: 'สะสมวันลา', en: 'Accrual' },
      usage: { th: 'ใช้วันลา', en: 'Usage' },
      adjustment: { th: 'ปรับยอด', en: 'Adjustment' },
      carry_forward: { th: 'ยกยอด', en: 'Carry Forward' },
      reset: { th: 'รีเซ็ต', en: 'Reset' },
    };
    return i18n.language === 'th' ? labels[type]?.th : labels[type]?.en;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t('leave.balanceHistory')}</h2>
            <p className="text-blue-100 text-sm">{t('leave.balanceHistoryDesc')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>{t('leave.noHistoryData')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="shrink-0 mt-1">
                      {getChangeIcon(item.change_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {i18n.language === 'th'
                              ? item.leave_type_name_th
                              : item.leave_type_name_en}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {getChangeTypeLabel(item.change_type)} • {item.leave_type_code}
                          </p>
                        </div>
                        <div className={`text-xl font-bold ${getChangeColor(item.change_amount)}`}>
                          {item.change_amount > 0 && '+'}
                          {item.change_amount}
                        </div>
                      </div>

                      {/* Balance Change */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <span className="font-medium">{item.previous_days}</span>
                        <span>→</span>
                        <span className="font-medium">{item.new_days}</span>
                        <span className="text-gray-400">
                          ({t('leave.days')})
                        </span>
                      </div>

                      {/* Reason */}
                      {item.reason && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2 mb-2">
                          {item.reason}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>📅 {formatDateTime(item.changed_at, i18n.language)}</span>
                        {item.changed_by_name && (
                          <span>👤 {item.changed_by_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}


