// Drag & Drop Headless Hook
// Pillar L: Headless - No JSX, returns data + functions only
// Pillar D: FSM States - Uses DragState union type
// Pillar G: Traceability - @trigger annotations

import { useState, useEffect, useCallback, useRef } from 'react';
import { emit } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { setupTauriDragListeners } from '../adapters/tauriDragDrop';
import { ALLOWED_EXTENSIONS } from '../types';
import type { DragState, DragDropOptions, DragDropResult, DroppedItem } from '../types';

/**
 * Headless hook for Tauri drag & drop handling
 *
 * Pillar L: Returns data + functions only, NO JSX
 * Pillar D: Uses FSM state (DragState = 'idle' | 'dragging')
 *
 * @trigger image:pending - When files are dropped
 *
 * @example
 * function DropZone() {
 *   const { isDragging, dragHandlers } = useDragDrop({
 *     onDrop: (items) => console.log('Dropped:', items),
 *   });
 *
 *   return (
 *     <div
 *       className={isDragging ? 'dragging' : ''}
 *       {...dragHandlers}
 *     >
 *       Drop files here
 *     </div>
 *   );
 * }
 */
export function useDragDrop(options: DragDropOptions): DragDropResult {
  const { onDrop, allowedExtensions = ALLOWED_EXTENSIONS, onReject } = options;

  // FSM state (Pillar D)
  const [dragState, setDragState] = useState<DragState>('idle');

  // Use refs to avoid re-setting up listeners when callbacks change
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const onRejectRef = useRef(onReject);
  onRejectRef.current = onReject;

  const allowedExtensionsRef = useRef(allowedExtensions);
  allowedExtensionsRef.current = allowedExtensions;

  // Setup Tauri listeners on mount
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const setup = async () => {
      cleanup = await setupTauriDragListeners(
        {
          /**
           * @trigger image:pending
           * @emits { id, name, source, preview, localPath }
           */
          onDrop: (items: DroppedItem[], rejectedPaths: string[]) => {
            setDragState('idle');

            // Notify about rejected files
            if (rejectedPaths.length > 0 && onRejectRef.current) {
              onRejectRef.current(rejectedPaths);
            }

            // Emit image:pending for each item
            for (const item of items) {
              logger.debug('[useDragDrop] Emitting image:pending', { id: item.id });
              emit('image:pending', {
                id: item.id,
                name: item.name,
                source: 'drop',
                preview: item.preview,
                localPath: item.localPath,
              });
            }

            // Call user callback
            if (items.length > 0) {
              onDropRef.current(items);
            }
          },

          onDragEnter: () => {
            setDragState('dragging');
          },

          onDragLeave: () => {
            setDragState('idle');
          },
        },
        allowedExtensionsRef.current
      );
    };

    setup();

    return () => {
      cleanup?.();
    };
  }, []); // Empty deps - only setup once on mount

  // HTML drag handlers for visual feedback
  // (Tauri handles actual file drops, these are just for UI feedback)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState('idle');
  }, []);

  // Derived value (Pillar D: boolean derived from FSM)
  const isDragging = dragState === 'dragging';

  // Return interface (Pillar L: data + functions only)
  return {
    dragState,
    isDragging,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
    },
  };
}
