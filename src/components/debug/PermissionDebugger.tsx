// src/components/debug/PermissionDebugger.tsx
/**
 * Development-only component to test and visualize user permissions
 */

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { logCurrentUserMenuAccess, testAllUserTypes, generatePermissionReport } from '../../utils/permissionTest';
import { Eye, EyeOff, Users, Settings, FileText } from 'lucide-react';

export function PermissionDebugger() {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleTestCurrentUser = () => {
    logCurrentUserMenuAccess(user);
  };

  const handleTestAllUsers = () => {
    const allTests = testAllUserTypes();
    console.log('🔍 All User Types Permission Test:', allTests);

    // Generate and download report
    const report = generatePermissionReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permission-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-sm max-w-xs">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-yellow-600" />
          <span className="text-yellow-800">No user logged in for permission testing</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-lg border border-gray-700 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          <span className="font-semibold text-sm">Permission Debugger</span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-400 hover:text-white"
        >
          {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400">User:</span>
          <span>{user.employee_code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Role:</span>
          <span>{user.role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Dept Admin:</span>
          <span>{user.is_department_admin ? '✅' : '❌'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Dept Manager:</span>
          <span>{user.is_department_manager ? '✅' : '❌'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">HR:</span>
          <span>{user.is_hr ? '✅' : '❌'}</span>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
          <button
            onClick={handleTestCurrentUser}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="w-3 h-3" />
            Test Current User
          </button>

          <button
            onClick={() => setShowAllUsers(!showAllUsers)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Users className="w-3 h-3" />
            Test All Users
          </button>

          {showAllUsers && (
            <div className="mt-2">
              <button
                onClick={handleTestAllUsers}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-3 h-3" />
                Download Report
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Report downloaded to Downloads folder
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Development tool only
        </p>
      </div>
    </div>
  );
}