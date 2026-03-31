import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy, type ReactNode } from 'react';
import { LoadingSpinner } from '../components/Loading/LoadingSpinner';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import { ReportErrorBoundary } from '../components/Error/ReportErrorBoundary';

const safeLazy = (importFunc: () => Promise<any>, componentName?: string, exportName?: string) => {
  return lazy(() =>
    importFunc()
      .then(module => {
        const targetExport = exportName || componentName;
        if (module[targetExport]) {
          return { default: module[targetExport] };
        }

        if (module.default) {
          return { default: module.default };
        }

        console.error(`Component "${componentName}" not found. Available exports:`, Object.keys(module));
        return {
          default: () => (
            <div className="p-4 text-center text-red-600">
              <h3>Component Loading Error</h3>
              <p>Component "{componentName}" not found in module</p>
              <p>Available: {Object.keys(module).join(', ')}</p>
            </div>
          ),
        };
      })
      .catch(error => {
        console.error(`Failed to load component "${componentName}":`, error);
        return {
          default: () => (
            <div className="p-4 text-center text-red-600">
              <h3>Failed to load component</h3>
              <p>{componentName ? `"${componentName}" could not be loaded` : 'A component could not be loaded'}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded bg-blue-500 px-4 py-2 text-white"
              >
                Refresh Page
              </button>
            </div>
          ),
        };
      })
  );
};

const LoginPage = safeLazy(() => import('../pages/LoginPage'), 'LoginPage');
const DashboardPage = safeLazy(() => import('../pages/DashboardPage'), 'DashboardPage');
const LeavePage = safeLazy(() => import('../pages/LeavePage'), 'LeavePage');
const HourlyLeaveRequestForm = safeLazy(() => import('../components/leave/HourlyLeaveRequestForm'), 'HourlyLeaveRequestForm');
const UnifiedApprovalDashboard = safeLazy(() => import('../components/approval/UnifiedApprovalDashboard'), 'UnifiedApprovalDashboard');
const ReportsHub = safeLazy(() => import('../pages/ReportsHub'), 'ReportsHub');
const LeaveBalanceReportPage = safeLazy(() => import('../pages/reports/LeaveBalanceReportPage'), 'LeaveBalanceReportPage');
const ExecutiveDashboard = safeLazy(() => import('../pages/reports/ExecutiveDashboard'), 'ExecutiveDashboard');
const DepartmentAnalyticsPage = safeLazy(
  () => import('../pages/reports/DepartmentAnalyticsPage'),
  'DepartmentAnalyticsPage'
);
const ProbationEvaluationsPage = safeLazy(() => import('../pages/ProbationEvaluationsPage'), 'ProbationEvaluationsPage');
const ProbationEvaluationFormPage = safeLazy(
  () => import('../pages/ProbationEvaluationFormPage'),
  'ProbationEvaluationFormPage'
);

const RouteLoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <LoadingSpinner size="large" />
      <p className="mt-4 font-medium text-gray-600">Loading...</p>
    </div>
  </div>
);

const AppShell = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <MainLayout>{children}</MainLayout>
  </Suspense>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LoginPage />
            </Suspense>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <AppShell>
                <LeavePage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leave/hourly"
          element={
            <ProtectedRoute>
              <AppShell>
                <HourlyLeaveRequestForm />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/approval"
          element={
            <ProtectedRoute requireRole={['manager', 'hr', 'admin']}>
              <AppShell>
                <UnifiedApprovalDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/probation-evaluations"
          element={
            <ProtectedRoute requireRole={['leader', 'manager', 'hr', 'admin', 'dev']}>
              <AppShell>
                <ProbationEvaluationsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/probation-evaluations/:evaluationId"
          element={
            <ProtectedRoute requireRole={['employee', 'leader', 'manager', 'hr', 'admin', 'dev']}>
              <AppShell>
                <ProbationEvaluationFormPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute requireRole={['manager', 'hr', 'admin', 'dev']}>
              <AppShell>
                <ReportErrorBoundary fallbackTitle="Reports Hub Error">
                  <ReportsHub />
                </ReportErrorBoundary>
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/leave-balance"
          element={
            <ProtectedRoute requireRole={['manager', 'hr', 'admin', 'dev']}>
              <AppShell>
                <ReportErrorBoundary fallbackTitle="Leave Balance Report Error">
                  <LeaveBalanceReportPage />
                </ReportErrorBoundary>
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/executive-dashboard"
          element={
            <ProtectedRoute requireRole={['manager', 'hr', 'admin', 'dev']}>
              <AppShell>
                <ReportErrorBoundary fallbackTitle="Executive Dashboard Error">
                  <ExecutiveDashboard />
                </ReportErrorBoundary>
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/department-analytics"
          element={
            <ProtectedRoute requireRole={['manager', 'hr', 'admin', 'dev']}>
              <AppShell>
                <ReportErrorBoundary fallbackTitle="Department Analytics Error">
                  <DepartmentAnalyticsPage />
                </ReportErrorBoundary>
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
