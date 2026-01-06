// Capture Module Types
// Pillar A: Nominal Typing, Pillar D: FSM States

import type { ImageId, TraceId } from '../../00_kernel/types';

// Allowed image extensions
// Note: HEIC/HEIF not supported (Rust image crate lacks native support)
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type AllowedExtension = typeof ALLOWED_EXTENSIONS[number];

/**
 * Dropped item from Tauri drag-drop event
 * Pillar N: TraceId assigned at drop time for lifecycle tracking
 */
export interface DroppedItem {
  id: ImageId;
  traceId: TraceId;    // Pillar N: Tracks entire lifecycle from drop to confirm
  name: string;
  preview: string;     // convertFileSrc URL for display
  localPath: string;   // Original file path for processing
}

/**
 * Drag state FSM (Pillar D)
 * - idle: No drag activity
 * - dragging: User is dragging files over the app
 */
export type DragState = 'idle' | 'dragging';

/**
 * Options for useDragDrop hook
 */
export interface DragDropOptions {
  /** Callback when files are dropped */
  onDrop: (items: DroppedItem[]) => void;
  /** Allowed file extensions (defaults to ALLOWED_EXTENSIONS) */
  allowedExtensions?: readonly string[];
  /** Callback when invalid files are rejected */
  onReject?: (rejectedPaths: string[]) => void;
}

/**
 * Return type for useDragDrop hook (Pillar L: data + functions only)
 */
export interface DragDropResult {
  /** Current drag state (FSM) */
  dragState: DragState;
  /** Convenience boolean derived from state */
  isDragging: boolean;
  /** HTML drag event handlers for visual feedback */
  dragHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
  };
}
