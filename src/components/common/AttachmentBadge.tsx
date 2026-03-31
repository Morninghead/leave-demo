import { useState } from 'react';
import { Paperclip, X, Download, Eye, FileText, Image as ImageIcon, FileType } from 'lucide-react';
import { isImageFile, getFileNameFromUrl } from '../../utils/supabaseUpload';

interface AttachmentBadgeProps {
  count: number;
  className?: string;
  showCount?: boolean;
  attachments?: string[];
  onClick?: () => void;
}

export function AttachmentBadge({
  count,
  className = '',
  showCount = true,
  attachments = [],
  onClick
}: AttachmentBadgeProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);

  if (count === 0) {
    return null;
  }

  const isPdfFile = (url: string): boolean => {
    return url.toLowerCase().endsWith('.pdf');
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (attachments.length > 0) {
      setShowPopup(true);
    }
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
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors cursor-pointer ${className}`}
        title={`มีไฟล์แนบ ${count} ไฟล์`}
      >
        <Paperclip className="w-4 h-4" />
        {showCount && (
          <span className="text-xs font-medium">
            {count}
          </span>
        )}
      </button>

      {/* Attachments Popup */}
      {showPopup && attachments.length > 0 && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowPopup(false);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  ไฟล์แนบ ({count})
                </h3>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {attachments.map((url, index) => {
                const fileName = getFileNameFromUrl(url);
                const isImage = isImageFile(url);
                const isPdf = isPdfFile(url);

                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="text-2xl">
                      {isImage ? (
                        <ImageIcon className="w-8 h-8 text-blue-500" />
                      ) : isPdf ? (
                        <FileType className="w-8 h-8 text-red-500" />
                      ) : (
                        <FileText className="w-8 h-8 text-gray-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isImage ? 'รูปภาพ' : isPdf ? 'PDF' : 'เอกสาร'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreview(url)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="ดูไฟล์"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
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
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && previewType && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-[60] p-4"
          onClick={closePreview}
        >
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-2xl">
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

