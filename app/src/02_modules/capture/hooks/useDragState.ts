// React hook to subscribe to drag state
// Pillar L: Bridge between Service layer and React

import { useState, useEffect, useCallback } from 'react';
import { captureService } from '../services/captureService';
import type { DragState } from '../types';

/**
 * Subscribe to drag state from captureService
 * Returns drag state and handlers for HTML drag events
 */
export function useDragState() {
  const [dragState, setDragState] = useState<DragState>(
    captureService.getDragState()
  );

  useEffect(() => {
    // Subscribe to drag state changes
    const unsubscribe = captureService.subscribeToDragState(setDragState);
    return unsubscribe;
  }, []);

  // HTML drag handlers for visual feedback
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    dragState,
    isDragging: dragState === 'dragging',
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
    },
  };
}
