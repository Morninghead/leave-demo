import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home, FileText } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  showHomeButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Comprehensive Error Boundary for Reports
 * Catches React errors and provides user-friendly recovery options
 */
export class ReportErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TODO: Log error to error tracking service (e.g., Sentry, LogRocket)
    this.setState({
      error,
      errorInfo,
    });

    // Log to console in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('Report Error Boundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleGoReports = () => {
    window.location.href = '/reports';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const { fallbackTitle = 'Report Error', showHomeButton = true } = this.props;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 rounded-full p-4">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
              {fallbackTitle}
            </h1>

            {/* Error Message */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 font-medium mb-2">
                Error Details:
              </p>
              <p className="text-sm text-red-700 font-mono break-words">
                {error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            {/* User-friendly explanation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>What happened?</strong>
              </p>
              <p className="text-sm text-blue-700 mt-2">
                The report encountered an unexpected error and couldn't load properly.
                This could be due to:
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>Network connectivity issues</li>
                <li>Invalid or corrupted data</li>
                <li>Temporary server problems</li>
                <li>Browser compatibility issues</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCcw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                <RefreshCcw className="w-4 h-4" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoReports}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                <FileText className="w-4 h-4" />
                All Reports
              </button>

              {showHomeButton && (
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              )}
            </div>

            {/* Technical Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && errorInfo && (
              <details className="mt-8">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Technical Details (Development Only)
                </summary>
                <div className="mt-4 bg-gray-100 rounded-lg p-4 overflow-auto max-h-64">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                If this problem persists, please contact{' '}
                <a href="mailto:support@ssth.com" className="text-blue-600 hover:underline">
                  IT Support
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
