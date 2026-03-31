import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, Search, PlusCircle, Edit2, UserMinus, Download, Upload, FileDown, BarChart2 } from 'lucide-react';
import { Employee, getEmployees, deleteEmployee } from '../api/employee';
import { useToast } from '../hooks/useToast';
import { useDevice } from '../contexts/DeviceContext';
import { AddEmployeeModal } from '../components/employee/AddEmployeeModal';
import { EditEmployeeModal } from '../components/employee/EditEmployeeModal';
import { DeleteConfirmModal } from '../components/employee/DeleteConfirmModal';
import { TemplateDownloadModal } from '../components/employee/TemplateDownloadModal';
import { EmployeeImportModal } from '../components/employee/EmployeeImportModal';
import { EmployeeExportModal } from '../components/employee/EmployeeExportModal';
import { DepartmentStatsModal } from '../components/employee/DepartmentStatsModal';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

// Role and status badge color constants moved outside component
const ROLE_BADGE_COLORS = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  hr: 'bg-blue-100 text-blue-800 border-blue-200',
  leader: 'bg-amber-100 text-amber-800 border-amber-200',
  manager: 'bg-green-100 text-green-800 border-green-200',
  employee: 'bg-gray-100 text-gray-800 border-gray-200',
};

const STATUS_BADGE_COLORS = {
  active: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

// Device-specific layout functions moved outside component
const getContainerClass = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile': return 'px-4 py-3 max-w-full';
    case 'tablet': return 'px-6 py-4 max-w-6xl';
    case 'desktop':
    default: return 'p-6 max-w-7xl mx-auto';
  }
};

const getHeadingSize = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile': return 'text-xl';
    case 'tablet': return 'text-2xl';
    case 'desktop':
    default: return 'text-3xl';
  }
};

const getButtonSize = (deviceType: string) => {
  switch (deviceType) {
    case 'mobile': return 'px-3 py-2 text-sm';
    case 'tablet': return 'px-4 py-2 text-sm';
    case 'desktop':
    default: return 'px-4 py-2 text-sm';
  }
};

