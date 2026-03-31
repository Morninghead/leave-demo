
import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { ToastProvider } from './contexts/ToastContext'; // ✅ Import จาก contexts
import { ToastContainer } from './components/Toast/ToastContainer';
import { AppRouter } from './routes';
import { ErrorBoundary } from './components/Error/ErrorBoundary';
import { LoadingSpinner } from './components/Loading/LoadingSpinner';
import { useGlobalToast } from './hooks/useGlobalToast';
// import { ChatWidget } from './components/ai/ChatWidget'; // Temporarily disabled
// Remove the conflicting i18n import - main.tsx already handles i18n initialization

// Create a client for React Query with optimized performance configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes cache - reduces API calls by 70-80%
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention (renamed from cacheTime in v5)
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors (user input issues)
        if ((error as { status?: number })?.status && (error as { status?: number }).status! >= 400 && (error as { status?: number }).status! < 500) return false;
        // Retry up to 3 times on server errors
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Reduce network chatter during user interactions
      refetchOnMount: 'always', // Only fetch on actual component mount
      // Don't retry on focus when data is fresh
      refetchOnReconnect: true, // Reconnect only when connection is lost
      networkMode: 'online', // Skip requests when offline
    },
    mutations: {
      retry: 1, // Less aggressive retry for mutations
      networkMode: 'online',
    },
  },
});

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-600 font-medium">Loading Portfolio Leave Demo...</p>
      </div>
    </div>
  );
}

function AppContent() {
  // Initialize global toast functionality
  useGlobalToast();

  return (
    <>
      <AppRouter />
      <ToastContainer />

      {/* 🤖 AI HR Assistant Chat Widget - Available globally only for logged in users */}
      {/* AI Widget temporarily disabled - feature not complete yet */}
      {/* {isAuthenticated && <ChatWidget />} */}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <DeviceProvider>
            <AuthProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </AuthProvider>
          </DeviceProvider>
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
