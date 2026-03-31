// src/hooks/useManagerWarningCheck.ts
import { useState, useEffect } from 'react';
import api from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

export interface ManagerPendingWarning {
    id: string;
    notice_number: string;
    warning_type: string;
    incident_date: string;
    incident_description: string;
    incident_location?: string;
    penalty_description: string;
    effective_date: string;
    status: string;
    attachments_urls?: string[];
    suspension_days?: number;
    suspension_start_date?: string;
    suspension_end_date?: string;
    manager_acknowledged: boolean;
    created_at: string;
    // Employee info (the warned employee)
    employee_id: string;
    employee_code: string;
    employee_first_name_th: string;
    employee_last_name_th: string;
    employee_first_name_en: string;
    employee_last_name_en: string;
    employee_position_th?: string;
    employee_position_en?: string;
    // Issuer info
    issuer_first_name_th: string;
    issuer_last_name_th: string;
    issuer_first_name_en: string;
    issuer_last_name_en: string;
    issuer_position_th?: string;
    issuer_position_en?: string;
    // Offense info
    offense_name_th?: string;
    offense_name_en?: string;
    severity_level?: number;
    // Witnesses
    witnesses?: {
        witness_name: string;
        witness_position: string;
        statement: string;
    }[];
}

/**
 * Hook to check for pending warnings that require manager acknowledgement
 * Returns warnings for employees in manager's department that manager hasn't acknowledged yet
 */
export function useManagerWarningCheck() {
    const { user, isAuthenticated } = useAuth();
    const [pendingWarning, setPendingWarning] = useState<ManagerPendingWarning | null>(null);
    const [allPendingWarnings, setAllPendingWarnings] = useState<ManagerPendingWarning[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const isManager = user?.is_department_manager || user?.is_department_admin || user?.role === 'manager';

    const checkPendingWarnings = async () => {
        if (!isAuthenticated || !user || !isManager) return;

        setLoading(true);
        try {
            const response = await api.get('/warning-manager-pending');

            if (response.data.success && response.data.data?.length > 0) {
                const warnings = response.data.data;
                setAllPendingWarnings(warnings);
                setPendingWarning(warnings[0]); // Show first pending warning
                setShowModal(true);
            } else {
                setAllPendingWarnings([]);
                setPendingWarning(null);
            }
        } catch (error) {
            console.error('Failed to check manager pending warnings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isManager) {
            // Small delay to avoid conflicting with employee warning check
            // But show manager warnings quickly after login
            const timer = setTimeout(() => {
                checkPendingWarnings();
            }, 500); // 500ms delay (was 2 seconds)

            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, user?.id, isManager]);

    const handleAcknowledged = () => {
        setShowModal(false);
        setPendingWarning(null);
        // Re-check for more pending warnings
        setTimeout(() => {
            checkPendingWarnings();
        }, 500);
    };

    const handleDismiss = () => {
        setShowModal(false);
    };

    const handleSkipToNext = () => {
        if (allPendingWarnings.length > 1) {
            // Move current to end and show next
            const remaining = allPendingWarnings.slice(1);
            setAllPendingWarnings(remaining);
            setPendingWarning(remaining[0] || null);
        } else {
            setShowModal(false);
            setPendingWarning(null);
        }
    };

    return {
        pendingWarning,
        allPendingWarnings,
        pendingCount: allPendingWarnings.length,
        showModal,
        loading,
        isManager,
        handleAcknowledged,
        handleDismiss,
        handleSkipToNext,
        recheckWarnings: checkPendingWarnings,
    };
}
