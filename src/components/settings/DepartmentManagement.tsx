import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import {
  Department,
  getHierarchicalDepartments,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../api/department';

export function DepartmentManagement() {
  const { t } = useTranslation();
  const { showToast, showModal: showConfirmModal } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    code: '',
    parent_department_id: '',
    level: 0,
    sort_order: 0,
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await getHierarchicalDepartments();
      setDepartments(data);
    } catch (error: any) {
      // Fallback to regular departments if hierarchy fails
      try {
        const fallbackData = await getDepartments();
        setDepartments(fallbackData);
      } catch (fallbackError: any) {
        showToast(error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setFormData({
        name_th: dept.name_th,
        name_en: dept.name_en,
        code: dept.code,
        parent_department_id: dept.parent_department_id || '',
        level: dept.level || 0,
        sort_order: dept.sort_order || 0,
      });
    } else {
      setEditingDept(null);
      setFormData({
        name_th: '',
        name_en: '',
        code: '',
        parent_department_id: '',
        level: 0,
        sort_order: 0
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, formData);
        showToast(t('message.updateSuccess'), 'success');
      } else {
        await createDepartment(formData);
        showToast(t('message.saveSuccess'), 'success');
      }
      setShowModal(false);
      loadDepartments();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirmModal('confirm', t('settings.deleteDepartment'), {
      message: `${t('settings.deleteDepartmentConfirm')}\n${name}`,
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    try {
      await deleteDepartment(id);
      showToast(t('message.deleteSuccess'), 'success');
      loadDepartments();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('settings.departmentManagement')}
          </h3>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          {t('settings.addDepartment')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('settings.departmentCode')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('settings.departmentNameTh')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('settings.departmentNameEn')}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                {t('settings.employeeCount')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {departments.map((dept) => (
              <tr key={dept.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-sm text-gray-900">{dept.code}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-900">{dept.name_th.replace(/^0+/, '')}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-500">{dept.name_en.replace(/^0+/, '')}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{dept.employee_count || 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleOpenModal(dept)}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                    title={t('common.edit')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept.id, dept.name_th)}
                    className="text-red-600 hover:text-red-800"
                    title={t('common.delete')}
                    disabled={parseInt(dept.employee_count || '0') > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {departments.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">{t('settings.noDepartments')}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDept ? t('settings.editDepartment') : t('settings.addDepartment')}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.departmentCode')} *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.departmentNameTh')} *
                </label>
                <input
                  type="text"
                  value={formData.name_th}
                  onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.departmentNameEn')}
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

