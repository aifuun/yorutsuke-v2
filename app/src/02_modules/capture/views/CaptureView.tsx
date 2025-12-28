// Pillar L: Views are pure JSX, logic in headless hooks
import { useCaptureLogic } from '../headless/useCaptureLogic';
import type { UserId } from '../../../00_kernel/types';

interface CaptureViewProps {
  userId: UserId | null;
}

export function CaptureView({ userId }: CaptureViewProps) {
  const { state, pendingCount, uploadedCount, remainingQuota } = useCaptureLogic(userId);

  // Handle all states
  if (state.status === 'error') {
    return (
      <div className="capture-error">
        <p>Error: {state.error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="capture-container">
      <div className="capture-stats">
        <span>Pending: {pendingCount}</span>
        <span>Uploaded: {uploadedCount}</span>
        <span>Remaining: {remainingQuota}</span>
      </div>

      <div
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          // TODO: Handle file drop
        }}
      >
        <p>Drop receipts here</p>
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
