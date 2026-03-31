import { logger } from '../utils/logger';

export interface ImportResult {
    success: boolean;
    message: string;
    totalRows: number;
    successCount: number;
    errorCount: number;
    errors: any[];
}

export const downloadSubcontractTemplate = async (): Promise<void> => {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication required');

        const response = await fetch('/.netlify/functions/subcontract-template', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to download template');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subcontract_employee_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error: any) {
        logger.error('Download template error:', error);
        throw error;
    }
};

export const importSubcontractEmployees = async (file: File): Promise<ImportResult> => {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication required');

        // Read file as base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64File = await base64Promise;

        const response = await fetch('/.netlify/functions/subcontract-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ file: base64File })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Import failed');

        return data;
    } catch (error: any) {
        logger.error('Import error:', error);
        throw error;
    }
};
