import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  RefreshCw,
  Users,
} from 'lucide-react';
import { getEmployees, Employee } from '../api/employee';
import { AdjustBalanceModal } from '../components/admin/AdjustBalanceModal';
import { ResetBalancesModal } from '../components/admin/ResetBalancesModal';
import { useDevice } from '../contexts/DeviceContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useToast } from '../contexts/ToastContext';

export function LeaveBalanceManagement() {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const { deviceType, isMobile, isTablet } = useDevice();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Auto-refresh every 5 minutes for employee balance management
  // Disable refresh when modal is open to prevent disrupting admin work
  useAutoRefresh({
    category: 'DASHBOARD',
    dataType: 'BACKGROUND',
    onRefresh: () => fetchEmployees(true),
    enabled: !showAdjustModal && !showResetModal,
  });

  async function fetchEmployees(isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const response = await getEmployees();
      setEmployees(response || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowAdjustModal(true);
  };

  const handleResetBalances = () => {
    setShowResetModal(true);
  };

  const handleExportReport = () => {
    // TODO: Implement export functionality
    showToast(t('common.featureComingSoon') || 'Export feature coming soon', 'info');
  };

  return (
    <div className={`${isMobile ? 'p-4' : isTablet ? 'p-5' : 'p-6'} max-w-7xl mx-auto`}>
      {/* Header */}
      <div className={`${isMobile ? 'mb-4' : 'mb-8'}`}>
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900 mb-2`}>
          {t('admin.leaveBalanceManagement')}
        </h1>
        <p className="text-gray-600">
          {t('admin.leaveBalanceManagementDesc')}
        </p>
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-4">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {[...Array(5)].map((_, i) => {
            const year = new Date().getFullYear() - 2 + i;
            return (
              <option key={year} value={year}>
                {year + 543}
              </option>
            );
          })}
        </select>

        <button
          onClick={handleResetBalances}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          {t('admin.resetBalances')}
        </button>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-auto"
        >
          <Download className="w-5 h-5" />
          {t('common.export')}
        </button>
      </div>

      {/* Employees List - Mobile Card View / Desktop Table View */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">{t('employee.noEmployees')}</p>
        </div>
      ) : isMobile ? (
        // Mobile Card View
        <div className="space-y-3">
          {employees.map((employee) => (
            <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="mb-3">
                <p className="font-semibold text-gray-900 text-base">{employee.employee_code}</p>
                <p className="text-sm text-gray-700 mt-1">
                  {i18n.language === 'th' ? employee.name_th : employee.name_en}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {employee.department_name_en || '-'}
                </p>
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleAdjustBalance(employee)}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {t('admin.adjustBalance')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Desktop/Tablet Table View
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('employee.employeeCode')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('employee.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('employee.department')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('leave.totalBalance')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {employee.employee_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {i18n.language === 'th' ? employee.name_th : employee.name_en}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {employee.department_name_en || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => {/* View details */ }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {t('common.viewDetails')}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleAdjustBalance(employee)}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                      >
                        {t('admin.adjustBalance')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAdjustModal && selectedEmployee && (
        <AdjustBalanceModal
          employee={selectedEmployee}
          year={selectedYear}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            fetchEmployees();
            setShowAdjustModal(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {showResetModal && (
        <ResetBalancesModal
          year={selectedYear}
          onClose={() => setShowResetModal(false)}
          onSuccess={() => {
            fetchEmployees();
            setShowResetModal(false);
          }}
        />
      )}
    </div>
  );
}
