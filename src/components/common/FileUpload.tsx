import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from 'lucide-react';
import { uploadToSupabase, getFileTypeIcon, isImageFile, getFileNameFromUrl } from '../../utils/supabaseUpload';
import { useToast } from '../../hooks/useToast';

interface FileUploadProps {
  files: string[];
  onChange: (files: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  required?: boolean;
}

export function FileUpload({
  files,
  onChange,
  maxFiles = 5,
  maxSizeMB = 5,
  accept = 'image/*,.pdf,.doc,.docx',
  required = false,
}: FileUploadProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Check max files
    if (files.length + selectedFiles.length > maxFiles) {
      showToast(t('message.maxFilesExceeded', { max: maxFiles }), 'warning');
      return;
    }

    // Check file sizes
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    for (const file of Array.from(selectedFiles)) {
      if (file.size > maxSizeBytes) {
        showToast(`${file.name} ${t('message.fileTooLarge', { max: maxSizeMB })}`, 'warning');
        return;
      }
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileArray = Array.from(selectedFiles);
      const uploadPromises = fileArray.map(async (file, index) => {
        const url = await uploadToSupabase(file);
        setProgress(((index + 1) / fileArray.length) * 100);
        return url;
      });

      const urls = await Promise.all(uploadPromises);
      onChange([...files, ...urls]);
      showToast(t('message.uploadSuccess'), 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setUploading(false);
      setProgress(0);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('leave.attachments')}
        {required && <span className="text-red-600 ml-1">*</span>}
        <span className="text-xs text-gray-500 ml-2">
          (Max {maxFiles} files, {maxSizeMB}MB each)
        </span>
      </label>

      {/* Upload Button */}
      <div className="flex items-center gap-2">
        <label
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
            uploading || files.length >= maxFiles
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          <Upload className="w-5 h-5" />
          <span>{uploading ? `${Math.round(progress)}%` : t('common.upload')}</span>
          <input
            type="file"
            multiple
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading || files.length >= maxFiles}
            className="hidden"
          />
        </label>
        <span className="text-sm text-gray-600">
          ({files.length}/{maxFiles} {t('common.files')})
        </span>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((url, index) => {
            const fileName = getFileNameFromUrl(url);
            const isImage = isImageFile(url);
            const icon = getFileTypeIcon(url);

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isImage ? (
                    <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-200 shrink-0">
                      <img
                        src={url}
                        alt={fileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded text-2xl shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate block font-medium"
                    >
                      {fileName}
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      {isImage ? 'Image' : 'Document'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors ml-2 opacity-0 group-hover:opacity-100"
                  title={t('common.remove')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

