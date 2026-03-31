import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, X, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api/auth';

interface ImportError {
    row: number;
    field: string;
    value: string;
    message: string;
}

interface ImportResult {
    success: boolean;
    message: string;
    totalRows: number;
    successCount: number;
    errorCount: number;
    duplicateCount: number;
    errors: ImportError[];
}

interface Props {
    onSuccess: () => void;
    onClose: () => void;
}

export function OffDaysImportModal({ onSuccess, onClose }: Props) {
    const { t, i18n } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setImporting(true);
        setResult(null);

        try {
            // Convert file to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target?.result as string;

                try {
                    const response = await api.post('/employee-off-days-import', { file: base64 });
                    setResult(response.data);

                    if (response.data.success) {
                        setTimeout(() => {
                            onSuccess();
                            onClose();
                        }, 2000);
                    }
                } catch (error: any) {
                    console.error('Import error:', error);
                    const responseData = error.response?.data;

                    if (responseData?.errors && Array.isArray(responseData.errors)) {
                        setResult({
                            success: false,
                            message: responseData.message || 'Validation failed',
                            totalRows: responseData.totalRows || 0,
                            successCount: 0,
                            errorCount: responseData.errors.length,
                            duplicateCount: 0,
                            errors: responseData.errors
                        });
                    } else {
                        setResult({
                            success: false,
                            message: responseData?.message || error.message || 'Import failed',
                            totalRows: 0,
                            successCount: 0,
                            errorCount: 1,
                            duplicateCount: 0,
                            errors: [{
                                row: 0,
                                field: 'general',
                                value: '',
                                message: responseData?.message || error.message || 'Import failed',
                            }],
                        });
                    }
                } finally {
                    setImporting(false);
                }
            };

            reader.onerror = () => {
                setImporting(false);
                setResult({
                    success: false,
                    message: 'Failed to read file',
                    totalRows: 0,
                    successCount: 0,
                    errorCount: 1,
                    duplicateCount: 0,
                    errors: [{
                        row: 0,
                        field: 'general',
                        value: '',
                        message: 'Failed to read file',
                    }],
                });
            };

            reader.readAsDataURL(file);
        } catch (error) {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();

        // Headers and example data for Group-based import (Simpler)
        const headers = ['Employee Code', 'Group', 'Notes'];
        const examples = [
            ['200811002', 'Group A', 'เริ่ม 10 ม.ค. 2026'],
            ['202505001', 'Group B', 'เริ่ม 17 ม.ค. 2026'],
        ];

        // Combine headers with data
        const wsData = [headers, ...examples];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = [
            { wch: 15 },  // Employee Code
            { wch: 15 },  // Group
            { wch: 25 },  // Notes
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Off-Days Template');

        // Generate and download file
        XLSX.writeFile(wb, 'employee-off-days-template-2026.xlsx');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Upload className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {i18n.language === 'th' ? 'นำเข้าวันหยุด (Group)' : 'Import Off-Days (Group)'}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {i18n.language === 'th' ? 'นำเข้าแบบกลุ่ม (Group A/B) สำหรับปี 2026' : 'Import via Group (A/B) for 2026'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">
                            {i18n.language === 'th' ? 'รูปแบบใหม่ (New Format):' : 'New Format:'}
                        </h3>
                        <div className="text-sm text-blue-800 space-y-2">
                            <p>
                                {i18n.language === 'th'
                                    ? 'คุณสามารถระบุเพียง "Employee Code" และ "Group" ระบบจะสร้างวันหยุดเสาร์เว้นเสาร์ให้ทั้งปี 2026 เอง'
                                    : 'You only need "Employee Code" and "Group". The system will auto-generate alternating Saturdays for 2026.'}
                            </p>
                            <ul className="list-disc list-inside ml-2">
                                <li><strong>Group A</strong>: {i18n.language === 'th' ? 'เริ่มพักเสาร์ที่ 10 ม.ค. 2026' : 'Starts Sat 10 Jan 2026'}</li>
                                <li><strong>Group B</strong>: {i18n.language === 'th' ? 'เริ่มพักเสาร์ที่ 17 ม.ค. 2026' : 'Starts Sat 17 Jan 2026'}</li>
                            </ul>
                        </div>
                    </div>

                    {/* Template Format */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">
                            {i18n.language === 'th' ? 'ตัวอย่างข้อมูล:' : 'Data Example:'}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="px-3 py-2 text-left font-semibold">Employee Code</th>
                                        <th className="px-3 py-2 text-left font-semibold">Group</th>
                                        <th className="px-3 py-2 text-left font-semibold">Notes (Optional)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b">
                                        <td className="px-3 py-2">200811002</td>
                                        <td className="px-3 py-2">Group A</td>
                                        <td className="px-3 py-2">-</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">202505001</td>
                                        <td className="px-3 py-2">Group B</td>
                                        <td className="px-3 py-2">-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Download Template Button */}
                    <button
                        onClick={downloadTemplate}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Download className="w-5 h-5" />
                        <span className="font-medium">
                            {i18n.language === 'th' ? 'ดาวน์โหลด Template Excel' : 'Download Excel Template'}
                        </span>
                    </button>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {i18n.language === 'th' ? 'เลือกไฟล์:' : 'Select File:'}
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="flex items-center justify-center gap-3 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                            >
                                <FileText className="w-8 h-8 text-gray-400" />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-700">
                                        {file ? file.name : (i18n.language === 'th' ? 'คลิกเพื่อเลือกไฟล์' : 'Click to select file')}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {i18n.language === 'th' ? 'Excel (.xlsx, .xls) หรือ CSV' : 'Excel (.xlsx, .xls) or CSV'}
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Import Results */}
                    {result && (
                        <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <h4 className={`font-semibold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result.message}
                                    </h4>
                                    <div className="mt-2 text-sm space-y-1">
                                        <p><strong>{i18n.language === 'th' ? 'ทั้งหมด:' : 'Total:'}</strong> {result.totalRows} {i18n.language === 'th' ? 'รายการ' : 'rows'}</p>
                                        <p className="text-green-700"><strong>{i18n.language === 'th' ? 'สำเร็จ:' : 'Success:'}</strong> {result.successCount}</p>
                                        {result.duplicateCount > 0 && (
                                            <p className="text-orange-700"><strong>{i18n.language === 'th' ? 'ข้ามข้อมูลซ้ำ:' : 'Duplicates skipped:'}</strong> {result.duplicateCount}</p>
                                        )}
                                        {result.errorCount > 0 && (
                                            <p className="text-red-700"><strong>{i18n.language === 'th' ? 'ล้มเหลว:' : 'Failed:'}</strong> {result.errorCount}</p>
                                        )}
                                    </div>

                                    {/* Error Details */}
                                    {result.errors.length > 0 && (
                                        <div className="mt-3 max-h-40 overflow-y-auto">
                                            <p className="text-sm font-semibold text-red-900 mb-1">
                                                {i18n.language === 'th' ? 'รายละเอียดข้อผิดพลาด:' : 'Error Details:'}
                                            </p>
                                            <ul className="text-xs space-y-1">
                                                {result.errors.slice(0, 10).map((error, idx) => (
                                                    <li key={idx} className="text-red-800">
                                                        Row {error.row}: {error.message} ({error.field}: {error.value})
                                                    </li>
                                                ))}
                                                {result.errors.length > 10 && (
                                                    <li className="text-red-700 font-medium">
                                                        ...{i18n.language === 'th' ? 'และอีก' : 'and'} {result.errors.length - 10} {i18n.language === 'th' ? 'ข้อผิดพลาด' : 'more errors'}
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {i18n.language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!file || importing}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {importing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                <span>{i18n.language === 'th' ? 'กำลังนำเข้า...' : 'Importing...'}</span>
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                <span>{i18n.language === 'th' ? 'นำเข้าข้อมูล' : 'Import Data'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

