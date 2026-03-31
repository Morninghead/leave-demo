import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { getLeaveBalances } from '../../api/leave';
import { LeaveBalance as LeaveBalanceData } from '../../types/leave';
import { formatThaiLeaveBalanceFromMinutes } from '../../utils/leaveTimeFormatter';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

export function LeaveBalance() {
  const HIDDEN_BALANCE_CODES = new Set(['WORK_INJURY']);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [balances, setBalances] = useState<LeaveBalanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
    loadBalances();
  }, [selectedYear]);

  const loadBalances = async () => {
    setLoading(true);
    try {
      const response = await getLeaveBalances(selectedYear);
      setBalances(response.balances || []);
    } catch (error: any) {
      console.error('Failed to load leave balances:', error);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const years = [2023, 2024, 2025, 2026];

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-40"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{t('leave.balance')}</h2>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {i18n.language === 'th' ? year + 543 : year}
            </option>
          ))}
        </select>
      </div>

      {filteredBalances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">{t('leave.noBalanceData')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {filteredBalances.map((balance) => {
            const usedPercentage =
              Number(balance.total_days) > 0 ? (Number(balance.used_days) / Number(balance.total_days)) * 100 : 0;

            return (
              <div
                key={balance.id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {i18n.language === 'th'
                        ? balance.leave_type_name_th
                        : balance.leave_type_name_en}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t('leave.total')}: {balance.total_days} {t('common.days')}
                    </p>
                  </div>
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">{t('leave.used')}</span>
                    <span className={`font-semibold ${getTextColor(usedPercentage)}`}>
                      {balance.allow_hourly_leave && balance.used_minutes !== undefined
                        ? formatThaiLeaveBalanceFromMinutes(balance.used_minutes, 480, i18n.language as 'th' | 'en')
                        : `${balance.used_days} ${t('common.days')}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getProgressColor(
                        usedPercentage
                      )}`}
                      style={{ width: `${Number(balance.total_days) > 0 ? Math.min(usedPercentage, 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Remaining Days - Different display for hourly vs regular leave */}
                {Number(balance.total_days) === 0 ? (
                  // Probation Case
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <span className="text-sm text-gray-600">{i18n.language === 'th' ? 'สถานะ' : 'Status'}</span>
                    </div>
                    <span className="text-sm font-bold text-orange-600">
                      {i18n.language === 'th' ? 'ไม่มีสิทธิ์วันลา' : 'No Entitlement'}
                    </span>
                  </div>
                ) : balance.allow_hourly_leave && balance.remaining_minutes !== undefined ? (
                  // Hourly Leave - Show Thai format only
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      {parseFloat(balance.remaining_days.toString()) > parseFloat(balance.total_days.toString()) / 2 ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm text-gray-600">{t('leave.remaining')}</span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatThaiLeaveBalanceFromMinutes(balance.remaining_minutes, 480, i18n.language as 'th' | 'en')}
                    </div>
                  </div>
                ) : (
                  // Regular Leave - Show days only
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      {parseFloat(balance.remaining_days.toString()) > parseFloat(balance.total_days.toString()) / 2 ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm text-gray-600">{t('leave.remaining')}</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {balance.remaining_days}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
