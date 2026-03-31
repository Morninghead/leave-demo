import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole, checkPermission } from '../../utils/permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: UserRole[];
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Check permissions using centralized utility
  if (requireRole && requireRole.length > 0) {
    
    const permission = checkPermission(user, requireRole);

    if (!permission.allowed) {
      console.log('🚫 Access denied:', {
        userRole: user?.role,
        userPermissions: {
          is_department_admin: user?.is_department_admin,
          is_department_manager: user?.is_department_manager,
          is_hr: user?.is_hr
        },
        requiredRoles: requireRole,
        reason: permission.reason
      });

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-gray-600 mb-4">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
            {permission.reason && (
              <p className="text-sm text-gray-500 mb-4">{permission.reason}</p>
            )}
            <div className="space-y-2">
              <button
                onClick={() => window.history.back()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                กลับ
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full text-blue-600 hover:text-blue-700 text-sm"
              >
                ไปหน้าแรก
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
