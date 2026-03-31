import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { CreateEmployeeData, createEmployee } from '../../api/employee';
import { Department, getDepartments } from '../../api/department';
import { DatePicker } from '../common/DatePicker';

interface AddEmployeeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState<CreateEmployeeData>({
    employee_code: '',
    scan_code: '',
    first_name_th: '',
    last_name_th: '',
    first_name_en: '',
    last_name_en: '',
    email: '',
    phone_number: '',
    department_id: '',
    position_th: '',
    position_en: '',
    role: 'employee',
    birth_date: '',
    hire_date: new Date().toISOString().split('T')[0],
    national_id: '',
    address_th: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const depts = await getDepartments();
      console.log('✅ Loaded departments:', depts);
      setDepartments(depts);
    } catch (error) {
      console.error('❌ Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDateChange = (name: string, date: Date | null) => {
    // Convert Date to YYYY-MM-DD string, avoiding timezone shifts
    let dateStr = '';
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    setFormData({
      ...formData,
      [name]: dateStr,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createEmployee(formData);
      showToast(t('message.saveSuccess'), 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">{t('employee.addNew')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('employee.basicInfo')}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.employeeCode')} *
                </label>
                <input
                  type="text"
                  name="employee_code"
                  value={formData.employee_code}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.scanCode')}
                </label>
                <input
                  type="text"
                  name="scan_code"
                  value={formData.scan_code || ''}
                  onChange={handleChange}
                  placeholder={t('auth.scanCodePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.email')} *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.nationalId')}
                </label>
                <input
                  type="text"
                  name="national_id"
                  value={formData.national_id}
                  onChange={handleChange}
                  maxLength={13}
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
                  {t('employee.hireDate')}
                </label>
                <DatePicker
                  value={formData.hire_date ? new Date(formData.hire_date) : null}
                  onChange={(date) => handleDateChange('hire_date', date)}
                  placeholder={t('employee.hireDate')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.birthDate')}
                </label>
                <DatePicker
                  value={formData.birth_date ? new Date(formData.birth_date) : null}
                  onChange={(date) => handleDateChange('birth_date', date)}
                  placeholder={t('employee.birthDate')}
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('employee.emergencyContact')}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.emergencyContactName')}
                </label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('employee.emergencyContactPhone')}
                </label>
                <input
                  type="tel"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('employee.address')}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('employee.addressThai')}
              </label>
              <textarea
                name="address_th"
                value={formData.address_th}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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
      </div>
    </div>
  );
}

