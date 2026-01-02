// Pillar L: Views are pure JSX, logic in headless hooks
// Pillar Q: Intent-ID for idempotency
import { useCaptureLogic } from '../headless/useCaptureLogic';
import { useDragDrop } from '../headless/useDragDrop';
import { useNetworkStatus } from '../../../00_kernel/network';
import type { UserId } from '../../../00_kernel/types';
import { createIntentId } from '../../../00_kernel/types';
import type { DroppedItem } from '../types';

interface CaptureViewProps {
  userId: UserId | null;
}

export function CaptureView({ userId }: CaptureViewProps) {
  const { isOnline } = useNetworkStatus();
  const {
    state,
    pendingCount,
    uploadedCount,
    awaitingProcessCount,
    remainingQuota,
    addImage,
  } = useCaptureLogic(userId);

  // Drag & drop handling
  // Note: useDragDrop emits image:pending events automatically
  // The addImage here is for adding to the local queue display
  const { isDragging, dragHandlers } = useDragDrop({
    onDrop: (items: DroppedItem[]) => {
      // Add dropped items to capture queue
      for (const item of items) {
        addImage({
          id: item.id,
          userId: userId!,
          intentId: createIntentId(),  // Pillar Q: Generate unique intent per drop action
          localPath: item.localPath,
          status: 'pending',
          s3Key: null,
          thumbnailPath: item.preview,
          originalSize: 0, // Will be updated after compression
          compressedSize: null,
          createdAt: new Date().toISOString(),
          uploadedAt: null,
          processedAt: null,
        });
      }
    },
    onReject: (rejectedPaths) => {
      // Could show toast notification here
      console.warn('Rejected files:', rejectedPaths);
    },
  });

  // Handle error state
  if (state.status === 'error') {
    return (
      <div className="capture-error">
        <p>Error: {state.error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="capture-container">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="offline-indicator">
          <span className="offline-icon">📡</span>
          <span>Waiting for connection...</span>
        </div>
      )}

      <div className="capture-stats">
        <span>Pending: {pendingCount}</span>
        <span>Uploaded: {uploadedCount}</span>
        {awaitingProcessCount > 0 && (
          <span className="awaiting-process">Awaiting AI: {awaitingProcessCount}</span>
        )}
        <span>Remaining: {remainingQuota}</span>
      </div>

      <div
        className={`drop-zone ${isDragging ? 'drop-zone--dragging' : ''}`}
        {...dragHandlers}
      >
        {isDragging ? (
          <p>Drop to upload</p>
        ) : (
          <p>Drop receipts here</p>
        )}
        {state.status === 'processing' && <p>Processing...</p>}
        {state.status === 'uploading' && <p>Uploading...</p>}
      </div>

      <div className="queue-list">
        {state.queue.map((image) => (
          <div key={image.id} className={`queue-item status-${image.status}`}>
            <span>{image.id}</span>
            <span>{image.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
