// src/components/settings/SignatureSettings.tsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PenTool,
    Upload,
    Trash2,
    Save,
    RefreshCw,
    Check,
    X,
    Image
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { SignatureCanvas } from '../warning/SignatureCanvas';
import {
    getEmployeeSignature,
    uploadEmployeeSignature,
    deleteEmployeeSignature
} from '../../api/employee';

export function SignatureSettings() {
    const { t, i18n } = useTranslation();
    const { showToast, showModal } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);
    const [uploadedAt, setUploadedAt] = useState<string | null>(null);
    const [mode, setMode] = useState<'view' | 'draw' | 'upload'>('view');
    const [newSignature, setNewSignature] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isThaiLang = i18n.language === 'th';

    useEffect(() => {
        loadSignature();
    }, []);

    const loadSignature = async () => {
        try {
            setLoading(true);
            const data = await getEmployeeSignature();
            setCurrentSignature(data.signature_image);
            setUploadedAt(data.signature_uploaded_at);
        } catch (error: any) {
            console.error('Failed to load signature:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast(
                isThaiLang ? 'กรุณาเลือกไฟล์รูปภาพ' : 'Please select an image file',
                'error'
            );
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast(
                isThaiLang ? 'ไฟล์ต้องมีขนาดไม่เกิน 2MB' : 'File size must be under 2MB',
                'error'
            );
            return;
        }

        // Read file as base64
        const reader = new FileReader();
        reader.onload = (event) => {
            setNewSignature(event.target?.result as string);
            setMode('upload');
        };
        reader.readAsDataURL(file);
    };

    const handleSaveSignature = async () => {
        if (!newSignature) return;

        try {
            setSaving(true);
            const result = await uploadEmployeeSignature(newSignature);
            setCurrentSignature(result.signature_image);
            setUploadedAt(result.signature_uploaded_at);
            setNewSignature(null);
            setMode('view');
            showToast(
                isThaiLang ? 'บันทึกลายเซ็นสำเร็จ' : 'Signature saved successfully',
                'success'
            );
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSignature = async () => {
        const confirmed = await showModal('confirm', isThaiLang ? 'ยืนยันการลบ' : 'Delete Confirmation', {
            message: isThaiLang ? 'ต้องการลบลายเซ็นหรือไม่?' : 'Delete signature?',
            confirmText: isThaiLang ? 'ลบ' : 'Delete',
            cancelText: t('common.cancel'),
        });

        if (!confirmed) {
            return;
        }

        try {
            setSaving(true);
            await deleteEmployeeSignature();
            setCurrentSignature(null);
            setUploadedAt(null);
            showToast(
                isThaiLang ? 'ลบลายเซ็นสำเร็จ' : 'Signature deleted successfully',
                'success'
            );
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setNewSignature(null);
        setMode('view');
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString(isThaiLang ? 'th-TH' : 'en-US');
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl">
                    <PenTool className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {isThaiLang ? 'ลายเซ็นอิเล็กทรอนิกส์' : 'Electronic Signature'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isThaiLang
                            ? 'ลายเซ็นนี้จะใช้ในเอกสารทางการ เช่น ใบเตือน'
                            : 'This signature will be used in official documents like warnings'}
                    </p>
                </div>
            </div>

            {/* Current Signature Display */}
            {mode === 'view' && (
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 bg-gray-50 dark:bg-gray-700">
                        {currentSignature ? (
                            <div className="text-center">
                                <img
                                    src={currentSignature}
                                    alt="Current Signature"
                                    className="max-h-32 mx-auto object-contain mb-4"
                                />
                                {uploadedAt && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {isThaiLang ? 'อัปเดตเมื่อ: ' : 'Updated: '}
                                        {formatDate(uploadedAt)}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <PenTool className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">
                                    {isThaiLang ? 'ยังไม่มีลายเซ็น' : 'No signature yet'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setMode('draw')}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                        >
                            <PenTool className="w-5 h-5" />
                            {isThaiLang ? 'เซ็นด้วยมือ' : 'Draw Signature'}
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-medium transition-colors"
                        >
                            <Upload className="w-5 h-5" />
                            {isThaiLang ? 'อัปโหลด PNG' : 'Upload PNG'}
                        </button>
                        {currentSignature && (
                            <button
                                onClick={handleDeleteSignature}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="w-5 h-5" />
                                {isThaiLang ? 'ลบ' : 'Delete'}
                            </button>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
            )}

            {/* Draw Mode */}
            {mode === 'draw' && (
                <div className="space-y-4">
                    <div className="border-2 border-blue-300 dark:border-blue-600 rounded-xl overflow-hidden bg-white" style={{ height: '200px' }}>
                        <SignatureCanvas
                            value={null}
                            onChange={(data) => setNewSignature(data)}
                            fullHeight={true}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveSignature}
                            disabled={!newSignature || saving}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {isThaiLang ? 'บันทึกลายเซ็น' : 'Save Signature'}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-medium transition-colors"
                        >
                            <X className="w-5 h-5" />
                            {isThaiLang ? 'ยกเลิก' : 'Cancel'}
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Preview */}
            {mode === 'upload' && newSignature && (
                <div className="space-y-4">
                    <div className="border-2 border-blue-300 dark:border-blue-600 rounded-xl p-6 bg-white dark:bg-gray-700">
                        <img
                            src={newSignature}
                            alt="New Signature Preview"
                            className="max-h-32 mx-auto object-contain"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveSignature}
                            disabled={saving}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <Check className="w-5 h-5" />
                            )}
                            {isThaiLang ? 'ยืนยันการอัปโหลด' : 'Confirm Upload'}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-medium transition-colors"
                        >
                            <X className="w-5 h-5" />
                            {isThaiLang ? 'ยกเลิก' : 'Cancel'}
                        </button>
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex gap-2">
                    <Image className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">
                            {isThaiLang ? 'คำแนะนำ' : 'Tips'}
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                            <li>{isThaiLang ? 'เซ็นด้วยมือบนมือถือ/แท็บเล็ตจะได้ลายเซ็นที่ชัดเจน' : 'Sign on mobile/tablet for best results'}</li>
                            <li>{isThaiLang ? 'ไฟล์ PNG ควรมีพื้นหลังโปร่งใส' : 'PNG files should have transparent background'}</li>
                            <li>{isThaiLang ? 'ลายเซ็นจะถูกใช้อัตโนมัติเมื่อออกใบเตือน' : 'Signature will be used automatically when issuing warnings'}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

