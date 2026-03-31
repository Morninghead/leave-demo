// src/components/approval/ApprovalFilters.tsx
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

export function ApprovalFilters() {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('common.search')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('approval.searchByName')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('common.priority')}
          </label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="">{t('common.all')}</option>
            <option value="urgent">{t('common.urgent')}</option>
            <option value="normal">{t('common.normal')}</option>
          </select>
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('common.department')}
          </label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="">{t('common.all')}</option>
            <option value="it">IT</option>
            <option value="hr">HR</option>
            <option value="sales">Sales</option>
          </select>
        </div>
      </div>
    </div>
  );
}
