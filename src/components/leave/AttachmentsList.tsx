import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Download, Eye, FileText, Image as ImageIcon, X, FileType } from 'lucide-react';
import { isImageFile, getFileNameFromUrl } from '../../utils/supabaseUpload';

interface AttachmentsListProps {
  attachments: string[];
}

type PreviewType = 'image' | 'pdf' | null;

export function AttachmentsList({ attachments }: AttachmentsListProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const isPdfFile = (url: string): boolean => {
    return url.toLowerCase().endsWith('.pdf');
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const handlePreview = (url: string) => {
    if (isImageFile(url)) {
      setPreviewUrl(url);
      setPreviewType('image');
    } else if (isPdfFile(url)) {
      setPreviewUrl(url);
      setPreviewType('pdf');
    } else {
      window.open(url, '_blank');
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewType(null);
  };

  return (
    <>
      <div className="space-y-2">
        {attachments.map((url, index) => {
          const fileName = getFileNameFromUrl(url);
          const isImage = isImageFile(url);
          const isPdf = isPdfFile(url);

          return (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {/* File Icon */}
              <div className="text-2xl">
                {isImage ? (
                  <ImageIcon className="w-8 h-8 text-blue-500" />
                ) : isPdf ? (
                  <FileType className="w-8 h-8 text-red-500" />
                ) : (
                  <FileText className="w-8 h-8 text-gray-500" />
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {isImage ? 'รูปภาพ' : isPdf ? 'PDF' : 'เอกสาร'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Preview Button */}
                <button
                  onClick={() => handlePreview(url)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="ดูไฟล์"
                >
                  <Eye className="w-5 h-5" />
                </button>

                {/* Download Button */}
                <button
                  onClick={() => handleDownload(url)}
                  className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  title="ดาวน์โหลด"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewUrl && previewType && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {previewType === 'image' ? 'ดูรูปภาพ' : 'ดูเอกสาร PDF'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(previewUrl);
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="ดาวน์โหลด"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="ปิด"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div
              className="w-full overflow-auto"
              style={{ height: 'calc(90vh - 80px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {previewType === 'image' ? (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              ) : previewType === 'pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

