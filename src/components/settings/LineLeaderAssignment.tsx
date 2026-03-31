import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    User,
    CheckSquare,
    Square,
    Save,
    Filter,
    RefreshCw,
    Users,
    ArrowRight
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { getManufacturingLines, bulkUpdateLineLeader } from '../../api/attendance';
import { getEmployees, Employee } from '../../api/employee';
import type { ManufacturingLine, LineCategory } from '../../types/attendance';
import { CATEGORY_NAMES, CATEGORY_COLORS } from '../../types/attendance';

export function LineLeaderAssignment() {
    const { t, i18n } = useTranslation();
    const { showToast, showModal } = useToast();
    const isThai = i18n.language === 'th';

    // Data State
    const [lines, setLines] = useState<ManufacturingLine[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Selection State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

    // Filters
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [lineSearch, setLineSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<LineCategory | 'all'>('all');

    useEffect(() => {
        loadData();
    }, []);

    // When employee selection changes, update selected lines based on current ownership
    useEffect(() => {
        if (selectedEmployeeId) {
            const linesOwned = lines
                .filter(l => l.line_leader_id === selectedEmployeeId)
                .map(l => l.id);
            setSelectedLineIds(new Set(linesOwned));
        } else {
            setSelectedLineIds(new Set());
        }
    }, [selectedEmployeeId, lines]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [linesData, employeesData] = await Promise.all([
                getManufacturingLines(),
                getEmployees({ status: 'active' }) // Fetch active employees
            ]);
            setLines(linesData);
            setEmployees(employeesData);
        } catch (error: any) {
            showToast(error.message || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedEmployeeId) {
            showToast(isThai ? 'กรุณาเลือกพนักงานก่อน' : 'Please select an employee first', 'warning');
            return;
        }

        setSaving(true);
        try {
            // 1. Find lines that were previously owned by this user but are now unchecked (to be unassigned)
            // Actually, simply checking lines for THIS user implies we want to set them to THIS user.
            // But what about lines that were UNCHECKED? Should we remove them?
            // "tick the 10 line that needed to be assigned to this employee"
            // Usually this means: "Set these 10 lines to User X".
            // Does it mean unassign lines that User X HAD but are not ticked? YES, implies full sync for that user.

            // Current strategy:
            // 1. Get all lines currently owned by selectedEmployeeId
            const currentOwnedIds = lines.filter(l => l.line_leader_id === selectedEmployeeId).map(l => l.id);

            // 2. Identification
            // To Add: In selectedLineIds BUT NOT in currentOwnedIds
            // To Remove: In currentOwnedIds BUT NOT in selectedLineIds
            const toAdd = Array.from(selectedLineIds).filter(id => !currentOwnedIds.includes(id));
            const toRemove = currentOwnedIds.filter(id => !selectedLineIds.has(id));

            const updates = [
                ...toAdd.map(id => ({ id, line_leader_id: selectedEmployeeId })),
                ...toRemove.map(id => ({ id, line_leader_id: null })) // Unassign
            ];

            if (updates.length === 0) {
                showToast(isThai ? 'ไม่มีการเปลี่ยนแปลง' : 'No changes to save', 'info');
                setSaving(false);
                return;
            }

            await bulkUpdateLineLeader(updates);

            // Refresh local data
            await loadData(); // Reload to get fresh state 

            showToast(isThai ? 'บันทึกข้อมูลเรียบร้อย' : 'Assignments saved successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Save failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleLine = (lineId: string) => {
        const newSet = new Set(selectedLineIds);
        if (newSet.has(lineId)) {
            newSet.delete(lineId);
        } else {
            newSet.add(lineId);
        }
        setSelectedLineIds(newSet);
    };

    const selectAllFilteredLines = () => {
        const newSet = new Set(selectedLineIds);
        filteredLines.forEach(l => newSet.add(l.id));
        setSelectedLineIds(newSet);
    };

    const deselectAllFilteredLines = () => {
        const newSet = new Set(selectedLineIds);
        filteredLines.forEach(l => newSet.delete(l.id));
        setSelectedLineIds(newSet);
    };

    // Derived State
    const filteredEmployees = employees.filter(e =>
        e.employee_code.includes(employeeSearch) ||
        e.name_th.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        e.name_en.toLowerCase().includes(employeeSearch.toLowerCase())
    );

    const filteredLines = lines.filter(l => {
        if (activeCategory !== 'all' && l.category !== activeCategory) return false;
        if (lineSearch) {
            const s = lineSearch.toLowerCase();
            return l.code.toLowerCase().includes(s) ||
                (l.name_th && l.name_th.toLowerCase().includes(s)) ||
                (l.name_en && l.name_en.toLowerCase().includes(s));
        }
        return true;
    });

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isThai ? 'กำหนดหัวหน้าไลน์ (Bulk Assign)' : 'Assign Line Leaders'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {isThai
                            ? 'เลือกพนักงานและกำหนดไลน์ที่ต้องการให้ดูแล'
                            : 'Select an employee and assign multiple lines to them'}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !selectedEmployeeId}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                    <Save className="w-4 h-4" />
                    {saving ? (isThai ? 'กำลังบันทึก...' : 'Saving...') : (isThai ? 'บันทึกการเปลี่ยนแปลง' : 'Save Assignments')}
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left Panel: Employee Selection */}
                <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                            {isThai ? '1. เลือกพนักงาน (Leader)' : '1. Select Employee'}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                placeholder={isThai ? 'ค้นหาชื่อ หรือรหัส...' : 'Search name or code...'}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Loading...</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredEmployees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => setSelectedEmployeeId(emp.id)}
                                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${selectedEmployeeId === emp.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedEmployeeId === emp.id ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {emp.employee_code.slice(-2)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium truncate ${selectedEmployeeId === emp.id ? 'text-blue-900' : 'text-gray-900'}`}>
                                                {isThai ? emp.name_th : emp.name_en}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {emp.employee_code} • {isThai ? emp.position_th : emp.position_en}
                                            </p>
                                        </div>
                                        {selectedEmployeeId === emp.id && (
                                            <ArrowRight className="w-4 h-4 text-blue-500 ml-auto" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Line Selection */}
                <div className={`w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-opacity ${!selectedEmployeeId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">
                                {isThai ? '2. เลือกไลน์การผลิต' : '2. Select Lines'}
                                {selectedEmployee && (
                                    <span className="ml-2 font-normal text-gray-500">
                                        for <span className="text-blue-600 font-semibold">{isThai ? selectedEmployee.name_th : selectedEmployee.name_en}</span>
                                    </span>
                                )}
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAllFilteredLines}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={deselectAllFilteredLines}
                                    className="text-xs text-gray-600 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={lineSearch}
                                    onChange={(e) => setLineSearch(e.target.value)}
                                    placeholder={isThai ? 'ค้นหาไลน์...' : 'Search lines...'}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                />
                            </div>
                            <select
                                value={activeCategory}
                                onChange={(e) => setActiveCategory(e.target.value as LineCategory | 'all')}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="all">All Categories</option>
                                {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
                                    <option key={key} value={key}>{label.en}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                        {loading ? (
                            <div className="text-center text-gray-500">Loading...</div>
                        ) : filteredLines.length === 0 ? (
                            <div className="text-center text-gray-500 mt-8">No lines found</div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredLines.map(line => {
                                    const isSelected = selectedLineIds.has(line.id);
                                    const isOwnedByOther = line.line_leader_id && line.line_leader_id !== selectedEmployeeId;

                                    return (
                                        <div
                                            key={line.id}
                                            onClick={() => toggleLine(line.id)}
                                            className={`
                                                relative cursor-pointer p-3 rounded-lg border transition-all select-none
                                                ${isSelected
                                                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                                }
                                            `}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`}>
                                                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                                            {line.code}
                                                        </span>
                                                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium bg-${CATEGORY_COLORS[line.category]}-100 text-${CATEGORY_COLORS[line.category]}-800`}>
                                                            {line.category}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                                        {isThai ? line.name_th : line.name_en}
                                                    </p>

                                                    {/* Conflict Warning */}
                                                    {isOwnedByOther && (
                                                        <div className="mt-2 text-xs flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                            <User className="w-3 h-3" />
                                                            <span className="truncate">
                                                                {isThai ? line.line_leader_name_th : line.line_leader_name_en}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
