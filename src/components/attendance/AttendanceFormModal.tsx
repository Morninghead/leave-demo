// src/components/attendance/AttendanceFormModal.tsx
// Modal for submitting/editing attendance for a specific line

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X,
    Users,
    Check,
    XCircle,
    Clock,
    AlertTriangle,
    ChevronDown,
    Send,
    RefreshCw,
    UserPlus,
    Search,
} from 'lucide-react';
import {
    getLineEmployees,
    submitLineAttendance,
    getLineAttendance,
} from '../../api/attendance';
import type {
    SubcontractEmployee,
    LineAttendance,
    AttendanceEmployeeEntry,
    ShiftType,
    AbsenceReason,
} from '../../types/attendance';
import { SHIFT_NAMES, ABSENCE_REASON_NAMES } from '../../types/attendance';
import { useToast } from '../../hooks/useToast';

interface AttendanceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    lineId: string;
    lineCode: string;
    lineName: string;
    date: string;
    shift: ShiftType;
    requiredCount: number;
    onSuccess?: () => void;
}

export function AttendanceFormModal({
    isOpen,
    onClose,
    lineId,
    lineCode,
    lineName,
    date,
    shift,
    requiredCount,
    onSuccess,
}: AttendanceFormModalProps) {
    const { i18n } = useTranslation();
    const { showToast } = useToast();
    const isThaiLanguage = i18n.language === 'th';

    // State
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [employees, setEmployees] = useState<SubcontractEmployee[]>([]);
    const [attendance, setAttendance] = useState<Map<string, AttendanceEmployeeEntry>>(new Map());
    const [existingAttendance, setExistingAttendance] = useState<LineAttendance | null>(null);
    const [replacementRequested, setReplacementRequested] = useState(0);
    const [replacementNotes, setReplacementNotes] = useState('');
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Load data
    useEffect(() => {
        if (isOpen && lineId) {
            loadData();
        }
    }, [isOpen, lineId, date, shift]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load employees and existing attendance in parallel
            const [employeesData, existingData] = await Promise.all([
                getLineEmployees({ line_id: lineId, shift }),
                getLineAttendance({ line_id: lineId, date, shift }),
            ]);

            setEmployees(employeesData);
            setExistingAttendance(existingData);

            // Initialize attendance map
            const newAttendance = new Map<string, AttendanceEmployeeEntry>();

            if (existingData && existingData.details) {
                // Use existing data
                existingData.details.forEach((detail: any) => {
                    newAttendance.set(detail.subcontract_employee_id, {
                        subcontract_employee_id: detail.subcontract_employee_id,
                        is_present: detail.is_present,
                        check_in_time: detail.check_in_time,
                        check_out_time: detail.check_out_time,
                        absence_reason: detail.absence_reason,
                        absence_notes: detail.absence_notes,
                        is_replacement: detail.is_replacement,
                        replacing_for: detail.replacing_for,
                    });
                });

                setReplacementRequested(existingData.replacement_requested || 0);
                setReplacementNotes(existingData.replacement_notes || '');
                setNotes(existingData.notes || '');
            } else {
                // Initialize all as present
                employeesData.forEach((emp: SubcontractEmployee) => {
                    newAttendance.set(emp.id, {
                        subcontract_employee_id: emp.id,
                        is_present: true,
                    });
                });
            }

            setAttendance(newAttendance);
        } catch (error: any) {
            showToast(error.message || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter employees by search
    const filteredEmployees = useMemo(() => {
        if (!searchTerm) return employees;

        const search = searchTerm.toLowerCase();
        return employees.filter(
            (emp) =>
                emp.employee_code.toLowerCase().includes(search) ||
                emp.first_name_th.toLowerCase().includes(search) ||
                emp.last_name_th.toLowerCase().includes(search) ||
                emp.nickname?.toLowerCase().includes(search)
        );
    }, [employees, searchTerm]);

    // Calculate counts
    const counts = useMemo(() => {
        let present = 0;
        let absent = 0;

        attendance.forEach((entry) => {
            if (entry.is_present) {
                present++;
            } else {
                absent++;
            }
        });

        return { present, absent, total: employees.length };
    }, [attendance, employees]);

    // Toggle attendance
    const toggleAttendance = (employeeId: string, isPresent: boolean) => {
        const newAttendance = new Map(attendance);
        const entry = newAttendance.get(employeeId) || {
            subcontract_employee_id: employeeId,
            is_present: true,
        };

        newAttendance.set(employeeId, {
            ...entry,
            is_present: isPresent,
            absence_reason: isPresent ? undefined : entry.absence_reason,
            absence_notes: isPresent ? undefined : entry.absence_notes,
        });

        setAttendance(newAttendance);
    };

    // Update absence reason
    const updateAbsenceReason = (employeeId: string, reason: AbsenceReason) => {
        const newAttendance = new Map(attendance);
        const entry = newAttendance.get(employeeId);
        if (entry) {
            newAttendance.set(employeeId, {
                ...entry,
                absence_reason: reason,
            });
            setAttendance(newAttendance);
        }
    };

    // Mark all present
    const markAllPresent = () => {
        const newAttendance = new Map(attendance);
        employees.forEach((emp) => {
            newAttendance.set(emp.id, {
                subcontract_employee_id: emp.id,
                is_present: true,
            });
        });
        setAttendance(newAttendance);
    };

    // Handle submit
    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const employeeEntries = Array.from(attendance.values());

            await submitLineAttendance({
                line_id: lineId,
                attendance_date: date,
                shift,
                employees: employeeEntries,
                replacement_requested: replacementRequested,
                replacement_notes: replacementNotes || undefined,
                notes: notes || undefined,
            });

            showToast(
                isThaiLanguage ? 'ส่งรายชื่อสำเร็จ' : 'Attendance submitted successfully',
                'success'
            );

            onSuccess?.();
            onClose();
        } catch (error: any) {
            showToast(error.message || 'Failed to submit attendance', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Check if submission would be late
    const isLate = useMemo(() => {
        const now = new Date();
        const hours = now.getHours();
        return hours >= 10;
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <Users className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-semibold">
                                {isThaiLanguage ? 'ส่งรายชื่อ' : 'Submit Attendance'} - {lineCode}
                            </h2>
                            <p className="text-sm text-white/80">
                                {new Date(date).toLocaleDateString(isThaiLanguage ? 'th-TH' : 'en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })}{' '}
                                • {SHIFT_NAMES[shift][isThaiLanguage ? 'th' : 'en']}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Late Warning */}
                {isLate && !existingAttendance && (
                    <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm">
                            {isThaiLanguage
                                ? 'การส่งหลัง 10:00 น. จะถูกบันทึกว่าส่งสาย'
                                : 'Submissions after 10:00 AM will be marked as late'}
                        </span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>
                                {isThaiLanguage
                                    ? 'ไม่พบพนักงานในไลน์นี้'
                                    : 'No employees found for this line'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Summary & Actions */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                                        <span className="text-lg font-bold">{counts.present}</span>
                                        <span className="text-sm ml-1">
                                            {isThaiLanguage ? 'มา' : 'Present'}
                                        </span>
                                    </div>
                                    <div className="px-4 py-2 bg-red-100 text-red-700 rounded-lg">
                                        <span className="text-lg font-bold">{counts.absent}</span>
                                        <span className="text-sm ml-1">
                                            {isThaiLanguage ? 'ไม่มา' : 'Absent'}
                                        </span>
                                    </div>
                                    <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
                                        <span className="text-sm">
                                            {isThaiLanguage ? 'ต้องการ' : 'Required'}:{' '}
                                            <span className="font-bold">{requiredCount}</span>
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={markAllPresent}
                                    className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                    {isThaiLanguage ? 'มาทุกคน' : 'Mark All Present'}
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={isThaiLanguage ? 'ค้นหาพนักงาน...' : 'Search employee...'}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                />
                            </div>

                            {/* Employee List */}
                            <div className="space-y-3">
                                {filteredEmployees.map((emp) => {
                                    const entry = attendance.get(emp.id);
                                    const isPresent = entry?.is_present !== false;

                                    return (
                                        <div
                                            key={emp.id}
                                            className={`p-4 rounded-xl border-2 transition-all ${isPresent
                                                    ? 'border-green-200 bg-green-50'
                                                    : 'border-red-200 bg-red-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${isPresent ? 'bg-green-500' : 'bg-red-500'
                                                        }`}>
                                                        {emp.first_name_th.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {emp.first_name_th} {emp.last_name_th}
                                                            {emp.nickname && (
                                                                <span className="text-gray-500 ml-1">({emp.nickname})</span>
                                                            )}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {emp.employee_code} • {emp.company_name}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleAttendance(emp.id, true)}
                                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isPresent
                                                                ? 'bg-green-600 text-white shadow-lg'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                                                            }`}
                                                    >
                                                        <Check className="w-4 h-4 inline mr-1" />
                                                        {isThaiLanguage ? 'มา' : 'Present'}
                                                    </button>
                                                    <button
                                                        onClick={() => toggleAttendance(emp.id, false)}
                                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isPresent
                                                                ? 'bg-red-600 text-white shadow-lg'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                                                            }`}
                                                    >
                                                        <XCircle className="w-4 h-4 inline mr-1" />
                                                        {isThaiLanguage ? 'ไม่มา' : 'Absent'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Absence Reason Dropdown */}
                                            {!isPresent && (
                                                <div className="mt-3 pt-3 border-t border-red-200">
                                                    <label className="text-sm text-red-700 block mb-2">
                                                        {isThaiLanguage ? 'เหตุผล:' : 'Reason:'}
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(['leave', 'sick', 'no_show', 'resigned', 'other'] as AbsenceReason[]).map(
                                                            (reason) => (
                                                                <button
                                                                    key={reason}
                                                                    onClick={() => updateAbsenceReason(emp.id, reason)}
                                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${entry?.absence_reason === reason
                                                                            ? 'bg-red-600 text-white'
                                                                            : 'bg-white text-red-700 border border-red-300 hover:bg-red-100'
                                                                        }`}
                                                                >
                                                                    {ABSENCE_REASON_NAMES[reason][isThaiLanguage ? 'th' : 'en']}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Replacement Request */}
                            {counts.absent > 0 && (
                                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <h3 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                                        <UserPlus className="w-5 h-5" />
                                        {isThaiLanguage ? 'ขอคนทดแทน' : 'Request Replacement'}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm text-amber-700 block mb-1">
                                                {isThaiLanguage ? 'จำนวนที่ต้องการ' : 'Number Needed'}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={counts.absent}
                                                value={replacementRequested}
                                                onChange={(e) =>
                                                    setReplacementRequested(parseInt(e.target.value) || 0)
                                                }
                                                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-amber-700 block mb-1">
                                                {isThaiLanguage ? 'หมายเหตุ' : 'Notes'}
                                            </label>
                                            <input
                                                type="text"
                                                value={replacementNotes}
                                                onChange={(e) => setReplacementNotes(e.target.value)}
                                                placeholder={
                                                    isThaiLanguage ? 'เช่น ต้องการคนที่มีประสบการณ์' : 'e.g., Need experienced workers'
                                                }
                                                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div className="mt-6">
                                <label className="text-sm text-gray-700 block mb-1">
                                    {isThaiLanguage ? 'หมายเหตุเพิ่มเติม' : 'Additional Notes'}
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder={
                                        isThaiLanguage ? 'หมายเหตุสำหรับวันนี้...' : 'Notes for today...'
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-2xl">
                    <div className="text-sm text-gray-500">
                        {existingAttendance ? (
                            <span className="text-amber-600">
                                {isThaiLanguage ? '⚠️ ส่งแล้ว - กำลังแก้ไข' : '⚠️ Already submitted - editing'}
                            </span>
                        ) : (
                            <span>
                                {isThaiLanguage
                                    ? `${employees.length} พนักงาน • ${requiredCount} ที่ต้องการ`
                                    : `${employees.length} employees • ${requiredCount} required`}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {isThaiLanguage ? 'ยกเลิก' : 'Cancel'}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || loading}
                            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {submitting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {isThaiLanguage ? 'ส่งรายชื่อ' : 'Submit'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AttendanceFormModal;
