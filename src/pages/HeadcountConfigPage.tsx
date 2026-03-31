import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings2,
    Users,
    Save,
    RefreshCw,
    Search,
    ChevronDown,
    Check,
    X,
    AlertCircle,
    Moon,
    Sun,
    UserCircle,
} from 'lucide-react';
import { SearchableSelect } from '../components/common/SearchableSelect';
import {
    getManufacturingLines,
    updateManufacturingLine,
    bulkUpdateHeadcount,
} from '../api/attendance';
import { getEmployees } from '../api/employee';
import type {
    ManufacturingLine,
    LineCategory,
} from '../types/attendance';
import type { Employee } from '../api/employee';
import { CATEGORY_NAMES, CATEGORY_COLORS } from '../types/attendance';
import { useToast } from '../hooks/useToast';

export function HeadcountConfigPage() {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const isThaiLanguage = i18n.language === 'th';

    // State
    const [lines, setLines] = useState<ManufacturingLine[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<LineCategory | 'all'>('all');
    const [editedValues, setEditedValues] = useState<Record<string, Partial<ManufacturingLine>>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Bulk Selection State
    const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
    const [bulkLeaderId, setBulkLeaderId] = useState<string>('');

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [linesData, employeesData] = await Promise.all([
                getManufacturingLines({ active_only: true }),
                getEmployees({ status: 'active' })
            ]);
            setLines(linesData);
            setEmployees(employeesData);
        } catch (error: any) {
            showToast(error.message || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter lines
    const filteredLines = useMemo(() => {
        return lines.filter((line) => {
            // Category filter
            if (activeCategory !== 'all' && line.category !== activeCategory) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (
                    line.code.toLowerCase().includes(search) ||
                    line.name_th?.toLowerCase().includes(search) ||
                    line.name_en?.toLowerCase().includes(search)
                );
            }

            return true;
        });
    }, [lines, activeCategory, searchTerm]);

    // Calculate totals
    const totals = useMemo(() => {
        const displayLines = activeCategory === 'all' ? lines : lines.filter(l => l.category === activeCategory);
        return {
            lines: displayLines.length,
            day: displayLines.reduce((sum, l) => sum + (editedValues[l.id]?.headcount_day ?? l.headcount_day), 0),
            nightAB: displayLines.reduce((sum, l) => sum + (editedValues[l.id]?.headcount_night_ab ?? l.headcount_night_ab), 0),
            nightCD: displayLines.reduce((sum, l) => sum + (editedValues[l.id]?.headcount_night_cd ?? l.headcount_night_cd), 0),
        };
    }, [lines, activeCategory, editedValues]);

    // Prepare employee options for searchable select
    const employeeOptions = useMemo(() => {
        return [
            { value: '', label: isThaiLanguage ? '-- เลือกหัวหน้าไลน์ --' : '-- Select Leader --' },
            ...employees.map(emp => ({
                value: emp.id,
                label: isThaiLanguage
                    ? `${emp.name_th} (${emp.employee_code})`
                    : `${emp.name_en} (${emp.employee_code})`
            }))
        ];
    }, [employees, isThaiLanguage]);

    // Handle value change
    const handleValueChange = (lineId: string, field: keyof ManufacturingLine, value: any) => {
        setEditedValues((prev) => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                [field]: value,
            },
        }));
        setHasChanges(true);
    };

    // Get current value
    const getValue = (line: ManufacturingLine, field: keyof ManufacturingLine) => {
        return editedValues[line.id]?.[field] ?? line[field];
    };

    // Save changes
    const handleSave = async () => {
        if (!hasChanges || Object.keys(editedValues).length === 0) return;

        setSaving(true);
        try {
            const updates = Object.entries(editedValues).map(([id, values]) => ({
                id,
                ...values,
            }));

            await bulkUpdateHeadcount(updates);

            showToast(
                isThaiLanguage ? 'บันทึกสำเร็จ' : 'Changes saved successfully',
                'success'
            );

            // Reload data
            await loadData();
            setEditedValues({});
            setHasChanges(false);
            setSelectedLines(new Set());
        } catch (error: any) {
            showToast(error.message || 'Failed to save changes', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Discard changes
    const handleDiscard = () => {
        setEditedValues({});
        setHasChanges(false);
        setSelectedLines(new Set());
    };

    // Bulk Selection Handlers
    const toggleSelectLine = (id: string) => {
        const newSelected = new Set(selectedLines);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLines(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedLines.size === filteredLines.length) {
            setSelectedLines(new Set());
        } else {
            setSelectedLines(new Set(filteredLines.map(l => l.id)));
        }
    };

    const applyBulkLeader = () => {
        if (!bulkLeaderId || selectedLines.size === 0) return;

        const newEditedValues = { ...editedValues };
        selectedLines.forEach(lineId => {
            newEditedValues[lineId] = {
                ...newEditedValues[lineId],
                line_leader_id: bulkLeaderId
            };
        });

        setEditedValues(newEditedValues);
        setHasChanges(true);

        showToast(
            isThaiLanguage ? `กำหนดหัวหน้าไลน์ให้ ${selectedLines.size} รายการแล้ว` : `Assigned leader to ${selectedLines.size} lines`,
            'success'
        );

        // Clear selection to allow user to verify
        setSelectedLines(new Set());
        setBulkLeaderId('');
    };

    // Category tabs
    const categories: { key: LineCategory | 'all'; label: string; color: string }[] = [
        { key: 'all', label: isThaiLanguage ? 'ทั้งหมด' : 'All', color: 'gray' },
        { key: '5s', label: '5S', color: 'purple' },
        { key: 'asm', label: 'Assembly', color: 'blue' },
        { key: 'pro', label: 'Processing', color: 'green' },
        { key: 'tpl', label: 'TPL', color: 'orange' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">{isThaiLanguage ? 'กำลังโหลด...' : 'Loading...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                <Settings2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {isThaiLanguage ? 'ตั้งค่าจำนวนพนักงาน & หัวหน้าไลน์' : 'Line Configuration'}
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    {isThaiLanguage
                                        ? 'กำหนดจำนวนพนักงานและหัวหน้าไลน์สำหรับแต่ละไลน์การผลิต'
                                        : 'Set headcount requirements and assign line leaders'}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            {hasChanges && (
                                <>
                                    <button
                                        onClick={handleDiscard}
                                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        {isThaiLanguage ? 'ยกเลิก' : 'Discard'}
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {saving ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        {isThaiLanguage ? 'บันทึก' : 'Save Changes'}
                                    </button>
                                </>
                            )}
                            {!hasChanges && (
                                <button
                                    onClick={loadData}
                                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={isThaiLanguage ? 'รีเฟรช' : 'Refresh'}
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{isThaiLanguage ? 'จำนวนไลน์' : 'Lines'}</p>
                                <p className="text-2xl font-bold text-gray-900">{totals.lines}</p>
                            </div>
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <Settings2 className="w-5 h-5 text-gray-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-orange-100 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-600 flex items-center gap-1">
                                    <Sun className="w-4 h-4" />
                                    {isThaiLanguage ? 'กลางวัน' : 'Day'}
                                </p>
                                <p className="text-2xl font-bold text-orange-900">{totals.day}</p>
                            </div>
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Users className="w-5 h-5 text-orange-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl shadow-sm border border-blue-100 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 flex items-center gap-1">
                                    <Moon className="w-4 h-4" />
                                    {isThaiLanguage ? 'กลางคืน AB' : 'Night AB'}
                                </p>
                                <p className="text-2xl font-bold text-blue-900">{totals.nightAB}</p>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl shadow-sm border border-purple-100 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-600 flex items-center gap-1">
                                    <Moon className="w-4 h-4" />
                                    {isThaiLanguage ? 'กลางคืน CD' : 'Night CD'}
                                </p>
                                <p className="text-2xl font-bold text-purple-900">{totals.nightCD}</p>
                            </div>
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Users className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Category Tabs & Search */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                            {categories.map((cat) => (
                                <button
                                    key={cat.key}
                                    onClick={() => setActiveCategory(cat.key)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.key
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {cat.label}
                                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${activeCategory === cat.key
                                        ? 'bg-white/20 text-white'
                                        : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {cat.key === 'all'
                                            ? lines.length
                                            : lines.filter((l) => l.category === cat.key).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={isThaiLanguage ? 'ค้นหาไลน์...' : 'Search lines...'}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Lines Table */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
                        <div className="col-span-2 flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={filteredLines.length > 0 && selectedLines.size === filteredLines.length}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {isThaiLanguage ? 'รหัสไลน์' : 'Line Code'}
                        </div>
                        <div className="col-span-1">{isThaiLanguage ? 'หมวดหมู่' : 'Category'}</div>
                        <div className="col-span-4">{isThaiLanguage ? 'หัวหน้าไลน์ (SSTH)' : 'Line Leader (SSTH)'}</div>
                        <div className="col-span-5 grid grid-cols-3 gap-2 text-center">
                            <div>
                                <span className="flex items-center justify-center gap-1">
                                    <Sun className="w-4 h-4 text-orange-500" />
                                    {isThaiLanguage ? 'กลางวัน' : 'Day'}
                                </span>
                            </div>
                            <div>
                                <span className="flex items-center justify-center gap-1">
                                    <Moon className="w-4 h-4 text-blue-500" />
                                    {isThaiLanguage ? 'AB' : 'AB'}
                                </span>
                            </div>
                            <div>
                                <span className="flex items-center justify-center gap-1">
                                    <Moon className="w-4 h-4 text-purple-500" />
                                    {isThaiLanguage ? 'CD' : 'CD'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-gray-100">
                        {filteredLines.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>{isThaiLanguage ? 'ไม่พบข้อมูล' : 'No lines found'}</p>
                            </div>
                        ) : (
                            filteredLines.map((line) => {
                                const dayVal = getValue(line, 'headcount_day') as number;
                                const abVal = getValue(line, 'headcount_night_ab') as number;
                                const cdVal = getValue(line, 'headcount_night_cd') as number;
                                const leaderId = getValue(line, 'line_leader_id') as string | undefined;
                                const isEdited = !!editedValues[line.id];
                                const isSelected = selectedLines.has(line.id);

                                return (
                                    <div
                                        key={line.id}
                                        className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors ${isEdited ? 'bg-yellow-50' : isSelected ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        {/* Line Code & Checkbox */}
                                        <div className="col-span-12 md:col-span-2">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectLine(line.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-700 text-sm">
                                                    {line.code.substring(0, 3)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{line.code}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {isThaiLanguage ? line.name_th : line.name_en || line.code}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Category */}
                                        <div className="col-span-4 md:col-span-1">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium ${line.category === '5s'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : line.category === 'asm'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : line.category === 'pro'
                                                            ? 'bg-green-100 text-green-700'
                                                            : line.category === 'tpl'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                    }`}
                                            >
                                                {CATEGORY_NAMES[line.category]?.[isThaiLanguage ? 'th' : 'en'] || line.category.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Line Leader (Searchable) */}
                                        <div className="col-span-12 md:col-span-4">
                                            <SearchableSelect
                                                value={leaderId || ''}
                                                options={employeeOptions}
                                                onChange={(val) => handleValueChange(line.id, 'line_leader_id', val || null)}
                                                placeholder={isThaiLanguage ? '-- เลือกหัวหน้าไลน์ --' : '-- Select Leader --'}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* Headcounts */}
                                        <div className="col-span-8 md:col-span-5 grid grid-cols-3 gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={dayVal}
                                                onChange={(e) =>
                                                    handleValueChange(line.id, 'headcount_day', parseInt(e.target.value) || 0)
                                                }
                                                className="w-full px-2 py-2 text-center border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none font-medium"
                                                placeholder="Day"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={abVal}
                                                onChange={(e) =>
                                                    handleValueChange(line.id, 'headcount_night_ab', parseInt(e.target.value) || 0)
                                                }
                                                className="w-full px-2 py-2 text-center border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-medium"
                                                placeholder="AB"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={cdVal}
                                                onChange={(e) =>
                                                    handleValueChange(line.id, 'headcount_night_cd', parseInt(e.target.value) || 0)
                                                }
                                                className="w-full px-2 py-2 text-center border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none font-medium"
                                                placeholder="CD"
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Unsaved Changes Warning */}
                {hasChanges && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-200 rounded-xl shadow-lg px-6 py-4 flex items-center gap-4 z-50">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <p className="text-sm text-yellow-800">
                            {isThaiLanguage
                                ? `มีการเปลี่ยนแปลง ${Object.keys(editedValues).length} รายการที่ยังไม่ได้บันทึก`
                                : `You have ${Object.keys(editedValues).length} unsaved change(s)`}
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                        >
                            {saving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : isThaiLanguage ? (
                                'บันทึกเดี๋ยวนี้'
                            ) : (
                                'Save Now'
                            )}
                        </button>
                    </div>
                )}

                {/* Bulk Action Bar - Show when lines are selected */}
                {selectedLines.size > 0 && !hasChanges && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl shadow-xl px-6 py-4 flex items-center gap-4 z-50 min-w-[300px] md:min-w-[500px] animate-slide-up">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 whitespace-nowrap">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                                {selectedLines.size}
                            </div>
                            {isThaiLanguage ? 'รายการที่เลือก' : 'Selected'}
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-2"></div>

                        <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 min-w-[200px]">
                                <SearchableSelect
                                    value={bulkLeaderId}
                                    options={employeeOptions.filter(o => o.value !== '')}
                                    onChange={setBulkLeaderId}
                                    placeholder={isThaiLanguage ? '-- เลือกหัวหน้าไลน์เพื่อกำหนด --' : '-- Select Leader to Assign --'}
                                    className="w-full"
                                />
                            </div>
                            <button
                                onClick={applyBulkLeader}
                                disabled={!bulkLeaderId}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                            >
                                {isThaiLanguage ? 'นำไปใช้' : 'Apply'}
                            </button>
                        </div>

                        <button
                            onClick={() => setSelectedLines(new Set())}
                            className="p-2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <style>{`
                    @keyframes slide-up {
                        from { transform: translate(-50%, 100%); opacity: 0; }
                        to { transform: translate(-50%, 0); opacity: 1; }
                    }
                    .animate-slide-up {
                        animation: slide-up 0.3s ease-out;
                    }
                `}</style>
            </div>
        </div>
    );
}

export default HeadcountConfigPage;
