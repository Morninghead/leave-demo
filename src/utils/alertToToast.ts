/**
 * Utility to replace alert() calls with toast notifications
 * This is a temporary helper to be used while migrating from alert() to toast
 */

// Store the toast function globally for non-React components
let globalToastFunction: ((message: string, type: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

export function setGlobalToast(toastFn: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void) {
  globalToastFunction = toastFn;
}

export function showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  if (globalToastFunction) {
    globalToastFunction(message, type);
  } else {
    // Fallback to alert if toast is not available
    console.warn('Toast function not set, falling back to alert');
    alert(message);
  }
}

export function showErrorAlert(message: string) {
  showAlert(message, 'error');
}

export function showSuccessAlert(message: string) {
  showAlert(message, 'success');
}

export function showWarningAlert(message: string) {
  showAlert(message, 'warning');
}

export function showInfoAlert(message: string) {
  showAlert(message, 'info');
}