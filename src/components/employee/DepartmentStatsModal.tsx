
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Employee } from '../../api/employee';
import { useMemo } from 'react';

interface DepartmentStatsModalProps {
    employees: Employee[];
    onClose: () => void;
}

interface DepartmentStat {
    departmentName: string;
    total: number;
    managers: number;
    admins: number;
}

export function DepartmentStatsModal({ employees, onClose }: DepartmentStatsModalProps) {
    const { t, i18n } = useTranslation();

    const stats = useMemo(() => {
        const deptMap = new Map<string, DepartmentStat>();

        employees.forEach(employee => {
            // Exclude Dev/Super User
            if (employee.employee_code === '999999999') return;

            // Determine department name based on language or fallback
            const deptName = i18n.language === 'th'
                ? (employee.department_name_th || 'Unknown')
                : (employee.department_name_en || 'Unknown');

            if (!deptMap.has(deptName)) {
                deptMap.set(deptName, {
                    departmentName: deptName,
                    total: 0,
                    managers: 0,
                    admins: 0
                });
            }

            const stat = deptMap.get(deptName)!;
            stat.total += 1;

            if (employee.role === 'manager') {
                stat.managers += 1;
            } else if (employee.role === 'admin') {
                stat.admins += 1;
            }
        });

        return Array.from(deptMap.values()).sort((a, b) => a.departmentName.localeCompare(b.departmentName));
    }, [employees, i18n.language]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {i18n.language === 'th' ? 'สถิติแผนก' : 'Department Statistics'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                                        {t('employee.department')}
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                                        {t('employee.total')}
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-purple-600">
                                        {t('employee.admin')}
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-600">
                                        {t('employee.manager')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {stats.map((stat) => (
                                    <tr key={stat.departmentName} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                            {stat.departmentName}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-900">
                                            {stat.total}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-purple-600 font-medium">
                                            {stat.admins}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-blue-600 font-medium">
                                            {stat.managers}
                                        </td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                        {i18n.language === 'th' ? 'รวมทั้งหมด' : 'Grand Total'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                                        {stats.reduce((sum, s) => sum + s.total, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-purple-600">
                                        {stats.reduce((sum, s) => sum + s.admins, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-blue-600">
                                        {stats.reduce((sum, s) => sum + s.managers, 0)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}

