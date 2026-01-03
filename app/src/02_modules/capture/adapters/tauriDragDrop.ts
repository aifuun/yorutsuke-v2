// Tauri Drag & Drop Adapter
// Pillar I: Adapter layer isolates Tauri API from business logic

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { logger } from '../../../00_kernel/telemetry';
import { ImageId, createTraceId } from '../../../00_kernel/types';
import { ALLOWED_EXTENSIONS } from '../types';
import type { DroppedItem } from '../types';

/**
 * Tauri drag-drop event payload
 */
interface TauriDragDropPayload {
  paths: string[];
}

/**
 * Listener callbacks for Tauri drag events
 */
export interface TauriDragListeners {
  onDrop: (items: DroppedItem[], rejectedPaths: string[]) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
}

/**
 * Filter paths by allowed extensions
 */
function filterByExtension(
  paths: string[],
  allowedExtensions: readonly string[]
): { accepted: string[]; rejected: string[] } {
  const accepted: string[] = [];
  const rejected: string[] = [];

  for (const path of paths) {
    const ext = path.split('.').pop()?.toLowerCase();
    if (ext && allowedExtensions.includes(ext)) {
      accepted.push(path);
    } else {
      rejected.push(path);
    }
  }

  return { accepted, rejected };
}

/**
 * Convert file paths to DroppedItem objects
 * Pillar N: TraceId assigned here at drop time
 */
function pathsToDroppedItems(paths: string[]): DroppedItem[] {
  return paths.map((path) => {
    const traceId = createTraceId();
    const id = ImageId(crypto.randomUUID());
    logger.debug('[TauriDragDrop] Creating DroppedItem', { id, traceId, path });
    return {
      id,
      traceId,
      name: path.split('/').pop() || path.split('\\').pop() || path,
      preview: convertFileSrc(path),
      localPath: path,
    };
  });
}

/**
 * Setup Tauri drag-drop event listeners
 * Returns cleanup function to remove all listeners
 *
 * @example
 * const cleanup = await setupTauriDragListeners({
 *   onDrop: (items, rejected) => { ... },
 *   onDragEnter: () => setDragState('dragging'),
 *   onDragLeave: () => setDragState('idle'),
 * });
 * // Later: cleanup();
 */
export async function setupTauriDragListeners(
  listeners: TauriDragListeners,
  allowedExtensions: readonly string[] = ALLOWED_EXTENSIONS
): Promise<UnlistenFn> {
  logger.debug('[TauriDragDrop] Setting up listeners');

  // Listen to tauri://drag-drop
  const unlistenDrop = await listen<TauriDragDropPayload>(
    'tauri://drag-drop',
    (event) => {
      logger.debug('[TauriDragDrop] Drop event', { pathCount: event.payload.paths.length });

      const { accepted, rejected } = filterByExtension(
        event.payload.paths,
        allowedExtensions
      );

      if (rejected.length > 0) {
        logger.info('[TauriDragDrop] Rejected files', { count: rejected.length, rejected });
      }

      const items = pathsToDroppedItems(accepted);

      if (items.length > 0) {
        logger.info('[TauriDragDrop] Accepted files', { count: items.length });
        listeners.onDrop(items, rejected);
      } else if (rejected.length > 0) {
        // All files were rejected
        listeners.onDrop([], rejected);
      }
    }
  );

  // Listen to tauri://drag-enter
  const unlistenEnter = await listen('tauri://drag-enter', () => {
    logger.debug('[TauriDragDrop] Drag enter');
    listeners.onDragEnter();
  });

  // Listen to tauri://drag-leave
  const unlistenLeave = await listen('tauri://drag-leave', () => {
    logger.debug('[TauriDragDrop] Drag leave');
    listeners.onDragLeave();
  });

  logger.debug('[TauriDragDrop] Listeners registered');

  // Return combined cleanup function
  return () => {
    unlistenDrop();
    unlistenEnter();
    unlistenLeave();
    logger.debug('[TauriDragDrop] Listeners removed');
  };
}

/**
 * Check if a file extension is allowed
 */
export function isExtensionAllowed(
  path: string,
  allowedExtensions: readonly string[] = ALLOWED_EXTENSIONS
): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}