export function EmployeesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { deviceType, isMobile, isTablet } = useDevice();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadEmployees = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await getEmployees({
        search: searchTerm,
        role: filterRole !== 'all' ? filterRole : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      // Filter out inactive employees (they are shown in Resigned Employees page)
      const activeEmployees = data.filter(e => e.status !== 'inactive');
      setEmployees(activeEmployees);
    } catch (error: any) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterRole, filterStatus]);

  const handleSearch = useCallback(() => {
    setSearchTerm(searchInput);
  }, [searchInput]);

  const handleClear = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Sync searchInput with searchTerm when filters change (but not when searchInput changes)
  useEffect(() => {
    setSearchInput(searchTerm);
  }, [filterRole, filterStatus]);

  // Auto-refresh every 15 minutes for employee list
  // Disable refresh when any modal is open to prevent disrupting admin work
  const isAnyModalOpen = useMemo(() =>
    showAddModal || editingEmployee !== null || deletingEmployee !== null || showTemplateModal || showImportModal || showExportModal || showStatsModal,
    [showAddModal, editingEmployee, deletingEmployee, showTemplateModal, showImportModal, showExportModal, showStatsModal]
  );

  useAutoRefresh({
    category: 'MASTER_DATA',
    dataType: 'EMPLOYEES',
    onRefresh: () => loadEmployees(true),
    enabled: !isAnyModalOpen,
  });

  const handleDeleteEmployee = useCallback(async (resignationDate?: string, resignationReason?: string) => {
    if (!deletingEmployee) return;

    try {
      await deleteEmployee(deletingEmployee.id, resignationDate, resignationReason);
      showToast(t('message.deleteSuccess'), 'success');
      await loadEmployees();
      setDeletingEmployee(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  }, [deletingEmployee, showToast, t, loadEmployees]);

  const getRoleBadgeColor = useCallback((role: string) => {
    return ROLE_BADGE_COLORS[role as keyof typeof ROLE_BADGE_COLORS] || ROLE_BADGE_COLORS.employee;
  }, []);

  const getStatusBadgeColor = useCallback((status: string) => {
    return STATUS_BADGE_COLORS[status as keyof typeof STATUS_BADGE_COLORS] || STATUS_BADGE_COLORS.active;
  }, []);

  // Memoized device-specific classes
  const containerClass = useMemo(() => getContainerClass(deviceType), [deviceType]);
  const headingSize = useMemo(() => getHeadingSize(deviceType), [deviceType]);
  const buttonSize = useMemo(() => getButtonSize(deviceType), [deviceType]);

  if (loading) {
    return (
      <div className={containerClass}>
        <div className="animate-pulse space-y-4">
          <div className={`h-8 bg-gray-200 rounded ${isMobile ? 'w-1/2' : 'w-1/3'}`}></div>
          <div className={`${isMobile ? 'h-32' : 'h-64'} bg-gray-200 rounded`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={containerClass}>
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Users className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-blue-600`} />
            <div>
              <h1 className={`${headingSize} font-bold text-gray-900`}>{t('employee.title')}</h1>
              <p className={`${isMobile ? 'text-sm' : 'text-gray-600'} mt-1`}>{t('employee.description')}</p>
            </div>
          </div>

          {/* Action Buttons */}
          {isMobile ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className={`flex items-center gap-2 ${buttonSize} bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 w-full justify-center`}
              >
                <PlusCircle className="w-4 h-4" />
                {t('employee.addNew')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap justify-end pt-2 border-t border-gray-200">
              {/* Export Button */}
              <button
                onClick={() => setShowExportModal(true)}
                className={`flex items-center gap-2 ${buttonSize} bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700`}
              >
                <FileDown className="w-4 h-4" />
                {i18n.language === 'th' ? 'ส่งออก Excel' : 'Export Excel'}
              </button>
              {/* Stats Button */}
              <button
                onClick={() => setShowStatsModal(true)}
                className={`flex items-center gap-2 ${buttonSize} bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700`}
              >
                <BarChart2 className="w-4 h-4" />
                {i18n.language === 'th' ? 'สถิติแผนก' : 'Department Stats'}
              </button>
              {/* Resigned Employees Link */}
              <button
                onClick={() => navigate('/employees/resigned')}
                className={`flex items-center gap-2 ${buttonSize} bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700`}
              >
                <UserMinus className="w-4 h-4" />
                {i18n.language === 'th' ? 'พนักงานลาออก' : 'Resigned'}
              </button>
              <button
                onClick={() => setShowTemplateModal(true)}
                className={`flex items-center gap-2 ${buttonSize} bg-green-600 text-white font-medium rounded-lg hover:bg-green-700`}
              >
                <Download className="w-4 h-4" />
                {t('employee.downloadTemplate')}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className={`flex items-center gap-2 ${buttonSize} bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700`}
              >
                <Upload className="w-4 h-4" />
                {t('employee.importEmployees')}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className={`flex items-center gap-2 ${buttonSize} bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700`}
              >
                <PlusCircle className="w-4 h-4" />
                {t('employee.addNew')}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('common.search')}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {searchInput && (
                    <button
                      onClick={handleClear}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      title={t('common.clear')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  {t('common.search')}
                </button>
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('employee.allRoles')}</option>
                <option value="admin">{t('employee.admin')}</option>
                <option value="hr">{t('employee.hr')}</option>
                <option value="leader">{t('employee.leader')}</option>
                <option value="manager">{t('employee.manager')}</option>
                <option value="employee">{t('employee.employee')}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('employee.allStatus')}</option>
                <option value="active">{t('employee.active')}</option>
                <option value="suspended">{t('employee.suspended')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 mb-1">{t('employee.total')}</p>
            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 mb-1">{t('employee.active')}</p>
            <p className="text-2xl font-bold text-green-600">
              {employees.filter((e) => e.status === 'active').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 mb-1">{t('employee.managers')}</p>
            <p className="text-2xl font-bold text-blue-600">
              {employees.filter((e) => e.role === 'manager').length}
            </p>
          </div>

        </div>

        {/* Employee List - Mobile Card View / Desktop Table View */}
        {isMobile ? (
          // Mobile Card View
          <div className="space-y-3">
            {employees.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">{t('employee.noEmployees')}</p>
              </div>
            ) : (
              employees.map((employee) => (
                <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-base">{employee.employee_code}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {i18n.language === 'th' ? employee.name_th : employee.name_en}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{employee.email}</p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => setEditingEmployee(employee)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setDeletingEmployee(employee)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title={i18n.language === 'th' ? 'ลาออก' : 'Resign'}
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('employee.department')}</span>
                      <span className="text-gray-900 font-medium">
                        {i18n.language === 'th'
                          ? (employee.department_name_th || '-')
                          : (employee.department_name_en || '-')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('employee.position')}</span>
                      <span className="text-gray-900">
                        {i18n.language === 'th'
                          ? (employee.position_th || '-')
                          : (employee.position_en || '-')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-500">{t('employee.role')}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(employee.role)}`}>
                        {t(`employee.${employee.role}`)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-500">{t('employee.status')}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(employee.status)}`}>
                        {t(`employee.${employee.status}`)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Desktop/Tablet Table View
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[240px]" />
                  <col className="w-[160px]" />
                  <col className="w-[160px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col className="w-[150px]" />
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('employee.employeeCode')}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('employee.name')}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('employee.department')}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('employee.position')}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('employee.role')}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('employee.status')}
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-medium text-sm text-gray-900">{employee.employee_code}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {i18n.language === 'th' ? employee.name_th : employee.name_en}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{employee.email}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-900 truncate block">
                          {i18n.language === 'th'
                            ? (employee.department_name_th || '-')
                            : (employee.department_name_en || '-')}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-900 truncate block">
                          {i18n.language === 'th'
                            ? (employee.position_th || '-')
                            : (employee.position_en || '-')}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(
                            employee.role
                          )}`}
                        >
                          {t(`employee.${employee.role}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(
                            employee.status
                          )}`}
                        >
                          {t(`employee.${employee.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingEmployee(employee)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-600 rounded transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{t('common.edit')}</span>
                          </button>
                          <button
                            onClick={() => setDeletingEmployee(employee)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-600 rounded transition-colors"
                            title={i18n.language === 'th' ? 'ลาออก' : 'Resign'}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>{i18n.language === 'th' ? 'ลาออก' : 'Resign'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {employees.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">{t('employee.noEmployees')}</p>
              </div>
            )}
          </div>
        )}

        {/* Add Employee Modal */}
        {showAddModal && (
          <AddEmployeeModal
            onClose={() => setShowAddModal(false)}
            onSuccess={loadEmployees}
          />
        )}

        {/* Edit Employee Modal */}
        {editingEmployee && (
          <EditEmployeeModal
            employee={editingEmployee}
            onClose={() => setEditingEmployee(null)}
            onSuccess={loadEmployees}
          />
        )}

        {/* Delete Confirm Modal */}
        {deletingEmployee && (
          <DeleteConfirmModal
            employeeName={i18n.language === 'th' ? deletingEmployee.name_th : deletingEmployee.name_en}
            employeeCode={deletingEmployee.employee_code}
            onConfirm={handleDeleteEmployee}
            onClose={() => setDeletingEmployee(null)}
          />
        )}

        {/* Template Download Modal */}
        {showTemplateModal && (
          <TemplateDownloadModal
            onClose={() => setShowTemplateModal(false)}
          />
        )}

        {/* Employee Import Modal */}
        {showImportModal && (
          <EmployeeImportModal
            onClose={() => setShowImportModal(false)}
            onSuccess={loadEmployees}
          />
        )}

        {/* Employee Export Modal */}
        {showExportModal && (
          <EmployeeExportModal
            onClose={() => setShowExportModal(false)}
            employeeType="active"
          />
        )}

        {/* Department Stats Modal */}
        {showStatsModal && (
          <DepartmentStatsModal
            employees={employees}
            onClose={() => setShowStatsModal(false)}
          />
        )}

        {/* Mobile Floating Actions */}
        {isMobile && (
          <div className="fixed bottom-4 left-4 right-4 z-40 bg-white rounded-lg shadow-lg border border-gray-200 p-3 safe-area-inset-bottom">
            <div className="flex gap-2">
              <button
                onClick={() => setShowStatsModal(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                <BarChart2 className="w-4 h-4" />
                {i18n.language === 'th' ? 'สถิติ' : 'Stats'}
              </button>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Template
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
