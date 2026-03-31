// src/api/attendance.ts
// API functions for Daily Line Attendance System

import api from './auth';
import type {
    ManufacturingLine,
    ManufacturingLineFormData,
    SubcontractEmployee,
    SubcontractEmployeeFormData,
    LineAttendance,
    AttendanceSubmitFormData,
    AttendanceSummary,
    LineAttendanceStatus,
    ShiftType,
    LineCategory,
} from '../types/attendance';

// ============================================
// MANUFACTURING LINES API
// ============================================

/**
 * Get all manufacturing lines
 */
export async function getManufacturingLines(params?: {
    category?: LineCategory;
    active_only?: boolean;
}): Promise<ManufacturingLine[]> {
    const response = await api.get<{
        success: boolean;
        lines: ManufacturingLine[];
    }>('/manufacturing-lines', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch manufacturing lines');
    }

    return response.data.lines || [];
}

/**
 * Get a single manufacturing line by ID
 */
export async function getManufacturingLine(id: string): Promise<ManufacturingLine> {
    const response = await api.get<{
        success: boolean;
        line: ManufacturingLine;
    }>(`/manufacturing-lines/${id}`);

    if (!response.data.success) {
        throw new Error('Failed to fetch manufacturing line');
    }

    return response.data.line;
}

/**
 * Create a new manufacturing line
 */
export async function createManufacturingLine(data: ManufacturingLineFormData): Promise<ManufacturingLine> {
    const response = await api.post<{
        success: boolean;
        line: ManufacturingLine;
        message: string;
    }>('/manufacturing-lines', data);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create manufacturing line');
    }

    return response.data.line;
}

/**
 * Update a manufacturing line
 */
export async function updateManufacturingLine(
    id: string,
    data: Partial<ManufacturingLineFormData>
): Promise<ManufacturingLine> {
    const response = await api.put<{
        success: boolean;
        line: ManufacturingLine;
        message: string;
    }>(`/manufacturing-lines/${id}`, data);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update manufacturing line');
    }

    return response.data.line;
}

/**
 * Update headcount for multiple lines at once
 */
export async function bulkUpdateHeadcount(
    updates: {
        id: string;
        headcount_day?: number;
        headcount_night_ab?: number;
        headcount_night_cd?: number;
        line_leader_id?: string | null;
    }[]
): Promise<{ success: boolean; updated: number }> {
    const response = await api.put<{
        success: boolean;
        updated: number;
        message: string;
    }>('/manufacturing-lines/bulk-headcount', { updates });

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update headcount');
    }

    return response.data;
}

/**
 * Update line leader for multiple lines at once
 */
export async function bulkUpdateLineLeader(
    updates: {
        id: string;
        line_leader_id: string | null;
    }[]
): Promise<{ success: boolean; updated: number }> {
    // Actually, we can reuse bulk-headcount endpoint if backend supports it, 
    // but better to use a dedicated flow or reuse the same structure if the backend handles it.
    // Since I can't check backend code, I will assume I need to loop updateManufacturingLine on client
    // OR, I can pretend there is a bulk endpoint.
    // Given the constraints, I will implement this on the frontend side in the component using Promise.all
    // So this function is actually just a helper that calls updateManufacturingLine in parallel.

    // Wait, the user asked for a "page" design. I should put this logic in the component or here.
    // Putting it here is cleaner.

    try {
        await Promise.all(updates.map(update =>
            updateManufacturingLine(update.id, { line_leader_id: update.line_leader_id || '' })
        ));
        return { success: true, updated: updates.length };
    } catch (error) {
        throw new Error('Failed to update some lines');
    }
}

/**
 * Delete a manufacturing line
 */
export async function deleteManufacturingLine(id: string): Promise<void> {
    const response = await api.delete<{
        success: boolean;
        message: string;
    }>(`/manufacturing-lines/${id}`);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete manufacturing line');
    }
}

// ============================================
// SUBCONTRACT EMPLOYEES API
// ============================================

/**
 * Get all subcontract employees
 */
export async function getSubcontractEmployees(params?: {
    line_id?: string;
    shift?: ShiftType;
    company_name?: string;
    active_only?: boolean;
    search?: string;
}): Promise<SubcontractEmployee[]> {
    const response = await api.get<{
        success: boolean;
        employees: SubcontractEmployee[];
    }>('/subcontract-employees', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch subcontract employees');
    }

    return response.data.employees || [];
}

/**
 * Get a single subcontract employee
 */
export async function getSubcontractEmployee(id: string): Promise<SubcontractEmployee> {
    const response = await api.get<{
        success: boolean;
        employee: SubcontractEmployee;
    }>(`/subcontract-employees/${id}`);

    if (!response.data.success) {
        throw new Error('Failed to fetch subcontract employee');
    }

    return response.data.employee;
}

/**
 * Create a new subcontract employee
 */
export async function createSubcontractEmployee(
    data: SubcontractEmployeeFormData
): Promise<SubcontractEmployee> {
    const response = await api.post<{
        success: boolean;
        employee: SubcontractEmployee;
        message: string;
    }>('/subcontract-employees', data);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create subcontract employee');
    }

    return response.data.employee;
}

/**
 * Update a subcontract employee
 */
