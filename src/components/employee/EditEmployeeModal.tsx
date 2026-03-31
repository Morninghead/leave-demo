import { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { X, Save, Building2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Employee, updateEmployee, getEmployees } from '../../api/employee';
import { Department, getDepartments } from '../../api/department';
import { getDepartmentPermissions, updateDepartmentPermissions, DepartmentPermission } from '../../api/department-permissions';

interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditEmployeeModal({ employee, onClose, onSuccess }: EditEmployeeModalProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee>(employee);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [formData, setFormData] = useState({
    first_name_th: '',
    last_name_th: '',
    first_name_en: '',
    last_name_en: '',
    email: '',
    phone_number: '',
    department_id: '',
    position_th: '',
    position_en: '',
    role: '',
    birth_date: '',
    hire_date: '',
    national_id: '',
    address_th: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    status: '',
    is_department_admin: false,
    is_department_manager: false,
  });

  useEffect(() => {
    loadDepartments();
    refreshEmployeeData();
    loadDepartmentPermissions();
  }, []);

  const loadDepartments = async () => {
    try {
      const depts = await getDepartments();
      logger.log('✅ Loaded departments:', depts);
      setDepartments(depts);
    } catch (error) {
      logger.error('❌ Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const loadDepartmentPermissions = async () => {
    try {
      const permissions = await getDepartmentPermissions(employee.id);
      const deptIds = permissions.map(p => p.department_id);
      logger.log('✅ Loaded additional department permissions:', deptIds);
      setSelectedDepartmentIds(deptIds);
    } catch (error) {
      logger.error('⚠️ Failed to load department permissions:', error);
      setSelectedDepartmentIds([]);
    }
  };

  const refreshEmployeeData = async () => {
    setLoadingData(true);
    try {
      logger.log('🔄 Fetching fresh employee data for:', employee.employee_code);

      // Fetch all employees and find the current one by ID
      const employees = await getEmployees();
      const freshEmployee = employees.find(emp => emp.id === employee.id);

      if (freshEmployee) {
        logger.log('✅ Fresh employee data loaded:', freshEmployee);
        setCurrentEmployee(freshEmployee);
        loadEmployeeData(freshEmployee);
      } else {
        logger.warn('⚠️ Employee not found in fresh data, using initial data');
        loadEmployeeData(employee);
      }
    } catch (error) {
      logger.error('❌ Failed to refresh employee data:', error);
      // Fallback to initial employee data
      loadEmployeeData(employee);
    } finally {
      setLoadingData(false);
    }
  };

  const loadEmployeeData = (emp: Employee) => {
    const [firstName, lastName] = emp.name_th.split(' ');
    const [firstNameEn, lastNameEn] = (emp.name_en || '').split(' ');

    logger.log('📥 Loading employee data into form:', emp);

    setFormData({
      first_name_th: firstName || '',
      last_name_th: lastName || '',
      first_name_en: firstNameEn || '',
      last_name_en: lastNameEn || '',
      email: emp.email || '',
      phone_number: emp.phone_number || '',
      department_id: emp.department_id || '',
      position_th: emp.position_th || '',
      position_en: emp.position_en || '',
      role: emp.role || 'employee',
      birth_date: emp.birth_date || '',
      hire_date: emp.hire_date || '',
      national_id: emp.national_id || '',
      address_th: emp.address_th || '',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',
      status: emp.status || 'active',
      is_department_admin: emp.is_department_admin || false,
      is_department_manager: emp.is_department_manager || false,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // ✅ Only send fields that have actual values (skip empty/null/undefined)
    const submitData: Record<string, any> = {};

    Object.entries(formData).forEach(([key, value]) => {
      // Skip empty strings, null, undefined
      if (value !== '' && value !== null && value !== undefined) {
        submitData[key] = value;
      }
    });

    logger.log('📝 Submitting data:', submitData);

    try {
      await updateEmployee(employee.id, submitData);
      showToast(t('message.updateSuccess'), 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      logger.error('❌ Update employee error:', error);
      showToast(error.message || 'Failed to update employee', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentToggle = (deptId: string) => {
    setSelectedDepartmentIds(prev => {
      if (prev.includes(deptId)) {
        return prev.filter(id => id !== deptId);
      } else {
        return [...prev, deptId];
      }
    });
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      await updateDepartmentPermissions(employee.id, selectedDepartmentIds);
      showToast('บันทึกแผนกที่อนุมัติได้สำเร็จ', 'success');
      logger.log('✅ Saved department permissions:', selectedDepartmentIds);
    } catch (error: any) {
      logger.error('❌ Failed to save department permissions:', error);
      showToast(error.message || 'ไม่สามารถบันทึกสิทธิ์แผนกได้', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">{t('employee.edit')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Loading Indicator */}
        {loadingData ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading employee data...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Employee Code (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('employee.employeeCode')}
              </label>
              <input
                type="text"
                value={currentEmployee.employee_code}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('employee.basicInfo')}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.firstNameTh')} *
                  </label>
                  <input
                    type="text"
                    name="first_name_th"
                    value={formData.first_name_th}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.lastNameTh')} *
                  </label>
                  <input
                    type="text"
                    name="last_name_th"
                    value={formData.last_name_th}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.firstNameEn')}
                  </label>
                  <input
                    type="text"
                    name="first_name_en"
                    value={formData.first_name_en}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.lastNameEn')}
                  </label>
                  <input
                    type="text"
                    name="last_name_en"
                    value={formData.last_name_en}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.email')}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.phoneNumber')}
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Work Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('employee.workInfo')}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.department')}
                  </label>
                  <select
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('common.select')}</option>
                  {departments.map((dept) => {
                    const departmentLabel =
                      i18n.language === 'th'
                        ? dept.name_th || dept.name_en
                        : dept.name_en || dept.name_th;

                    return (
                      <option key={dept.id} value={dept.id}>
                        {(departmentLabel || '').replace(/^0+/, '')}
                      </option>
                    );
                  })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.positionTh')}
                  </label>
                  <input
                    type="text"
                    name="position_th"
                    value={formData.position_th}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.role')}
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="employee">{t('employee.employee')}</option>
                    <option value="leader">{t('employee.leader')}</option>
                    <option value="manager">{t('employee.manager')}</option>
                    <option value="hr">{t('employee.hr')}</option>
                    <option value="admin">{t('employee.admin')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('employee.status')}
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">{t('employee.active')}</option>
                    <option value="inactive">{t('employee.inactive')}</option>
                    <option value="suspended">{t('employee.suspended')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Special Roles */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สิทธิ์พิเศษ</h3>
              <div className="space-y-3">

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_department_admin"
                    checked={formData.is_department_admin}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Department Admin</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_department_manager"
                    checked={formData.is_department_manager}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Department Manager</span>
                </label>
              </div>
            </div>

            {/* Multi-Department Approval Permissions */}
            {(formData.is_department_admin || formData.is_department_manager) && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">
                    แผนกเพิ่มเติมที่อนุมัติได้
                  </h3>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  เลือกแผนกที่ผู้ใช้นี้สามารถอนุมัติใบลาได้ (นอกเหนือจากแผนกของตัวเอง)
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto bg-white rounded p-3">
                  {departments
                    .filter(dept => dept.id !== formData.department_id) // Exclude own department
                    .map(dept => (
                      <label
                        key={dept.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedDepartmentIds.includes(dept.id)
                            ? 'bg-blue-100 border border-blue-300'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartmentIds.includes(dept.id)}
                          onChange={() => handleDepartmentToggle(dept.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 truncate">
                      {(
                        (i18n.language === 'th'
                          ? dept.name_th || dept.name_en
                          : dept.name_en || dept.name_th) || ''
                      ).replace(/^0+/, '')}
                        </span>
                      </label>
                    ))
                  }
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-blue-600">
                    เลือก {selectedDepartmentIds.length} แผนก
                  </span>
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    disabled={savingPermissions}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingPermissions ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์แผนก'}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

