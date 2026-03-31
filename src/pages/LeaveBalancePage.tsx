import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  TrendingUp,
  Clock,
  AlertCircle,
  History as HistoryIcon
} from 'lucide-react';
import { getLeaveBalances } from '../api/leave';
import { LeaveBalance, BalanceSummary } from '../types/leave';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';

export function LeaveBalancePage() {
  const HIDDEN_BALANCE_CODES = new Set(['WORK_INJURY']);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showHistory, setShowHistory] = useState(false);

  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      const code = (b.leave_type_code || '').toUpperCase();
      if (HIDDEN_BALANCE_CODES.has(code)) return false;
      const nameEn = (b.leave_type_name_en || '').toLowerCase();
      const nameTh = (b.leave_type_name_th || '');
      const isVacation = code === 'VL' || code === 'VAC' || code === 'ANNUAL' || (b as any).is_annual_leave
        || nameEn.includes('vacation') || nameEn.includes('annual') || nameTh.includes('ลาพักร้อน');

      if (isVacation) {
        if (!user?.hire_date) {
          return false;
        }

        const parts = String(user.hire_date).split(/[-/]/);
        let hireDate = new Date(user.hire_date);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            hireDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
          } else if (parts[2].length === 4) {
            hireDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }

        const today = new Date();

        // If settings hasn't loaded yet, hide vacation leave by default (fail-safe)
        if (!settings) return false;

        // Convert string 'true' to boolean if needed, and handle undefined
        const isTenureRequired = settings.require_1_year_tenure_for_vacation === true ||
          String(settings.require_1_year_tenure_for_vacation) === 'true';

        if (isTenureRequired) {
          let yearsDiff = today.getFullYear() - hireDate.getFullYear();
          if (
            today.getMonth() < hireDate.getMonth() ||
            (today.getMonth() === hireDate.getMonth() && today.getDate() < hireDate.getDate())
          ) {
            yearsDiff--;
          }
          return yearsDiff >= 1;
        } else {
          // 119-day probation logic
          const diffTime = Math.abs(today.getTime() - hireDate.getTime());
          const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return daysDiff >= 119;
        }
      }

      return true;
    });
  }, [balances, settings, user]);

  useEffect(() => {
    fetchBalances();
  }, [selectedYear]);

  // Auto-refresh every 5 minutes for leave balance data
  // Balances change when leave requests are approved/rejected
  useAutoRefresh({
    category: 'MASTER_DATA',
    dataType: 'EMPLOYEES',
    onRefresh: () => fetchBalances(true),
  });

  async function fetchBalances(isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const response = await getLeaveBalances(selectedYear);
      setBalances(response.balances || []);
      setSummary(response.summary || null);
    } catch (error) {
      console.error('Failed to fetch leave balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('leave.balanceTitle')}
        </h1>
        <p className="text-gray-600">
          {t('leave.balanceDesc')}
        </p>
      </div>

      {/* Year Selector */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          {t('common.year')}:
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {[...Array(5)].map((_, i) => {
            const year = new Date().getFullYear() - 2 + i;
            return (
              <option key={year} value={year}>
                {year + 543} {/* พ.ศ. */}
              </option>
            );
          })}
        </select>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <HistoryIcon className="w-5 h-5" />
          {t('leave.balanceHistory')}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{summary.total_entitled}</div>
            <div className="text-blue-100 text-sm">{t('leave.totalEntitled')}</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{summary.total_remaining}</div>
            <div className="text-green-100 text-sm">{t('leave.remaining')}</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{summary.total_used}</div>
            <div className="text-red-100 text-sm">{t('leave.used')}</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{summary.total_pending}</div>
            <div className="text-yellow-100 text-sm">{t('leave.pending')}</div>
          </div>
        </div>
      )}

      {/* Leave Type Balances */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('leave.balanceByType')}
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredBalances.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {t('leave.noBalanceData')}
            </div>
          ) : (
            filteredBalances.map((balance) => (
              <div key={balance.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: balance.color || '#3B82F6' }}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {i18n.language === 'th'
                          ? balance.leave_type_name_th
                          : balance.leave_type_name_en}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {balance.leave_type_code}
                        {balance.is_paid && (
                          <span className="ml-2 text-green-600">
                            ({t('leave.paid')})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {balance.available_days || (typeof balance.remaining_days === 'string' ? parseFloat(balance.remaining_days) : balance.remaining_days)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {t('leave.daysAvailable')} {(balance.pending_days || 0) > 0 && (
                        <span className="text-yellow-600 font-semibold">
                          ({t('leave.pending')}: {balance.pending_days})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>{t('leave.used')}: {balance.used_days}</span>
                    <span>{t('leave.pending')}: {balance.pending_days || 0}</span>
                    <span>{t('leave.total')}: {balance.total_days}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(
                        typeof balance.remaining_days === 'string' ? parseFloat(balance.remaining_days) : balance.remaining_days,
                        typeof balance.total_days === 'string' ? parseFloat(balance.total_days) : balance.total_days
                      )}`}
                      style={{
                        width: `${((typeof balance.total_days === 'string' ? parseFloat(balance.total_days) : balance.total_days - (typeof balance.remaining_days === 'string' ? parseFloat(balance.remaining_days) : balance.remaining_days)) / (typeof balance.total_days === 'string' ? parseFloat(balance.total_days) : balance.total_days)) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-blue-600 font-semibold text-lg">
                      {balance.total_days}
                    </div>
                    <div className="text-gray-600">{t('leave.entitled')}</div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-red-600 font-semibold text-lg">
                      {balance.used_days}
                    </div>
                    <div className="text-gray-600">{t('leave.used')}</div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3 text-center border-2 border-orange-200">
                    <div className="text-orange-600 font-semibold text-lg">
                      {balance.pending_days}
                    </div>
                    <div className="text-gray-600">{t('leave.pendingReserved')}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
