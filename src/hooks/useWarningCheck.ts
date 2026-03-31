// src/hooks/useWarningCheck.ts
import { useState, useEffect } from 'react';
import api from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { WarningNotice } from '../types/warning';

/**
 * Hook to check for pending warnings that require acknowledgement
 * Returns the first pending warning and functions to manage the modal
 */
export function useWarningCheck() {
  const { user, isAuthenticated } = useAuth();
  const [pendingWarning, setPendingWarning] = useState<WarningNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const checkPendingWarnings = async () => {
    if (!isAuthenticated || !user) return;

    setLoading(true);
    try {
      // Use the dedicated pending API that returns all fields including attachments
      console.log('🔍 Checking pending warnings...');
      const response = await api.get('/warning-notice-pending');
      console.log('📋 Full API response:', response.data);

      if (response.data.success && response.data.hasPending && response.data.warning) {
        const warning = response.data.warning;
        // Debug: Check attachments
        console.log('📎 Warning attachments:', {
          id: warning.id,
          notice_number: warning.notice_number,
          attachments_urls: warning.attachments_urls,
          has_attachments: !!(warning.attachments_urls && warning.attachments_urls.length > 0)
        });
        setPendingWarning(warning);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Failed to check pending warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPendingWarnings();
  }, [isAuthenticated, user?.id]);

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

  return {
    pendingWarning,
    showModal,
    loading,
    handleAcknowledged,
    handleDismiss,
    recheckWarnings: checkPendingWarnings,
  };
}
