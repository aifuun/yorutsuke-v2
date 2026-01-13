/**
 * Scanner Modal - Receipt document scanning interface
 *
 * Pillar L: Pure view component
 * - No business logic, calls scannerService for all operations
 * - Follows design system (FEEDBACK.md Modal specs)
 * - Large modal (800px) for image preview
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { scannerService } from '../services';
import {
  useScannerStatus,
  useScannerCorners,
  useScannerPreviewUrl,
  useScannerError,
} from '../hooks';
import { useTranslation } from '../../../i18n';
import './scanner.css';

interface ScannerModalProps {
  isOpen: boolean;
  onComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ScannerModal({ isOpen, onComplete, onCancel }: ScannerModalProps) {
  const { t } = useTranslation();
  const status = useScannerStatus();
  const corners = useScannerCorners();
  const previewUrl = useScannerPreviewUrl();
  const error = useScannerError();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image and draw on canvas when preview URL changes
  useEffect(() => {
    if (!previewUrl || !canvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = previewUrl;
  }, [previewUrl]);

  // Redraw canvas when corners change
  useEffect(() => {
    if (imageRef.current) {
      drawCanvas();
    }
  }, [corners, status]);

  /**
   * Draw image and overlay on canvas
   */
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate canvas size (maintain aspect ratio, fit in modal)
    const maxWidth = 750; // Modal max-width minus padding
    const maxHeight = 500;
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;
    setCanvasSize({ width, height });

    // Draw image
    ctx.drawImage(img, 0, 0, width, height);

    // Draw overlay if corners detected
    if (corners.length === 4 && status !== 'scanning') {
      // Scale corners to canvas size
      const scaleX = width / img.naturalWidth;
      const scaleY = height / img.naturalHeight;
      const scaledCorners = corners.map(c => ({
        x: c.x * scaleX,
        y: c.y * scaleY,
      }));

      // Draw semi-transparent green overlay
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; // Emerald-500 with alpha
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
      for (let i = 1; i < scaledCorners.length; i++) {
        ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  };

  /**
   * Handle corner drag start
   */
  const handleCornerMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingIndex(index);
  };

  /**
   * Handle corner drag move
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const img = imageRef.current;

    // Get mouse position relative to canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale to original image coordinates
    const scaleX = img.naturalWidth / canvasSize.width;
    const scaleY = img.naturalHeight / canvasSize.height;

    const originalX = Math.max(0, Math.min(img.naturalWidth, x * scaleX));
    const originalY = Math.max(0, Math.min(img.naturalHeight, y * scaleY));

    // Update corner via service
    scannerService.updateCorner(draggingIndex, { x: originalX, y: originalY });
  };

  /**
   * Handle corner drag end
   */
  const handleMouseUp = () => {
    setDraggingIndex(null);
  };

  /**
   * Handle confirm button
   */
  const handleConfirm = async () => {
    try {
      const result = await scannerService.confirmCrop();
      onComplete(result.croppedBlob);
    } catch (err) {
      // Error is already logged by service
      console.error('Crop failed:', err);
    }
  };

  /**
   * Handle skip (original upload)
   */
  const handleSkip = () => {
    const result = scannerService.skipCrop();
    onComplete(result.croppedBlob);
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    scannerService.cancel();
    onCancel();
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Render different states
  const isScanning = status === 'scanning';
  const isPreviewing = status === 'previewing' || status === 'cropping';
  const isProcessing = status === 'confirmed';
  const hasError = status === 'error';

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" role="presentation" aria-hidden="true" onClick={handleCancel} />

      {/* Modal */}
      <div className="modal modal-scanner" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        {/* Header */}
        <div className="modal-header">
          <button
            type="button"
            className="btn-icon"
            onClick={handleCancel}
            aria-label={t('common.back')}
            disabled={isProcessing}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 id="scanner-title" className="modal-title">
            {t('capture.scanner.title')}
          </h2>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleSkip}
            disabled={isScanning || isProcessing}
          >
            {t('capture.scanner.skipCrop')}
          </button>
        </div>

        {/* Body */}
        <div className="modal-body scanner-body">
          {/* Loading state */}
          {isScanning && (
            <div className="scanner-loading">
              <div className="spinner" />
              <p>{t('capture.scanner.detecting')}</p>
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div className="scanner-error">
              <p className="error-message">⚠️ {error || t('capture.scanner.detectionFailed')}</p>
              <p className="error-hint">{t('capture.scanner.errorHint')}</p>
            </div>
          )}

          {/* Preview canvas */}
          {(isPreviewing || isProcessing) && previewUrl && (
            <div className="scanner-canvas-container">
              <canvas
                ref={canvasRef}
                className="scanner-canvas"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />

              {/* Corner markers */}
              {isPreviewing && corners.length === 4 && (
                <div className="corner-markers">
                  {corners.map((corner, index) => {
                    const scaleX = canvasSize.width / (imageRef.current?.naturalWidth || 1);
                    const scaleY = canvasSize.height / (imageRef.current?.naturalHeight || 1);
                    return (
                      <div
                        key={index}
                        className={`corner-marker ${draggingIndex === index ? 'corner-marker--dragging' : ''}`}
                        style={{
                          left: `${corner.x * scaleX}px`,
                          top: `${corner.y * scaleY}px`,
                        }}
                        onMouseDown={handleCornerMouseDown(index)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${t('capture.scanner.corner')} ${index + 1}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hint text */}
          {isPreviewing && !hasError && (
            <p className="scanner-hint">{t('capture.scanner.hint')}</p>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={!isPreviewing || corners.length !== 4}
          >
            {isProcessing ? `⟳ ${t('capture.scanner.cropping')}` : `✓ ${t('capture.scanner.confirm')}`}
          </button>
        </div>
      </div>
    </>
  );
}
