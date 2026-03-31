import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import api from '../api/auth';

export function MigrateWarningSystemPage() {
  const { user } = useAuth();
  const { showToast, showModal } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'not-migrated' | 'migrated' | 'migrating' | 'error'>('checking');
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkMigrationStatus = async () => {
    setStatus('checking');
    try {
      const response = await api.get('/migrate-warning-system');
      if (response.data.success) {
        setStatus(response.data.migrated ? 'migrated' : 'not-migrated');
        setMigrationResult(response.data);
      }
    } catch (error: any) {
      console.error('Check status error:', error);
      setError(error.response?.data?.message || 'Failed to check migration status');
      setStatus('error');
    }
  };

  useEffect(() => {
    // Allow admin and hr to access this page
    if (!user || !['admin', 'hr'].includes(user.role)) {
      showToast('Only administrators and HR can access migration page', 'error');
      navigate('/');
      return;
    }

    checkMigrationStatus();
  }, [user, navigate, showToast]);

  const runMigration = async () => {
    const confirmed = await showModal('confirm', 'Confirm Migration', {
      message: 'คุณแน่ใจหรือไม่ว่าต้องการรัน migration? \n\nAre you sure you want to run the migration?',
      confirmText: 'Run Migration',
      cancelText: 'Cancel'
    });

    if (!confirmed) {
      return;
    }

    setStatus('migrating');
    setError(null);

    try {
      const response = await api.post('/migrate-warning-system');
      if (response.data.success) {
        setMigrationResult(response.data);
        setStatus('migrated');
        showToast('Migration completed successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      const errorMsg = error.response?.data?.message || 'Migration failed';
      setError(errorMsg);
      setStatus('error');
      showToast(errorMsg, 'error');
    }
  };

  if (!user || !['admin', 'hr'].includes(user.role)) {
    return null;
  }



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 text-white">
            <div className="flex items-center gap-4">
              <Database className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Warning System Migration</h1>
                <p className="text-blue-100 mt-1">
                  Database setup for Electronic Warning Notice System
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Banner */}
            {status === 'checking' && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-blue-900 dark:text-blue-100">Checking migration status...</span>
              </div>
            )}

            {status === 'migrated' && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-900 dark:text-green-100 font-medium">
                  ✅ Warning system is already migrated
                </span>
              </div>
            )}

            {status === 'not-migrated' && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-900 dark:text-yellow-100 font-medium">
                  ⚠️  Warning system is not yet migrated
                </span>
              </div>
            )}

            {status === 'migrating' && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-blue-900 dark:text-blue-100 font-medium">
                  🚀 Running migration... Please wait...
                </span>
              </div>
            )}

            {status === 'error' && error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-900 dark:text-red-100 font-medium">Migration Error</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Migration Details */}
            {migrationResult && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Migration Details</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {migrationResult.tables_created && (
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Tables Created</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">{migrationResult.tables_created}</dd>
                    </div>
                  )}
                  {migrationResult.indexes_created && (
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Indexes Created</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">{migrationResult.indexes_created}</dd>
                    </div>
                  )}
                  {migrationResult.default_settings && (
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Default Settings</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">{migrationResult.default_settings}</dd>
                    </div>
                  )}
                  {migrationResult.offense_types && (
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Offense Types</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">{migrationResult.offense_types}</dd>
                    </div>
                  )}
                  {migrationResult.settings_count !== undefined && (
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Settings Count</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">{migrationResult.settings_count}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* What will be created */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                📋 What will be created:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>✅ 7 Database Tables (warning_notices, acknowledgements, appeals, witnesses, audit_logs, settings, offense_types)</li>
                <li>✅ 15 Performance Indexes</li>
                <li>✅ 8 Default Settings (enable/disable, appeal days, scroll %, etc.)</li>
                <li>✅ 10 Offense Types (Late, Absent, Insubordination, etc.)</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={checkMigrationStatus}
                disabled={status === 'checking' || status === 'migrating'}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Refresh Status
              </button>

              {status === 'not-migrated' && (
                <button
                  onClick={runMigration}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Database className="w-5 h-5" />
                  Run Migration Now
                </button>
              )}

              {status === 'error' && (
                <button
                  onClick={runMigration}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  🔄 Retry Migration
                </button>
              )}

              {status === 'migrated' && (
                <button
                  onClick={() => navigate('/settings')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Go to Settings
                </button>
              )}
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️  Important:</strong> This migration should only be run once. If tables already exist, the migration will fail to prevent data loss.
              </p>
            </div>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-6 text-center">
          <a
            href="/WARNING-SYSTEM-IMPLEMENTATION.md"
            target="_blank"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            📖 View Full Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

