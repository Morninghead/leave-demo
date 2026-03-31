import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, TrendingDown, TrendingUp } from 'lucide-react';
import { LeaveBalance } from '../../types/leave';
import { getLeaveBalances } from '../../api/leave';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

export function LeaveBalanceCard() {
  const CONDITIONAL_BALANCE_CODES = new Set(['WORK_INJURY']);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    try {
      const response = await getLeaveBalances();
      setBalances(response.balances);
    } catch (error) {
      console.error('Failed to load balances:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to display unlimited for unpaid leave
  const formatDays = (days: number | string) => {
    const numDays = Number(days);
    if (numDays >= 999) {
      return i18n.language === 'th' ? 'ไม่จำกัด' : '∞';
    }
    return days.toString();
  };

  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      const code = (b.leave_type_code || '').toUpperCase();
      if (CONDITIONAL_BALANCE_CODES.has(code)) {
        const usedDays = Number(b.used_days || 0);
        const pendingDays = Number(b.pending_days || 0);
        if (usedDays <= 0 && pendingDays <= 0) return false;
      }
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900">
          {t('dashboard.myLeaveBalance')}
        </h3>
      </div>

      <div className="space-y-3">
        {filteredBalances.length === 0 ? (
          <p className="text-sm text-gray-500">{t('common.noData')}</p>
        ) : (
          filteredBalances.map((balance) => (
            <div
              key={balance.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {i18n.language === 'th'
                      ? balance.leave_type_name_th
                      : balance.leave_type_name_en}
                  </p>
                  <p className="text-xs text-gray-500">
                    {balance.leave_type_code}
                  </p>
                </div>
                {/* If the item made it through the filter, it is valid to show. We still check display of ' Probation ' just in case `total_days` is explicitly 0 from backend but they passed probation, else show remaining days */}
                {Number(balance.total_days) === 0 ? (
                  <span className="text-sm font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded">
                    {i18n.language === 'th' ? 'ไม่มีสิทธิ์วันลา' : 'No Entitlement'}
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-blue-600">
                    {formatDays(balance.remaining_days)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{t('leave.total')}: {formatDays(balance.total_days)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  <span>{t('leave.used')}: {balance.used_days}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-600 font-semibold">{t('leave.pending')}: {balance.pending_days || 0}</span>
                </div>
              </div>

              {/* Progress bar - hide for unlimited leave AND probation */}
              {Number(balance.total_days) < 999 && Number(balance.total_days) > 0 && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${((Number((balance as any).available_days || (balance as any).remaining_days) / Number((balance as any).total_days)) * 100)}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
