import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    RefreshCw,
    MoreVertical
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import {
    getManufacturingLines,
    createManufacturingLine,
    updateManufacturingLine,
    deleteManufacturingLine
} from '../../api/attendance';
import type { ManufacturingLine, ManufacturingLineFormData, LineCategory } from '../../types/attendance';
import { CATEGORY_NAMES, CATEGORY_COLORS } from '../../types/attendance';

export function ManufacturingLineManagement() {
    const { t, i18n } = useTranslation();
    const { showToast, showModal } = useToast();
    const isThai = i18n.language === 'th';

    const [lines, setLines] = useState<ManufacturingLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLine, setEditingLine] = useState<ManufacturingLine | null>(null);

    // Form State
    const [formData, setFormData] = useState<ManufacturingLineFormData>({
        code: '',
        name_th: '',
        name_en: '',
        category: 'asm',
        headcount_day: 0,
        headcount_night_ab: 0,
        headcount_night_cd: 0,
        description: '',
        sort_order: 0,
        is_active: true
    });

    useEffect(() => {
        fetchLines();
    }, []);

    const fetchLines = async () => {
        setLoading(true);
        try {
            const data = await getManufacturingLines();
            setLines(data);
        } catch (error: any) {
            showToast(error.message || 'Failed to fetch lines', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (line?: ManufacturingLine) => {
        if (line) {
            setEditingLine(line);
            setFormData({
                code: line.code,
                name_th: line.name_th || '',
                name_en: line.name_en || '',
                category: line.category,
                headcount_day: line.headcount_day,
                headcount_night_ab: line.headcount_night_ab,
                headcount_night_cd: line.headcount_night_cd,
                description: line.description || '',
                sort_order: line.sort_order,
                is_active: line.is_active
            });
        } else {
            setEditingLine(null);
            setFormData({
                code: '',
                name_th: '',
                name_en: '',
                category: 'asm',
                headcount_day: 0,
                headcount_night_ab: 0,
                headcount_night_cd: 0,
                description: '',
                sort_order: lines.length * 10,
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingLine) {
                await updateManufacturingLine(editingLine.id, formData);
                showToast(isThai ? 'อัปเดตข้อมูลสำเร็จ' : 'Line updated successfully', 'success');
            } else {
                await createManufacturingLine(formData);
                showToast(isThai ? 'สร้างไลน์ผลิตสำเร็จ' : 'Line created successfully', 'success');
            }
            setIsModalOpen(false);
            fetchLines();
        } catch (error: any) {
            showToast(error.message || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (line: ManufacturingLine) => {
        showModal(
            'confirm',
            isThai ? 'ยืนยันการลบ' : 'Confirm Delete',
            {
                message: isThai
                    ? `คุณต้องการลบไลน์ ${line.code} ใช่หรือไม่?`
                    : `Are you sure you want to delete line ${line.code}?`,
                confirmText: isThai ? 'ลบ' : 'Delete',
                onConfirm: async () => {
                    try {
                        await deleteManufacturingLine(line.id);
                        showToast(isThai ? 'ลบข้อมูลสำเร็จ' : 'Line deleted successfully', 'success');
                        fetchLines();
                    } catch (error: any) {
                        showToast(error.message || 'Delete failed', 'error');
                    }
                }
            }
        );
    };

    const filteredLines = lines.filter(line =>
        line.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (line.name_th && line.name_th.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (line.name_en && line.name_en.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isThai ? 'จัดการไลน์ผลิต' : 'Manufacturing Lines'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {isThai ? 'เพิ่ม ลบ แก้ไข ข้อมูลไลน์การผลิตและจำนวนคน' : 'Manage production lines and headcount requirements'}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {isThai ? 'เพิ่มไลน์ใหม่' : 'Add New Line'}
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isThai ? 'ค้นหารหัส, ชื่อไลน์...' : 'Search code, name...'}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-medium text-gray-500">Code</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Category</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                                <th className="px-6 py-3 font-medium text-gray-500 text-center">Headcount (D/N)</th>
                                <th className="px-6 py-3 font-medium text-gray-500 text-center">Status</th>
                                <th className="px-6 py-3 font-medium text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredLines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No lines found
                                    </td>
                                </tr>
                            ) : (
                                filteredLines.map((line) => (
                                    <tr key={line.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{line.code}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${CATEGORY_COLORS[line.category]}-100 text-${CATEGORY_COLORS[line.category]}-800`}>
                                                {CATEGORY_NAMES[line.category]?.en || line.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-900">{isThai ? line.name_th : line.name_en}</div>
                                            <div className="text-xs text-gray-500">{isThai ? line.name_en : line.name_th}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2 text-xs">
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded" title="Day">D: {line.headcount_day}</span>
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded" title="Night AB">AB: {line.headcount_night_ab}</span>
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded" title="Night CD">CD: {line.headcount_night_cd}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {line.is_active ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    <CheckCircle className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                    <XCircle className="w-3 h-3" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(line)}
                                                    className="p-1 hover:bg-gray-100 rounded text-blue-600 transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(line)}
                                                    className="p-1 hover:bg-gray-100 rounded text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingLine
                                    ? (isThai ? 'แก้ไขไลน์ผลิต' : 'Edit Manufacturing Line')
                                    : (isThai ? 'เพิ่มไลน์ผลิต' : 'Add Manufacturing Line')
                                }
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. L01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as LineCategory })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
                                            <option key={key} value={key}>{label.en} ({label.th})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (TH)</label>
                                    <input
                                        type="text"
                                        value={formData.name_th || ''}
                                        onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN)</label>
                                    <input
                                        type="text"
                                        value={formData.name_en || ''}
                                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Headcount Requirements</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Day Shift</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.headcount_day}
                                            onChange={(e) => setFormData({ ...formData, headcount_day: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Night AB</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.headcount_night_ab}
                                            onChange={(e) => setFormData({ ...formData, headcount_night_ab: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Night CD</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.headcount_night_cd}
                                            onChange={(e) => setFormData({ ...formData, headcount_night_cd: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Active</span>
                                </label>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                                    >
                                        {isThai ? 'บันทึก' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }
        </div >
    );
}