export async function updateSubcontractEmployee(
    id: string,
    data: Partial<SubcontractEmployeeFormData>
): Promise<SubcontractEmployee> {
    const response = await api.put<{
        success: boolean;
        employee: SubcontractEmployee;
        message: string;
    }>(`/subcontract-employees/${id}`, data);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update subcontract employee');
    }

    return response.data.employee;
}

/**
 * Deactivate (soft delete) a subcontract employee
 */
export async function deactivateSubcontractEmployee(id: string): Promise<void> {
    const response = await api.put<{
        success: boolean;
        message: string;
    }>(`/subcontract-employees/${id}/deactivate`);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to deactivate employee');
    }
}

/**
 * Get all unique company names for filtering
 */
export async function getSubcontractCompanies(): Promise<string[]> {
    const response = await api.get<{
        success: boolean;
        companies: string[];
    }>('/subcontract-employees/companies');

    if (!response.data.success) {
        throw new Error('Failed to fetch companies');
    }

    return response.data.companies || [];
}

// ============================================
// LINE ATTENDANCE API
// ============================================

/**
 * Get attendance summary for dashboard
 */
export async function getAttendanceSummary(params: {
    date: string;
    shift: ShiftType;
}): Promise<AttendanceSummary> {
    const response = await api.get<{
        success: boolean;
        summary: AttendanceSummary;
    }>('/line-attendance/summary', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch attendance summary');
    }

    return response.data.summary;
}

/**
 * Get attendance status for all lines on a specific date/shift
 */
export async function getLineAttendanceStatus(params: {
    date: string;
    shift: ShiftType;
    category?: LineCategory;
}): Promise<LineAttendanceStatus[]> {
    const response = await api.get<{
        success: boolean;
        lines: LineAttendanceStatus[];
    }>('/line-attendance/status', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch attendance status');
    }

    return response.data.lines || [];
}

/**
 * Get attendance record for a specific line/date/shift
 */
export async function getLineAttendance(params: {
    line_id: string;
    date: string;
    shift: ShiftType;
}): Promise<LineAttendance | null> {
    const response = await api.get<{
        success: boolean;
        attendance: LineAttendance | null;
    }>('/line-attendance', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch line attendance');
    }

    return response.data.attendance;
}

/**
 * Submit daily attendance for a line
 */
export async function submitLineAttendance(
    data: AttendanceSubmitFormData
): Promise<LineAttendance> {
    const response = await api.post<{
        success: boolean;
        attendance: LineAttendance;
        message: string;
        is_late: boolean;
    }>('/line-attendance/submit', data);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to submit attendance');
    }

    return response.data.attendance;
}

/**
 * Update an existing attendance record
 */
export async function updateLineAttendance(
    id: string,
    data: Partial<AttendanceSubmitFormData>
): Promise<LineAttendance> {
    const response = await api.put<{
        success: boolean;
        attendance: LineAttendance;
        message: string;
    }>(`/line-attendance/${id}`, data);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update attendance');
    }

    return response.data.attendance;
}

/**
 * Confirm an attendance record (HR/Admin only)
 */
export async function confirmLineAttendance(id: string): Promise<LineAttendance> {
    const response = await api.put<{
        success: boolean;
        attendance: LineAttendance;
        message: string;
    }>(`/line-attendance/${id}/confirm`);

    if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to confirm attendance');
    }

    return response.data.attendance;
}

/**
 * Get attendance history for reporting
 */
export async function getAttendanceHistory(params: {
    start_date: string;
    end_date: string;
    line_id?: string;
    shift?: ShiftType;
    category?: LineCategory;
}): Promise<LineAttendance[]> {
    const response = await api.get<{
        success: boolean;
        records: LineAttendance[];
    }>('/line-attendance/history', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch attendance history');
    }

    return response.data.records || [];
}

/**
 * Get employees available for a line/shift
 */
export async function getLineEmployees(params: {
    line_id: string;
    shift: ShiftType;
}): Promise<SubcontractEmployee[]> {
    const response = await api.get<{
        success: boolean;
        employees: SubcontractEmployee[];
    }>('/line-attendance/employees', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch line employees');
    }

    return response.data.employees || [];
}

/**
 * Get available replacement workers
 */
export async function getAvailableReplacements(params: {
    date: string;
    shift: ShiftType;
    exclude_line_id?: string;
}): Promise<SubcontractEmployee[]> {
    const response = await api.get<{
        success: boolean;
        employees: SubcontractEmployee[];
    }>('/line-attendance/replacements', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch available replacements');
    }

    return response.data.employees || [];
}

// ============================================
// REPORTS API
// ============================================

/**
 * Get attendance report data
 */
export async function getAttendanceReport(params: {
    start_date: string;
    end_date: string;
    group_by: 'day' | 'week' | 'month';
    category?: LineCategory;
}): Promise<{
    data: Array<{
        period: string;
        total_required: number;
        total_present: number;
        total_absent: number;
        attendance_rate: number;
        late_submissions: number;
    }>;
    summary: {
        avg_attendance_rate: number;
        total_late_submissions: number;
        best_line: { code: string; rate: number } | null;
        worst_line: { code: string; rate: number } | null;
    };
}> {
    const response = await api.get('/line-attendance/report', { params });

    if (!response.data.success) {
        throw new Error('Failed to fetch attendance report');
    }

    return response.data;
}
