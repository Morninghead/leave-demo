import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Check } from 'lucide-react';

interface SignatureCanvasProps {
  value: string | null;
  onChange: (signatureData: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  fullHeight?: boolean;
}

export function SignatureCanvas({ value, onChange, disabled = false, required = false, fullHeight = false }: SignatureCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Initialize canvas with proper dimensions and white background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set drawing style
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load existing signature if provided
    if (value) {
      const img = new Image();
      // Set crossOrigin to prevent canvas tainting on iOS when loading from storage URLs
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // First fill white, then draw image
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setIsEmpty(false);
      };
      img.src = value;
    }
  }, [value]);

  useEffect(() => {
    initCanvas();

    // Re-initialize on resize
    const handleResize = () => {
      // Small delay to let container resize first
      setTimeout(initCanvas, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [initCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    // Always reset isDrawing state
    setIsDrawing(false);

    // Save signature as base64 - always check canvas for content
    // Don't rely solely on isDrawing state as it may not be updated on iOS due to async batching
    const canvas = canvasRef.current;
    if (canvas && !isEmpty) {
      const signatureData = canvas.toDataURL('image/png');
      onChange(signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Reset drawing style
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setIsEmpty(true);
    onChange(null);
  };

  return (
    <div className={`flex flex-col ${fullHeight ? 'h-full min-h-0' : 'space-y-2'}`}>
      {!fullHeight && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('warning.signature')}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        ref={containerRef}
        className={`relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-white overflow-hidden ${fullHeight ? 'flex-1 min-h-0' : 'h-40'}`}
      >
        <canvas
          ref={canvasRef}
          style={{
            touchAction: 'none',
            backgroundColor: 'white',
            width: '100%',
            height: '100%',
            display: 'block'
          }}
          className={`cursor-crosshair ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />

        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 dark:text-gray-500 text-sm bg-white/80 px-3 py-1 rounded">
              {t('warning.signHere')}
            </p>
          </div>
        )}
      </div>

      {/* Only show footer buttons when NOT in fullHeight mode (non-modal usage) */}
      {!fullHeight && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearSignature}
              disabled={disabled || isEmpty}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('warning.clearSignature')}
            </button>

            {!isEmpty && !disabled && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-800 dark:text-green-200 bg-green-200 dark:bg-green-800 border border-green-300 dark:border-green-700 rounded-lg">
                <Check className="w-4 h-4" />
                {t('warning.signatureProvided')}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('warning.signatureHint')}
          </p>
        </div>
      )}
    </div>
  );
}

