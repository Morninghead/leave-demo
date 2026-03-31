import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
} from 'lucide-react';
import api from '../api/auth';
import { DatePicker } from '../components/common/DatePicker';

interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_name_en: string;
  user_name_th: string;
  employee_code: string;
  action: string;
  resource_type: string;
  resource_id: string;
  before_value: any;
  after_value: any;
  ip_address: string;
  user_agent: string;
  metadata: any;
  created_at: string;
}

export function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    start_date: '',
    end_date: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    loadLogs();
  }, [pagination.offset]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(pagination.offset),
        ...(filters.action && { action: filters.action }),
        ...(filters.resource_type && { resource_type: filters.resource_type }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
      });

      const response = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-800',
      UPDATE: 'bg-blue-100 text-blue-800',
      DELETE: 'bg-red-100 text-red-800',
      APPROVE: 'bg-emerald-100 text-emerald-800',
      REJECT: 'bg-orange-100 text-orange-800',
      LOGIN: 'bg-purple-100 text-purple-800',
      LOGOUT: 'bg-gray-100 text-gray-800',
      EXPORT: 'bg-yellow-100 text-yellow-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-sm text-gray-600">
              Security and compliance audit trail
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource Type
              </label>
              <select
                value={filters.resource_type}
                onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Resources</option>
                <option value="employee">Employee</option>
                <option value="leave_request">Leave Request</option>
                <option value="leave_balance">Leave Balance</option>
                <option value="company_settings">Settings</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <DatePicker
                value={filters.start_date ? new Date(filters.start_date) : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setFilters({ ...filters, start_date: `${year}-${month}-${day}` });
                  } else {
                    setFilters({ ...filters, start_date: '' });
                  }
                }}
                placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DatePicker
                value={filters.end_date ? new Date(filters.end_date) : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setFilters({ ...filters, end_date: `${year}-${month}-${day}` });
                  } else {
                    setFilters({ ...filters, end_date: '' });
                  }
                }}
                placeholder={i18n.language === 'th' ? 'วว/ดด/ปปปป' : 'DD/MM/YYYY'}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                setPagination({ ...pagination, offset: 0 });
                loadLogs();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              onClick={() => {
                setFilters({ action: '', resource_type: '', start_date: '', end_date: '' });
                setPagination({ ...pagination, offset: 0 });
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <p className="text-sm text-gray-600">
          Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} audit logs
        </p>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.employee_code || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.user_email || 'No email'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.resource_type}</div>
                        <div className="text-sm text-gray-500 font-mono">
                          {log.resource_id ? `${log.resource_id.substring(0, 8)}...` : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ip_address || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {expandedLog === log.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            {log.metadata && (
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">Metadata:</h4>
                                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.before_value && (
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">Before:</h4>
                                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                  {JSON.stringify(log.before_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.after_value && (
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">After:</h4>
                                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                  {JSON.stringify(log.after_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.user_agent && (
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">User Agent:</h4>
                                <p className="text-xs text-gray-600">{log.user_agent}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
              disabled={pagination.offset === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
              disabled={!pagination.hasMore}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
